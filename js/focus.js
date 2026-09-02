/**
 * focus.js
 * Screen 6: a real Pomodoro engine (focus / short break / long break, cycling
 * automatically, durations configurable in Settings) plus a generated
 * ambient-noise player. The progress ring still tracks the *daily* study
 * goal (total focus seconds accumulated today vs. the daily goal), while the
 * big numeric readout counts down the current Pomodoro phase.
 *
 * Fixes bug 1.2: the interval is only ever running while this screen is the
 * active one. Leaving the screen (router teardown) pauses the countdown and
 * suspends any ambient sound instead of letting them keep running invisibly.
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
    function durationForMode(mode) {
        const p = pomodoroSettings();
        if (mode === 'shortBreak') return p.shortBreakMin * 60;
        if (mode === 'longBreak') return p.longBreakMin * 60;
        return p.focusMin * 60;
    }
    function getTotalToday() { return State.get().focus.totalSecondsByDate[todayISO()] || 0; }

    // ---- Runtime engine state (mode/remaining/cycles ARE persisted so a reload
    // resumes where you left off; `isRunning` is deliberately NOT persisted —
    // every reload/re-entry starts paused, see bug 1.2 rationale above). ----
    let mode = 'focus';
    let phaseRemainingSeconds = durationForMode('focus');
    let cyclesCompletedToday = 0;
    let isRunning = false;
    let intervalId = null;

    function loadRuntimeFromState() {
        const f = State.get().focus;
        const today = todayISO();
        if (f.lastActiveDateISO !== today) {
            // A new day: cycle count and phase restart fresh, but totalSecondsByDate
            // is keyed by date already so past days are naturally preserved untouched.
            mode = 'focus';
            cyclesCompletedToday = 0;
            phaseRemainingSeconds = durationForMode('focus');
            State.commit({ focus: { lastActiveDateISO: today, mode, cyclesCompletedToday, phaseRemainingSeconds } });
        } else {
            mode = f.mode || 'focus';
            cyclesCompletedToday = f.cyclesCompletedToday || 0;
            phaseRemainingSeconds = (typeof f.phaseRemainingSeconds === 'number') ? f.phaseRemainingSeconds : durationForMode(mode);
        }
    }

    function persistRuntime() {
        State.commit({ focus: { mode, cyclesCompletedToday, phaseRemainingSeconds, lastActiveDateISO: todayISO() } });
    }

    function addSecondsToToday(n) {
        const today = todayISO();
        const totals = { ...State.get().focus.totalSecondsByDate };
        totals[today] = Math.max(0, (totals[today] || 0) + n);
        State.commit({ focus: { totalSecondsByDate: totals } });
    }

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
        focusTimerRing.style.strokeDashoffset = String(100 - progress * 100);

        focusTimerDisplay.textContent = U.formatSecondsToHMS(phaseRemainingSeconds);
        focusPhaseLabel.textContent = I18n.t(PHASE_KEY[mode]);
        const cycles = pomodoroSettings().cyclesBeforeLongBreak;
        const currentCycle = (cyclesCompletedToday % cycles) + 1;
        focusCycleLabel.textContent = I18n.t('s6.cycleLabel', { current: currentCycle, total: cycles });

        displayFocusGoal.textContent = U.formatSecondsToHHMM(goal);
        focusTodayHours.textContent = U.formatSecondsToHHMM(totalToday);
        focusGoalHours.textContent = U.formatSecondsToHHMM(goal);

        if (isRunning) {
            focusStartBtnIcon.textContent = 'pause';
            focusStartBtnText.textContent = I18n.t('s6.pause');
        } else {
            focusStartBtnIcon.textContent = 'play_arrow';
            const full = durationForMode(mode);
            focusStartBtnText.textContent = (phaseRemainingSeconds < full) ? I18n.t('s6.resume') : I18n.t('s6.start');
        }

        renderSoundToggle();
    }

    function tick() {
        phaseRemainingSeconds--;
        if (mode === 'focus') addSecondsToToday(1);

        if (phaseRemainingSeconds <= 0) completePhase();
        persistRuntime();
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
        phaseRemainingSeconds = durationForMode(mode);
    }

    function start() {
        if (isRunning) return;
        isRunning = true;
        intervalId = setInterval(tick, 1000);
        render();
    }

    function pause() {
        if (!isRunning) return;
        clearInterval(intervalId);
        intervalId = null;
        isRunning = false;
        persistRuntime();
        render();
    }

    function reset() {
        pause();
        if (mode === 'focus') {
            const elapsed = durationForMode('focus') - phaseRemainingSeconds;
            if (elapsed > 0) addSecondsToToday(-elapsed);
        }
        phaseRemainingSeconds = durationForMode(mode);
        persistRuntime();
        render();
    }

    focusStartBtn.addEventListener('click', () => { isRunning ? pause() : start(); });
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
        if (isRunning) { TFS.Toast.warn(I18n.t('errors.stopTimerFirst')); return; }
        if (!goalWheelsBuilt) {
            WP.createItems(hoursWheel, 24, false);
            WP.createItems(minutesWheel, 59, true);
            WP.attachScrollSync(hoursWheel);
            WP.attachScrollSync(minutesWheel);
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
    let audioCtx = null, noiseNode = null, filterNode = null, gainNode = null;
    let ambientPlaying = false;

    function ensureAmbientGraph() {
        if (audioCtx) return;
        audioCtx = new (global.AudioContext || global.webkitAudioContext)();
        gainNode = audioCtx.createGain();
        gainNode.gain.value = State.get().settings.ambientVolume;
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
        filterNode.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        applyAmbientType(State.get().settings.ambientType);
        audioCtx.suspend(); // start silent until the user presses play
    }

    function applyAmbientType(type) {
        if (!filterNode) return;
        if (type === 'rain') { filterNode.type = 'bandpass'; filterNode.frequency.value = 2500; filterNode.Q.value = 0.7; }
        else { filterNode.type = 'lowpass'; filterNode.frequency.value = 400; filterNode.Q.value = 0.7; }
    }

    function stopAmbient() {
        if (audioCtx && ambientPlaying) audioCtx.suspend();
        ambientPlaying = false;
        renderAmbientUI();
    }

    function toggleAmbient() {
        ensureAmbientGraph();
        if (ambientPlaying) { audioCtx.suspend(); ambientPlaying = false; }
        else { audioCtx.resume(); ambientPlaying = true; }
        renderAmbientUI();
    }

    const ambientPlayBtn = document.getElementById('ambientPlayBtn');
    const ambientPlayIcon = document.getElementById('ambientPlayIcon');
    const ambientTypeBrown = document.getElementById('ambientTypeBrown');
    const ambientTypeRain = document.getElementById('ambientTypeRain');
    const ambientVolumeSlider = document.getElementById('ambientVolumeSlider');

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
        const type = State.get().settings.ambientType;
        ambientTypeBrown.classList.toggle('is-active', type === 'brown');
        ambientTypeRain.classList.toggle('is-active', type === 'rain');
        ambientVolumeSlider.value = State.get().settings.ambientVolume;
    }

    ambientPlayBtn.addEventListener('click', toggleAmbient);
    ambientTypeBrown.addEventListener('click', () => { State.commit({ settings: { ambientType: 'brown' } }); applyAmbientType('brown'); renderAmbientUI(); });
    ambientTypeRain.addEventListener('click', () => { State.commit({ settings: { ambientType: 'rain' } }); applyAmbientType('rain'); renderAmbientUI(); });
    ambientVolumeSlider.addEventListener('input', () => {
        const v = parseFloat(ambientVolumeSlider.value);
        if (gainNode) gainNode.gain.value = v;
    });
    ambientVolumeSlider.addEventListener('change', () => {
        State.commit({ settings: { ambientVolume: parseFloat(ambientVolumeSlider.value) } });
    });

    // ---------------------------------------------------------------- Wiring

    I18n.onChange(() => { if (isActive()) render(); });
    State.subscribe(() => { if (isActive()) render(); });

    TFS.Router.register('screen6', {
        onEnter: () => {
            TFS.Nav.show(); TFS.Nav.setActive('focus');
            loadRuntimeFromState();
            render();
            renderAmbientUI();
        },
        onLeave: () => {
            // Bug 1.2: never let the Pomodoro countdown or ambient audio keep
            // running once the user has navigated away from this screen.
            pause();
            stopAmbient();
        }
    });

})(window);
