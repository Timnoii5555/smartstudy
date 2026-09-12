/**
 * focus.js
 * Screen 6: a real Pomodoro engine (focus / short break / long break, cycling
 * automatically, durations configurable in Settings) plus a generated
 * ambient-noise player. The progress ring still tracks the *daily* study
 * goal (total focus seconds accumulated today vs. the daily goal), while the
 * big numeric readout counts down the current Pomodoro phase.
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
            if (State.get().settings.coStudyPublicEnabled && TFS.Presence && TFS.Presence.isAvailable()) TFS.Presence.startHeartbeat();
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
    // when the learner comes back to a still-running session.
    document.addEventListener('visibilitychange', () => {
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
    });

    // ---------------------------------------------------------------- DOM refs

    const focusTimerDisplay = document.getElementById('focusTimerDisplay');
    const focusTimerRing = document.getElementById('focusTimerRing');
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
        const totalToday = getTotalToday();
        const goal = State.get().plan.dailyGoalSeconds;
        let progress = goal > 0 ? totalToday / goal : 0;
        progress = U.clamp(progress, 0, 1);
        focusTimerRing.setAttribute('stroke-dashoffset', String(100 - progress * 100));

        focusTimerDisplay.textContent = U.formatSecondsToHMS(getRemainingSeconds());
        focusPhaseLabel.textContent = I18n.t(PHASE_KEY[mode]);
        const cycles = pomodoroSettings().cyclesBeforeLongBreak;
        const currentCycle = (cyclesCompletedToday % cycles) + 1;
        focusCycleLabel.textContent = I18n.t('s6.cycleLabel', { current: currentCycle, total: cycles });

        displayFocusGoal.textContent = U.formatSecondsToHHMM(goal);
        focusTodayHours.textContent = U.formatSecondsToHHMM(totalToday);
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

    function tick() {
        creditElapsedFocusTime();
        if (isRunning() && getRemainingSeconds() <= 0) completePhase();
        render();
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
        if (isRunning()) { runStartedAtMs = Date.now(); lastCreditMs = runStartedAtMs; }
        persistRuntime();
    }

    function start() {
        if (isRunning()) return;
        runStartedAtMs = Date.now();
        lastCreditMs = runStartedAtMs;
        requestWakeLock();
        ensureRenderInterval();
        if (State.get().settings.coStudyPublicEnabled && TFS.Presence && TFS.Presence.isAvailable()) TFS.Presence.startHeartbeat();
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

    // ---------------------------------------------------------------- Co-study presence (public room only — see js/presence.js)

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
        const n = await TFS.Presence.fetchCount();
        if (!isActive()) return; // the learner navigated away while this was in flight
        if (n === null) { coStudyCountText.hidden = true; return; }
        coStudyCountText.hidden = false;
        coStudyCountText.textContent = n > 0 ? I18n.t('s6.coStudyCountActive', { n }) : I18n.t('s6.coStudyCountAlone');
    }

    coStudyToggleBtn.addEventListener('click', () => {
        const next = !State.get().settings.coStudyPublicEnabled;
        State.commit({ settings: { coStudyPublicEnabled: next } });
        renderCoStudyToggle();
        // Only actually join/leave the count if a session is running right
        // now — otherwise this just sets the preference for next time.
        if (isRunning()) { next ? TFS.Presence.startHeartbeat() : TFS.Presence.stopHeartbeat(); }
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
