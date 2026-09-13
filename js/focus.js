/**
 * focus.js
 * Screen 6: a real Pomodoro engine (focus / short break / long break, cycling
 * automatically, durations configurable in Settings). The current phase's
 * countdown is shown as plain large digits.
 *
 * This screen used to also host a "Flight Focus"-style visual system (a
 * real satellite map, a boarding-pass check-in ritual, a seat picker, a
 * per-flight shared-presence headcount, a flight log) and, later, a set of
 * per-theme animated "gimmick" scenes — both were built and iterated on
 * earlier in this app's life and both were removed, leaving this screen a
 * plain, focused timer with no extra visual layer at all. See the git
 * history around those removals for the full reasoning, and
 * FUTURE_IDEAS.md for what, if anything, might replace them.
 *
 * Timer correctness: the countdown is timestamp-based, not a `setInterval`
 * counter. `runStartedAtMs` (when the current run segment began) and
 * `accumulatedMs` (how much of this phase had already elapsed before that
 * segment) are the only persisted source of truth; remaining time is always
 * *derived* from `Date.now() - runStartedAtMs`, never decremented tick-by-
 * tick. This matters because `setInterval` is throttled or fully suspended
 * by the browser while a tab is backgrounded or the phone is locked — a
 * counter that ticks itself down loses time exactly when it matters most.
 * Deriving from a timestamp means a reload, a locked phone, or a
 * backgrounded tab can never desync the countdown: whenever this screen is
 * next rendered, remaining time is recomputed fresh and is correct to
 * within a second, and a run that's still supposed to be going keeps going
 * (including across a full page reload) rather than silently pausing.
 *
 * Leaving screen6 for a different in-app screen still pauses the run
 * exactly as before — that's a deliberate product choice (a "focus
 * session" means being on the focus screen), not a bug.
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

    function render() {
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
        }
        persistRuntime();
    }

    function start() {
        if (isRunning()) return;
        runStartedAtMs = Date.now();
        lastCreditMs = runStartedAtMs;
        requestWakeLock();
        ensureRenderInterval();
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
        persistRuntime();
        render();
    }

    /** "Cancel" per the spec: a focus phase cut short before 5 minutes is
     *  discarded silently (the seconds already credited to today's total are
     *  subtracted back out); one cut short after 5 minutes stays credited as
     *  a partial session — no penalty copy or confirmation dialog either
     *  way. */
    function reset() {
        creditElapsedFocusTime();
        const elapsedMs = getElapsedMsInPhase();
        releaseWakeLock();
        clearRenderInterval();
        runStartedAtMs = null;
        if (mode === 'focus' && elapsedMs > 0 && elapsedMs < MIN_PARTIAL_SECONDS * 1000) {
            addSecondsToToday(-Math.floor(elapsedMs / 1000));
        }
        accumulatedMs = 0;
        persistRuntime();
        render();
    }

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

    focusStartBtn.addEventListener('click', () => { if (isRunning()) pause(); else start(); });
    focusResetBtn.addEventListener('click', reset);

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

    // ---------------------------------------------------------------- Wiring

    I18n.onChange(() => { if (isActive()) render(); });
    State.subscribe(() => { if (isActive()) render(); });

    TFS.Router.register('screen6', {
        onEnter: () => {
            TFS.Nav.show(); TFS.Nav.setActive('focus');
            loadRuntimeFromState();
            render();
        },
        onLeave: () => {
            // Leaving the focus screen for another in-app screen pauses the
            // run — see the file header for why this is a deliberate
            // product choice, not a bug.
            pause();
        }
    });

})(window);
