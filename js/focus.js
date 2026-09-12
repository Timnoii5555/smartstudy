/**
 * focus.js
 * Screen 6: a real Pomodoro engine (focus / short break / long break, cycling
 * automatically, durations configurable in Settings) plus a generated
 * ambient-noise player. The current phase's progress is shown as a plane
 * flying a fixed route (a "Flight Focus"-style visual, deliberately more
 * fun to glance at than a bare progress ring — see renderFlightPlane()),
 * while the *daily* study goal (today's total vs. the goal) is shown as
 * plain numbers further down the screen. The big numeric readout in the
 * middle of the flight visual counts down the current Pomodoro phase.
 *
 * Timer correctness (Phase 1 rewrite): the countdown is timestamp-based, not
 * a `setInterval` counter. `runStartedAtMs` (when the current run segment
 * began) and `accumulatedMs` (how much of this phase had already elapsed
 * before that segment) are the only persisted source of truth; remaining
 * time is always *derived* from `Date.now() - runStartedAtMs`, never
 * decremented tick-by-tick. This matters because `setInterval` is throttled
 * or fully suspended by the browser while a tab is backgrounded or the
 * phone is locked — a counter that ticks itself down loses time exactly
 * when it matters most. Deriving from a timestamp means a reload, a locked
 * phone, or a backgrounded tab can never desync the countdown: whenever this
 * screen is next rendered, remaining time is recomputed fresh and is correct
 * to within a second, and a run that's still supposed to be going keeps
 * going (including across a full page reload) rather than silently pausing.
 *
 * Leaving screen6 for a different in-app screen still pauses the run (and
 * stops ambient sound) exactly as before — that's a deliberate product
 * choice (a "focus session" means being on the focus screen), not the bug
 * this rewrite fixes. What's fixed is staying *on* this screen while the
 * browser tab itself is backgrounded/locked/reloaded.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};
    const U = TFS.Utils;
    const I18n = TFS.I18n;
    const State = TFS.State;
    const WP = TFS.WheelPicker;

    function todayISO() { return U.formatDateISO(new Date()); }
    function isActive() { return TFS.Router.current() === 'screen6'; }
    function pomodoroSettings() { return State.get().settings.pomodoro; }
    function durationForMode(m) {
        const p = pomodoroSettings();
        if (m === 'shortBreak') return p.shortBreakMin * 60;
        if (m === 'longBreak') return p.longBreakMin * 60;
        return p.focusMin * 60;
    }
    function getTotalToday() { return State.get().focus.totalSecondsByDate[todayISO()] || 0; }

    // A session under this length that gets reset/cancelled is discarded
    // silently rather than logged as partial progress (see reset() below).
    const MIN_PARTIAL_SECONDS = 5 * 60;

    // ---- Runtime engine state. `mode`/`cyclesCompletedToday` and the two
    // timestamp fields below ARE persisted (see persistRuntime) so a reload
    // resumes exactly where things stood — including a run that was still
    // going. `lastCreditMs` is NOT persisted directly; it is reconstructed
    // from the persisted `lastCreditAtMs` checkpoint on load so no elapsed
    // study time is ever double-counted or dropped across a reload. ----
    let mode = 'focus';
    let cyclesCompletedToday = 0;
    let runStartedAtMs = null;   // epoch ms the current run segment began, or null while paused
    let accumulatedMs = 0;       // ms of the current phase already elapsed from previous run segments
    let lastCreditMs = Date.now(); // last time totalSecondsByDate/subject/time-of-day were credited
    let renderIntervalId = null;
    let wakeLockSentinel = null;

    function getElapsedMsInPhase() {
        return accumulatedMs + (runStartedAtMs !== null ? (Date.now() - runStartedAtMs) : 0);
    }
    function getRemainingSeconds() {
        const remainingMs = (durationForMode(mode) * 1000) - getElapsedMsInPhase();
        return Math.max(0, Math.ceil(remainingMs / 1000));
    }
    function isRunning() { return runStartedAtMs !== null; }

    function loadRuntimeFromState() {
        const f = State.get().focus;
        const today = todayISO();
        if (f.lastActiveDateISO !== today) {
            // A new day: cycle count and phase restart fresh, but the
            // per-date/per-subject accumulation maps are keyed by date
            // already so past days are naturally preserved untouched.
            mode = 'focus';
            cyclesCompletedToday = 0;
            runStartedAtMs = null;
            accumulatedMs = 0;
            State.commit({ focus: { lastActiveDateISO: today, mode, cyclesCompletedToday, runStartedAtMs: null, accumulatedMs: 0 } });
        } else {
            mode = f.mode || 'focus';
            cyclesCompletedToday = f.cyclesCompletedToday || 0;
            accumulatedMs = typeof f.accumulatedMs === 'number' ? f.accumulatedMs : 0;
            runStartedAtMs = typeof f.runStartedAtMs === 'number' ? f.runStartedAtMs : null;
        }
        // Resume crediting from exactly where the last session left off
        // (mid-run ticking, or the last visibility/pause checkpoint) — never
        // from "now", which would silently drop everything elapsed while
        // this screen was unmounted or the tab was gone.
        lastCreditMs = typeof f.lastCreditAtMs === 'number' ? f.lastCreditAtMs : (runStartedAtMs || Date.now());

        if (isRunning()) {
            requestWakeLock();
            ensureRenderInterval();
            joinFlightHeartbeatIfEligible();
            // A locked phone or a killed tab can mean the phase boundary was
            // already crossed while we were away — catch up once, immediately.
            creditElapsedFocusTime();
            if (getRemainingSeconds() <= 0) completePhase();
        }
    }

    function persistRuntime() {
        State.commit({ focus: { mode, cyclesCompletedToday, runStartedAtMs, accumulatedMs, lastCreditAtMs: lastCreditMs, lastActiveDateISO: todayISO() } });
    }

    /** Best-effort "which part of the day" bucket for the Phase 6 stats view —
     *  deliberately coarse (4 buckets, not a full per-session log) so this
     *  never grows unbounded and needs no separate cleanup logic. */
    function timeOfDayBucket(date) {
        const h = date.getHours();
        if (h >= 5 && h < 12) return 'morning';
        if (h >= 12 && h < 17) return 'afternoon';
        if (h >= 17 && h < 22) return 'evening';
        return 'night';
    }

    function addSecondsToToday(n) {
        if (n === 0) return;
        const today = todayISO();
        const totals = { ...State.get().focus.totalSecondsByDate };
        totals[today] = Math.max(0, (totals[today] || 0) + n);

        const subjectId = State.get().plan.subject;
        const bySubject = { ...State.get().focus.totalSecondsBySubject };
        if (subjectId) {
            const forSubject = { ...(bySubject[subjectId] || {}) };
            forSubject[today] = Math.max(0, (forSubject[today] || 0) + n);
            bySubject[subjectId] = forSubject;
        }

        const byBucket = { ...State.get().focus.timeOfDayMinutes };
        const bucket = timeOfDayBucket(new Date());
        byBucket[bucket] = Math.max(0, (byBucket[bucket] || 0) + (n / 60));

        State.commit({ focus: { totalSecondsByDate: totals, totalSecondsBySubject: bySubject, timeOfDayMinutes: byBucket } });

        if (TFS.Streak) TFS.Streak.reconcile();
    }

    /** Credits real elapsed wall-clock time (since the last checkpoint) into
     *  today's totals, but only for time actually spent in the 'focus'
     *  phase — breaks never count toward the study goal or streak. Called
     *  on every render tick and at every state transition (start/pause/
     *  reset/complete/visibility-return) so no elapsed time is ever lost to
     *  a throttled or suspended background tab.
     *
     *  Crucially, this never credits more than the current phase's own
     *  duration: if the gap since the last checkpoint is long enough that
     *  the phase boundary falls inside it (a tab backgrounded for hours,
     *  say), only the time up to that boundary counts as focus time — the
     *  rest was spent away from the app entirely and is not fabricated
     *  into study time just because the phase was still technically
     *  "running" in storage. */
    function creditElapsedFocusTime() {
        const now = Date.now();
        if (!isRunning() || mode !== 'focus') { lastCreditMs = now; return; }
        const deltaMs = now - lastCreditMs;
        if (deltaMs <= 0) return;

        const elapsedBeforeThisDelta = accumulatedMs + (lastCreditMs - runStartedAtMs);
        const budgetLeftMs = Math.max(0, (durationForMode(mode) * 1000) - elapsedBeforeThisDelta);

        if (deltaMs > budgetLeftMs) {
            const creditableSec = Math.floor(budgetLeftMs / 1000);
            if (creditableSec > 0) addSecondsToToday(creditableSec);
            lastCreditMs = now;
            return;
        }

        const deltaSec = Math.floor(deltaMs / 1000);
        if (deltaSec > 0) {
            addSecondsToToday(deltaSec);
            lastCreditMs += deltaSec * 1000; // keep any sub-second remainder so normal per-second ticking never drifts
        }
    }

    // ---------------------------------------------------------------- Wake Lock

    async function requestWakeLock() {
        try {
            if ('wakeLock' in navigator) wakeLockSentinel = await navigator.wakeLock.request('screen');
        } catch (e) { /* unsupported, or the page isn't visible yet — fail silently per spec */ }
    }
    function releaseWakeLock() {
        if (wakeLockSentinel) { wakeLockSentinel.release().catch(() => {}); wakeLockSentinel = null; }
    }
    // The OS releases a wake lock the instant a tab is hidden; re-acquire it
    // when the learner comes back to a still-running session. Wrapped in
    // try/catch because this is a raw event listener with nothing upstream
    // (unlike router.js/state.js's own listener dispatch) to stop a thrown
    // error here from becoming a fully uncaught exception.
    document.addEventListener('visibilitychange', () => {
        try {
            if (!isActive()) return;
            if (document.visibilityState === 'visible') {
                creditElapsedFocusTime();
                if (isRunning() && getRemainingSeconds() <= 0) completePhase();
                if (isRunning()) requestWakeLock();
                render();
            } else if (isRunning()) {
                // About to be backgrounded/suspended: checkpoint now so nothing
                // that already elapsed is lost if the tab gets killed outright.
                creditElapsedFocusTime();
                persistRuntime();
            }
        } catch (e) { console.error('[focus] visibilitychange handler threw', e); }
    });

    // ---------------------------------------------------------------- DOM refs

    const focusTimerDisplay = document.getElementById('focusTimerDisplay');
    const focusPhaseLabel = document.getElementById('focusPhaseLabel');
    const focusCycleLabel = document.getElementById('focusCycleLabel');
    const focusStartBtn = document.getElementById('focusStartBtn');
    const focusStartBtnIcon = document.getElementById('focusStartBtnIcon');
    const focusStartBtnText = document.getElementById('focusStartBtnText');
    const focusResetBtn = document.getElementById('focusResetBtn');
    const focusTodayHours = document.getElementById('focusTodayHours');
    const focusGoalHours = document.getElementById('focusGoalHours');
    const displayFocusGoal = document.getElementById('displayFocusGoal');

    const PHASE_KEY = { focus: 's6.phaseFocus', shortBreak: 's6.phaseShortBreak', longBreak: 's6.phaseLongBreak' };

    // ---------------------------------------------------------------- "Flight Focus"-style route visual + flight picker

    const flightPathEl = document.getElementById('flightPath');
    const flightTrailEl = document.getElementById('flightTrail');
    const flightPlaneEl = document.getElementById('flightPlane');
    const flightWindowEls = flightPlaneEl ? Array.from(flightPlaneEl.querySelectorAll('.flight-window')) : [];
    const flightDestCodeEl = document.getElementById('flightDestCode');
    const flightPickerRow = document.getElementById('flightPickerRow');
    const flightPickerLabel = document.getElementById('flightPickerLabel');
    let flightPathLength = null;
    // How many real people are on this exact flight right now, including
    // this learner — refreshed by refreshCoStudyCount() below whenever
    // sharing is on and a flight matches; otherwise just "yourself" once a
    // flight is selected at all, as flavor. renderFlightWindows() below is
    // the only thing that reads this.
    let knownFlightPassengerCount = 1;

    // A handful of curated study-session lengths, each given a (purely
    // decorative — not real airport/flight data) destination, the same
    // spirit as the video that inspired this. Picking one sets the focus
    // duration to exactly that many minutes, so two learners who pick the
    // same flight are — by definition — running the same timer length,
    // which is what makes "you're on the same plane as them" a meaningful
    // thing to show rather than a coincidence.
    const FLIGHTS = [
        { id: 'hhq', minutes: 15, code: 'HHQ', name: { th: 'หัวหิน', en: 'Hua Hin' } },
        { id: 'cnx', minutes: 25, code: 'CNX', name: { th: 'เชียงใหม่', en: 'Chiang Mai' } },
        { id: 'hkt', minutes: 45, code: 'HKT', name: { th: 'ภูเก็ต', en: 'Phuket' } },
        { id: 'kbv', minutes: 60, code: 'KBV', name: { th: 'กระบี่', en: 'Krabi' } },
        { id: 'cei', minutes: 90, code: 'CEI', name: { th: 'เชียงราย', en: 'Chiang Rai' } }
    ];

    function flightForMinutes(minutes) { return FLIGHTS.find(f => f.minutes === minutes) || null; }

    /** The nearest flight's code even when the current duration doesn't
     *  exactly match one (e.g. a custom value set in Settings) — purely for
     *  the destination label on the map, never used for passenger matching
     *  (see renderFlightPassengers below, which requires an exact match). */
    function nearestFlightCode(minutes) {
        const exact = flightForMinutes(minutes);
        if (exact) return exact.code;
        const closest = FLIGHTS.reduce((best, f) => (Math.abs(f.minutes - minutes) < Math.abs(best.minutes - minutes) ? f : best), FLIGHTS[0]);
        return closest.code;
    }

    /** Lights up one cabin window per real learner currently on this exact
     *  flight (capped at however many window slots the plane actually has;
     *  anyone beyond that is still counted in the text next to the
     *  toggle, just not drawn individually). Never anything more specific
     *  than a lit dot — see the HTML comment above #flightPlane for why. */
    function renderFlightWindows(count) {
        const lit = U.clamp(count, 0, flightWindowEls.length);
        flightWindowEls.forEach((el, i) => el.classList.toggle('is-lit', i < lit));
    }

    /** Moves the plane along the fixed route path to reflect how far into
     *  the current phase we are — the current-phase equivalent of what the
     *  old progress ring showed, computed the same timestamp-derived way
     *  as the countdown itself so it's never a step behind it. Also fills
     *  in the "traveled" trail behind it and keeps the cabin windows in
     *  sync with the last-known passenger count. */
    function renderFlightPlane() {
        if (!flightPathEl || !flightPlaneEl) return;
        const total = durationForMode(mode);
        if (flightDestCodeEl) flightDestCodeEl.textContent = nearestFlightCode(Math.round(total / 60));
        renderFlightWindows(knownFlightPassengerCount);

        // SVG geometry queries (getTotalLength/getPointAtLength) are the one
        // part of this screen that isn't fully reliable across browsers —
        // some WebKit versions can throw on a <path> that was only just
        // made visible (a display:none -> block flip, exactly what
        // switching screens does) before layout has caught up. None of
        // that should ever be able to take the rest of the timer down with
        // it — remaining time, phase, and goal are the parts that actually
        // matter and are rendered separately in render() regardless of
        // whether the plane itself could be positioned this pass.
        try {
            if (flightPathLength === null) flightPathLength = flightPathEl.getTotalLength();
            const remaining = getRemainingSeconds();
            const progress = total > 0 ? U.clamp(1 - remaining / total, 0, 1) : 0;
            const len = flightPathLength * progress;
            const p1 = flightPathEl.getPointAtLength(len);
            const p2 = flightPathEl.getPointAtLength(Math.min(flightPathLength, len + 1));
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
            flightPlaneEl.setAttribute('transform', `translate(${p1.x},${p1.y}) rotate(${angle})`);
            if (flightTrailEl) {
                flightTrailEl.setAttribute('stroke-dasharray', String(flightPathLength));
                flightTrailEl.setAttribute('stroke-dashoffset', String(flightPathLength * (1 - progress)));
            }
        } catch (e) {
            console.warn('[focus] Could not position the flight-path plane this render (will retry next tick).', e);
        }
    }

    /** The flight picker: only meaningful before a focus phase starts (you
     *  can't change your ticket mid-flight) and only for the focus phase
     *  itself, not breaks — breaks stay whatever length Settings has them
     *  at. Selecting a chip sets settings.pomodoro.focusMin directly, so
     *  every other part of the app (streak, stats, the timer engine
     *  itself) needs no separate concept of "which flight" at all. */
    function renderFlightPicker() {
        if (!flightPickerRow) return;
        const show = mode === 'focus' && !isRunning();
        flightPickerRow.hidden = !show;
        if (flightPickerLabel) flightPickerLabel.hidden = !show;
        if (!show) return;

        const currentMinutes = pomodoroSettings().focusMin;
        flightPickerRow.innerHTML = '';
        FLIGHTS.forEach((flight) => {
            const isSelected = flight.minutes === currentMinutes;
            flightPickerRow.appendChild(U.el('button', {
                className: 'flight-chip' + (isSelected ? ' is-selected' : ''),
                attrs: { type: 'button', role: 'radio', 'aria-checked': String(isSelected) },
                on: { click: () => selectFlight(flight) }
            }, [
                U.el('span', { className: 'flight-chip__code', text: flight.code }),
                U.el('span', { className: 'flight-chip__name', text: I18n.pick(flight.name) }),
                U.el('span', { className: 'flight-chip__mins', text: I18n.t('s6.flightMinutes', { n: flight.minutes }) })
            ]));
        });
    }

    function selectFlight(flight) {
        if (isRunning()) return;
        State.commit({ settings: { pomodoro: { focusMin: flight.minutes } } });
        if (mode === 'focus') { accumulatedMs = 0; persistRuntime(); }
        render();
        refreshCoStudyCount(); // this flight's passenger count may differ from the previous one
    }

    /** The flight the learner is currently ticketed for, if the duration
     *  exactly matches one of the curated FLIGHTS — null for a custom
     *  duration set via Settings, in which case there's no shared room to
     *  join (see js/presence.js's file header for why matching has to be
     *  exact rather than nearest-match). */
    function currentFocusFlight() { return flightForMinutes(pomodoroSettings().focusMin); }

    /** Joins this flight's shared presence room if — and only if — the
     *  learner has opted in, we're actually in the focus phase (not a
     *  break), and the current duration exactly matches a curated flight
     *  to join a room for. Safe to call unconditionally; no-ops otherwise. */
    function joinFlightHeartbeatIfEligible() {
        const flight = mode === 'focus' ? currentFocusFlight() : null;
        if (flight && State.get().settings.coStudyPublicEnabled && TFS.Presence && TFS.Presence.isAvailable()) {
            TFS.Presence.startHeartbeat(flight.id);
        }
    }

    function render() {
        // The parts that actually matter — remaining time, phase, goal,
        // the start/pause button — always run first and unconditionally,
        // regardless of whether the decorative flight visual below them
        // succeeds. That order is deliberate defense in depth: renderFlightPlane()
        // already guards its own risky SVG calls, but nothing about the
        // countdown itself should ever be allowed to depend on a map
        // animation rendering correctly.
        const goal = State.get().plan.dailyGoalSeconds;
        focusTimerDisplay.textContent = U.formatSecondsToHMS(getRemainingSeconds());
        focusPhaseLabel.textContent = I18n.t(PHASE_KEY[mode]);
        const cycles = pomodoroSettings().cyclesBeforeLongBreak;
        const currentCycle = (cyclesCompletedToday % cycles) + 1;
        focusCycleLabel.textContent = I18n.t('s6.cycleLabel', { current: currentCycle, total: cycles });

        displayFocusGoal.textContent = U.formatSecondsToHHMM(goal);
        focusTodayHours.textContent = U.formatSecondsToHHMM(getTotalToday());
        focusGoalHours.textContent = U.formatSecondsToHHMM(goal);

        if (isRunning()) {
            focusStartBtnIcon.textContent = 'pause';
            focusStartBtnText.textContent = I18n.t('s6.pause');
        } else {
            focusStartBtnIcon.textContent = 'play_arrow';
            const full = durationForMode(mode);
            focusStartBtnText.textContent = (getRemainingSeconds() < full) ? I18n.t('s6.resume') : I18n.t('s6.start');
        }

        renderSoundToggle();
        renderFlightPlane();
        renderFlightPicker();
    }

    function ensureRenderInterval() {
        if (renderIntervalId !== null) return;
        renderIntervalId = setInterval(tick, 1000);
    }
    function clearRenderInterval() {
        if (renderIntervalId !== null) { clearInterval(renderIntervalId); renderIntervalId = null; }
    }

    // Wrapped for the same reason as the visibilitychange listener above:
    // this runs once a second via setInterval with nothing upstream to
    // catch a thrown error, and it would do so every single second a
    // session is running if it ever regressed.
    function tick() {
        try {
            creditElapsedFocusTime();
            if (isRunning() && getRemainingSeconds() <= 0) completePhase();
            render();
        } catch (e) { console.error('[focus] tick threw', e); }
    }

    function completePhase() {
        playNotificationSound();
        if (mode === 'focus') {
            cyclesCompletedToday++;
            const cycles = pomodoroSettings().cyclesBeforeLongBreak;
            mode = (cyclesCompletedToday % cycles === 0) ? 'longBreak' : 'shortBreak';
            TFS.Toast.info(I18n.t('s6.phaseCompleteFocus'));
            // Landed for a break — a flight's shared room only makes sense
            // while actually mid-focus, so leave it rather than keep
            // pinging a room for a flight that's no longer in the air, and
            // reset the cabin back to just yourself until the next flight.
            if (TFS.Presence) TFS.Presence.stopHeartbeat();
            knownFlightPassengerCount = 1;
        } else {
            mode = 'focus';
            TFS.Toast.info(I18n.t('s6.phaseCompleteBreak'));
        }
        accumulatedMs = 0;
        // Auto-advance into the next phase without requiring another tap —
        // but only if a session was actually running; completing a phase
        // that was reached via the day-rollover reset above never auto-runs.
        if (isRunning()) {
            runStartedAtMs = Date.now(); lastCreditMs = runStartedAtMs;
            if (mode === 'focus') joinFlightHeartbeatIfEligible(); // break just ended — back in the air
        }
        persistRuntime();
    }

    function start() {
        if (isRunning()) return;
        runStartedAtMs = Date.now();
        lastCreditMs = runStartedAtMs;
        requestWakeLock();
        ensureRenderInterval();
        joinFlightHeartbeatIfEligible();
        persistRuntime();
        render();
    }

    function pause() {
        if (!isRunning()) return;
        creditElapsedFocusTime();
        accumulatedMs += Date.now() - runStartedAtMs;
        runStartedAtMs = null;
        releaseWakeLock();
        clearRenderInterval();
        if (TFS.Presence) TFS.Presence.stopHeartbeat();
        persistRuntime();
        render();
    }

    /** "Cancel" per the spec: a focus phase cut short before 5 minutes is
     *  discarded silently (the seconds already credited to today's total are
     *  subtracted back out); one cut short after 5 minutes stays logged as a
     *  partial session — no penalty copy or confirmation dialog either way. */
    function reset() {
        creditElapsedFocusTime();
        const elapsedMs = getElapsedMsInPhase();
        releaseWakeLock();
        clearRenderInterval();
        if (TFS.Presence) TFS.Presence.stopHeartbeat();
        runStartedAtMs = null;
        if (mode === 'focus' && elapsedMs > 0 && elapsedMs < MIN_PARTIAL_SECONDS * 1000) {
            addSecondsToToday(-Math.floor(elapsedMs / 1000));
        }
        accumulatedMs = 0;
        persistRuntime();
        render();
    }

    focusStartBtn.addEventListener('click', () => { isRunning() ? pause() : start(); });
    focusResetBtn.addEventListener('click', reset);

    function playNotificationSound() {
        if (!State.get().settings.soundEnabled) return;
        try {
            const audioCtx = new (global.AudioContext || global.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.start();
            gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 1.5);
            oscillator.stop(audioCtx.currentTime + 1.5);
        } catch (e) { console.warn('[focus] Web Audio unavailable for the notification sound.', e); }
    }

    // ---------------------------------------------------------------- Sound toggle

    const notifToggleBtn = document.getElementById('notifToggleBtn');
    const notifToggleSwitch = document.getElementById('notifToggleSwitch');
    const notifToggleIcon = document.getElementById('notifToggleIcon');

    function renderSoundToggle() {
        const on = State.get().settings.soundEnabled;
        notifToggleSwitch.classList.toggle('is-on', on);
        notifToggleBtn.setAttribute('aria-pressed', String(on));
        notifToggleIcon.textContent = on ? 'notifications_active' : 'notifications_off';
    }
    notifToggleBtn.addEventListener('click', () => {
        State.commit({ settings: { soundEnabled: !State.get().settings.soundEnabled } });
    });

    // ---------------------------------------------------------------- Daily goal quick-edit wheel

    const setTimerModal = document.getElementById('setTimerModal');
    const btnOpenSetTimerModal = document.getElementById('btnOpenSetTimerModal');
    const hoursWheel = document.getElementById('hoursWheel');
    const minutesWheel = document.getElementById('minutesWheel');
    let goalWheelsBuilt = false;

    btnOpenSetTimerModal.addEventListener('click', () => {
        if (isRunning()) { TFS.Toast.warn(I18n.t('errors.stopTimerFirst')); return; }
        if (!goalWheelsBuilt) {
            WP.createItems(hoursWheel, 24, false);
            WP.createItems(minutesWheel, 59, true);
            WP.attachScrollSync(hoursWheel);
            WP.attachScrollSync(minutesWheel);
            WP.attachWheelStep(hoursWheel, 24);
            WP.attachWheelStep(minutesWheel, 59);
            goalWheelsBuilt = true;
        }
        const goal = State.get().plan.dailyGoalSeconds;
        const h = Math.floor(goal / 3600), m = Math.floor((goal % 3600) / 60);
        TFS.Modal.open(setTimerModal, { onOpen: () => { WP.setValue(hoursWheel, h); WP.setValue(minutesWheel, m); } });
    });

    document.getElementById('closeSetTimerBtn').addEventListener('click', () => TFS.Modal.close(setTimerModal));
    document.getElementById('saveSetTimerBtn').addEventListener('click', () => {
        const h = WP.getValue(hoursWheel), m = WP.getValue(minutesWheel);
        if (h === 0 && m === 0) { TFS.Toast.warn(I18n.t('errors.setGoalMin')); return; }
        State.commit({ plan: { dailyGoalSeconds: (h * 3600) + (m * 60) } });
        TFS.Modal.close(setTimerModal);
        render();
    });

    // ---------------------------------------------------------------- Ambient sound (Web Audio)

    // ScriptProcessorNode is deprecated in favor of AudioWorklet, but AudioWorklet
    // requires fetching a separate module file via `audioContext.audioWorklet.addModule()`
    // — which fails under file:// the same way fetch() does. ScriptProcessorNode
    // still works everywhere and needs no extra file, so it is the pragmatic choice
    // for an app meant to be opened straight from disk with zero server.
    //
    // Six generated sounds ship out of the box, each just a different filter
    // (+ optional slow LFO amplitude wobble) over the same underlying noise
    // source — no audio files to bundle, so the app stays a handful of KB.
    // A learner can also upload their own file (js/customSounds.js); that
    // path bypasses the noise graph entirely and loops a decoded AudioBuffer.
    const BUILTIN_AMBIENT_TYPES = {
        brown: { icon: 'water_drop', filterType: 'lowpass', freq: 400, q: 0.7, label: { th: 'เสียงสีน้ำตาล', en: 'Brown noise' } },
        rain: { icon: 'rainy', filterType: 'bandpass', freq: 2500, q: 0.7, label: { th: 'เสียงฝน', en: 'Rain' } },
        white: { icon: 'blur_on', filterType: 'highpass', freq: 20, q: 0.0001, label: { th: 'เสียงสีขาว', en: 'White noise' } },
        ocean: { icon: 'waves', filterType: 'lowpass', freq: 600, q: 0.8, lfo: { freq: 0.15, depth: 0.55 }, label: { th: 'คลื่นทะเล', en: 'Ocean waves' } },
        wind: { icon: 'air', filterType: 'bandpass', freq: 800, q: 0.5, lfo: { freq: 0.4, depth: 0.35 }, label: { th: 'เสียงลม', en: 'Wind' } },
        cafe: { icon: 'local_cafe', filterType: 'bandpass', freq: 1200, q: 0.3, lfo: { freq: 1.3, depth: 0.15 }, label: { th: 'ร้านกาแฟ', en: 'Café murmur' } }
    };

    let audioCtx = null, gainNode = null;
    let noiseNode = null, filterNode = null, modGain = null, lfoOsc = null, lfoDepthGain = null;
    let customSourceNode = null, customSourceLoadToken = 0;
    let ambientPlaying = false;

    function ensureAudioCtx() {
        if (audioCtx) return;
        audioCtx = new (global.AudioContext || global.webkitAudioContext)();
        gainNode = audioCtx.createGain();
        gainNode.gain.value = State.get().settings.ambientVolume;
        gainNode.connect(audioCtx.destination);
        audioCtx.suspend(); // start silent until the user presses play
    }

    function teardownBuiltinGraph() {
        if (noiseNode) { noiseNode.disconnect(); noiseNode.onaudioprocess = null; noiseNode = null; }
        if (filterNode) { filterNode.disconnect(); filterNode = null; }
        if (lfoOsc) { try { lfoOsc.stop(); } catch (e) { /* already stopped */ } lfoOsc.disconnect(); lfoOsc = null; }
        if (lfoDepthGain) { lfoDepthGain.disconnect(); lfoDepthGain = null; }
        if (modGain) { modGain.disconnect(); modGain = null; }
    }

    function teardownCustomSource() {
        if (customSourceNode) {
            try { customSourceNode.stop(); } catch (e) { /* already stopped */ }
            customSourceNode.disconnect();
            customSourceNode = null;
        }
    }

    function buildBuiltinGraph(cfg) {
        teardownCustomSource();
        teardownBuiltinGraph();
        modGain = audioCtx.createGain();
        modGain.gain.value = 1;
        filterNode = audioCtx.createBiquadFilter();
        noiseNode = audioCtx.createScriptProcessor(4096, 1, 1);
        let lastOut = 0;
        noiseNode.onaudioprocess = (e) => {
            const output = e.outputBuffer.getChannelData(0);
            for (let i = 0; i < output.length; i++) {
                const white = Math.random() * 2 - 1;
                lastOut = (lastOut + 0.02 * white) / 1.02;
                output[i] = lastOut * 3.5;
            }
        };
        noiseNode.connect(filterNode);
        filterNode.connect(modGain);
        modGain.connect(gainNode);

        filterNode.type = cfg.filterType;
        filterNode.frequency.value = cfg.freq;
        filterNode.Q.value = cfg.q;

        if (cfg.lfo) {
            lfoOsc = audioCtx.createOscillator();
            lfoOsc.frequency.value = cfg.lfo.freq;
            lfoDepthGain = audioCtx.createGain();
            lfoDepthGain.gain.value = cfg.lfo.depth;
            lfoOsc.connect(lfoDepthGain);
            lfoDepthGain.connect(modGain.gain);
            lfoOsc.start();
        }
    }

    async function buildCustomGraph(soundId) {
        teardownBuiltinGraph();
        teardownCustomSource();
        const token = ++customSourceLoadToken;
        try {
            const blob = await TFS.CustomSounds.getSoundBlob(soundId);
            if (!blob) throw new Error('sound_not_found');
            const arrayBuffer = await blob.arrayBuffer();
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
            if (token !== customSourceLoadToken) return; // a newer selection superseded this one mid-decode
            customSourceNode = audioCtx.createBufferSource();
            customSourceNode.buffer = audioBuffer;
            customSourceNode.loop = true;
            customSourceNode.connect(gainNode);
            customSourceNode.start(0);
        } catch (e) {
            console.warn('[focus] Could not play custom ambient sound, falling back to brown noise.', e);
            TFS.Toast.error(I18n.t('s6.ambientCustomError'));
            State.commit({ settings: { ambientType: 'brown' } });
            buildBuiltinGraph(BUILTIN_AMBIENT_TYPES.brown);
            renderAmbientUI();
            renderAmbientTypeGrid();
        }
    }

    function applyAmbientType(type) {
        ensureAudioCtx();
        if (typeof type === 'string' && type.indexOf('custom:') === 0) {
            buildCustomGraph(type.slice('custom:'.length));
        } else {
            buildBuiltinGraph(BUILTIN_AMBIENT_TYPES[type] || BUILTIN_AMBIENT_TYPES.brown);
        }
    }

    function stopAmbient() {
        if (audioCtx && ambientPlaying) audioCtx.suspend();
        ambientPlaying = false;
        renderAmbientUI();
    }

    function toggleAmbient() {
        ensureAudioCtx();
        if (!noiseNode && !customSourceNode) applyAmbientType(State.get().settings.ambientType);
        if (ambientPlaying) { audioCtx.suspend(); ambientPlaying = false; }
        else { audioCtx.resume(); ambientPlaying = true; }
        renderAmbientUI();
    }

    const ambientPlayBtn = document.getElementById('ambientPlayBtn');
    const ambientPlayIcon = document.getElementById('ambientPlayIcon');
    const ambientTypeGrid = document.getElementById('ambientTypeGrid');
    const ambientVolumeSlider = document.getElementById('ambientVolumeSlider');
    const ambientUploadInput = document.getElementById('ambientUploadInput');

    function selectAmbientType(type) {
        State.commit({ settings: { ambientType: type } });
        applyAmbientType(type);
        renderAmbientUI();
        renderAmbientTypeGrid(); // rebuild so `is-active` moves to the newly picked button
    }

    async function renderAmbientTypeGrid() {
        ambientTypeGrid.innerHTML = '';
        const currentType = State.get().settings.ambientType;

        Object.entries(BUILTIN_AMBIENT_TYPES).forEach(([key, cfg]) => {
            ambientTypeGrid.appendChild(U.el('button', {
                className: 'ambient-type-btn' + (currentType === key ? ' is-active' : ''),
                attrs: { type: 'button' },
                on: { click: () => selectAmbientType(key) }
            }, [
                U.el('span', { className: 'material-symbols-outlined', attrs: { 'aria-hidden': 'true', style: 'font-size:1.1rem' }, text: cfg.icon }),
                U.el('span', { text: I18n.pick(cfg.label) })
            ]));
        });

        if (TFS.CustomSounds.isSupported()) {
            let customSounds = [];
            try { customSounds = await TFS.CustomSounds.listSounds(); } catch (e) { /* IndexedDB unavailable — just show none */ }

            customSounds.forEach(sound => {
                const key = 'custom:' + sound.id;
                ambientTypeGrid.appendChild(U.el('button', {
                    className: 'ambient-type-btn ambient-type-btn--custom' + (currentType === key ? ' is-active' : ''),
                    attrs: { type: 'button', title: sound.name },
                    on: { click: () => selectAmbientType(key) }
                }, [
                    U.el('span', { className: 'material-symbols-outlined', attrs: { 'aria-hidden': 'true', style: 'font-size:1.1rem' }, text: 'music_note' }),
                    U.el('span', { text: sound.name, attrs: { style: 'max-width:6rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' } }),
                    U.el('span', {
                        className: 'material-symbols-outlined ambient-type-btn__remove', attrs: { 'aria-hidden': 'true', style: 'font-size:0.95rem' }, text: 'close',
                        on: { click: (e) => { e.stopPropagation(); removeCustomSound(sound.id, key, currentType); } }
                    })
                ]));
            });

            ambientTypeGrid.appendChild(U.el('button', {
                className: 'ambient-type-btn ambient-type-btn--add', attrs: { type: 'button' },
                on: { click: () => ambientUploadInput.click() }
            }, [
                U.el('span', { className: 'material-symbols-outlined', attrs: { 'aria-hidden': 'true', style: 'font-size:1.1rem' }, text: 'add' }),
                U.el('span', { text: I18n.t('s6.ambientAddCustom') })
            ]));
        }
    }

    async function removeCustomSound(soundId, key, currentType) {
        await TFS.CustomSounds.deleteSound(soundId);
        if (currentType === key) selectAmbientType('brown');
        renderAmbientTypeGrid();
    }

    ambientUploadInput.addEventListener('change', async () => {
        const file = ambientUploadInput.files[0];
        ambientUploadInput.value = '';
        if (!file) return;
        const name = file.name.replace(/\.[^/.]+$/, '').slice(0, 30) || 'Custom sound';
        try {
            const id = await TFS.CustomSounds.addSound(name, file);
            await renderAmbientTypeGrid();
            selectAmbientType('custom:' + id);
            TFS.Toast.success(I18n.t('s6.ambientUploadSuccess'));
        } catch (e) {
            console.error('[focus] Failed to store custom ambient sound', e);
            TFS.Toast.error(I18n.t('s6.ambientUploadError'));
        }
    });

    function renderAmbientUI() {
        ambientPlayIcon.textContent = ambientPlaying ? 'pause' : 'play_arrow';
        // Keep both the live attribute (for right now) and the data-i18n-attr
        // hint (so a later language switch's document-wide re-translation still
        // gets it right) in sync. `I18n.applyTranslations` only ever matches
        // *descendants* of the root passed to it via querySelectorAll, never the
        // root element itself, so it cannot be used to re-translate this button.
        const labelKey = ambientPlaying ? 'aria.pauseAmbient' : 'aria.playAmbient';
        ambientPlayBtn.setAttribute('data-i18n-attr', JSON.stringify({ 'aria-label': labelKey }));
        ambientPlayBtn.setAttribute('aria-label', I18n.t(labelKey));
        ambientVolumeSlider.value = State.get().settings.ambientVolume;
    }

    ambientPlayBtn.addEventListener('click', toggleAmbient);
    ambientVolumeSlider.addEventListener('input', () => {
        const v = parseFloat(ambientVolumeSlider.value);
        if (gainNode) gainNode.gain.value = v;
    });
    ambientVolumeSlider.addEventListener('change', () => {
        State.commit({ settings: { ambientVolume: parseFloat(ambientVolumeSlider.value) } });
    });

    // ---------------------------------------------------------------- Co-study presence (per-flight — see js/presence.js)
    //
    // "Join this flight" replaces the earlier single global room: presence
    // is now scoped to the exact flight ticketed (same duration = same
    // curated destination), so "you're on the same plane" is literally
    // true for anyone else currently seeing the same count, not just a
    // coincidence of being on the app at the same time.

    const coStudyToggleBtn = document.getElementById('coStudyToggleBtn');
    const coStudyToggleSwitch = document.getElementById('coStudyToggleSwitch');
    const coStudyCountText = document.getElementById('coStudyCountText');
    let coStudyCountIntervalId = null;

    function renderCoStudyToggle() {
        const on = State.get().settings.coStudyPublicEnabled;
        coStudyToggleSwitch.classList.toggle('is-on', on);
        coStudyToggleBtn.setAttribute('aria-pressed', String(on));
    }

    async function refreshCoStudyCount() {
        const flight = mode === 'focus' ? currentFocusFlight() : null;
        const enabled = State.get().settings.coStudyPublicEnabled;
        if (!flight || !enabled || !TFS.Presence || !TFS.Presence.isAvailable()) {
            coStudyCountText.hidden = true;
            knownFlightPassengerCount = 1; // just yourself, as flavor — see renderFlightWindows()
            renderFlightWindows(knownFlightPassengerCount);
            return;
        }
        const n = await TFS.Presence.fetchFlightCount(flight.id);
        if (!isActive()) return; // the learner navigated away while this was in flight
        if (n === null) { coStudyCountText.hidden = true; return; }

        // A heartbeat only exists once a session is actually running (see
        // start()), so `n` only counts *this* learner once they've joined —
        // before that, `n` is purely "other people already flying" and
        // needs +1 for the window/count display to read as "yourself plus
        // however many others", the same framing either way.
        const totalIncludingSelf = isRunning() ? n : n + 1;
        knownFlightPassengerCount = totalIncludingSelf;
        renderFlightWindows(knownFlightPassengerCount);

        coStudyCountText.hidden = false;
        coStudyCountText.textContent = totalIncludingSelf > 1
            ? I18n.t('s6.coStudyCountActive', { n: totalIncludingSelf - 1 })
            : I18n.t('s6.coStudyCountAlone');
    }

    coStudyToggleBtn.addEventListener('click', () => {
        const next = !State.get().settings.coStudyPublicEnabled;
        State.commit({ settings: { coStudyPublicEnabled: next } });
        renderCoStudyToggle();
        // Only actually join/leave a room if a session is running right now
        // — otherwise this just sets the preference for next time.
        const flight = mode === 'focus' ? currentFocusFlight() : null;
        if (isRunning() && flight) { next ? TFS.Presence.startHeartbeat(flight.id) : TFS.Presence.stopHeartbeat(); }
        refreshCoStudyCount();
    });

    function initCoStudyUI() {
        const available = TFS.Presence && TFS.Presence.isAvailable();
        coStudyToggleBtn.hidden = !available;
        if (!available) { coStudyCountText.hidden = true; return; }
        renderCoStudyToggle();
        refreshCoStudyCount();
        if (coStudyCountIntervalId === null) coStudyCountIntervalId = setInterval(refreshCoStudyCount, 30000);
    }

    function teardownCoStudyUI() {
        if (coStudyCountIntervalId !== null) { clearInterval(coStudyCountIntervalId); coStudyCountIntervalId = null; }
    }

    // ---------------------------------------------------------------- Wiring

    I18n.onChange(() => { if (isActive()) render(); });
    State.subscribe(() => { if (isActive()) render(); });

    TFS.Router.register('screen6', {
        onEnter: () => {
            TFS.Nav.show(); TFS.Nav.setActive('focus');
            loadRuntimeFromState();
            render();
            renderAmbientUI();
            renderAmbientTypeGrid();
            initCoStudyUI();
        },
        onLeave: () => {
            // Leaving the focus screen for another in-app screen pauses the
            // run and stops ambient audio — see the file header for why this
            // is a deliberate product choice, not the bug this file fixes.
            pause();
            stopAmbient();
            teardownCoStudyUI();
        }
    });

})(window);
