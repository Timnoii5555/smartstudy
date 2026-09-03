/**
 * settings.js
 * The Settings panel: language, theme, daily goal, exam date, Pomodoro
 * durations, sound, account, reading history and feedback. Reachable from
 * the settings icon on screens 3, 4 and 6 via the shared `.js-open-settings`
 * class, so there is one implementation instead of one per screen.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};
    const U = TFS.Utils;
    const I18n = TFS.I18n;
    const State = TFS.State;

    const settingsModal = document.getElementById('settingsModal');
    const langBtnTh = document.getElementById('langBtnTh');
    const langBtnEn = document.getElementById('langBtnEn');
    const themeBtnLight = document.getElementById('themeBtnLight');
    const themeBtnDark = document.getElementById('themeBtnDark');
    const themeBtnSystem = document.getElementById('themeBtnSystem');
    const dailyGoalInput = document.getElementById('settingsDailyGoalHours');
    const examDateBtn = document.getElementById('settingsExamDateBtn');
    const examDateDisplay = document.getElementById('settingsExamDateDisplay');
    const focusMinInput = document.getElementById('settingsFocusMin');
    const shortBreakInput = document.getElementById('settingsShortBreakMin');
    const longBreakInput = document.getElementById('settingsLongBreakMin');
    const cyclesInput = document.getElementById('settingsCycles');
    const soundToggle = document.getElementById('settingsSoundToggle');

    function render() {
        const s = State.get();
        langBtnTh.classList.toggle('is-active', I18n.getLang() === 'th');
        langBtnEn.classList.toggle('is-active', I18n.getLang() === 'en');

        const theme = s.settings.theme;
        themeBtnLight.classList.toggle('is-active', theme === 'light');
        themeBtnDark.classList.toggle('is-active', theme === 'dark');
        themeBtnSystem.classList.toggle('is-active', theme === 'system');

        dailyGoalInput.value = (s.plan.dailyGoalSeconds / 3600).toFixed(1).replace(/\.0$/, '');
        examDateDisplay.textContent = s.plan.examDateISO ? I18n.formatDate(U.parseISODate(s.plan.examDateISO)) : I18n.t('s2.examDatePlaceholder');

        focusMinInput.value = s.settings.pomodoro.focusMin;
        shortBreakInput.value = s.settings.pomodoro.shortBreakMin;
        longBreakInput.value = s.settings.pomodoro.longBreakMin;
        cyclesInput.value = s.settings.pomodoro.cyclesBeforeLongBreak;

        soundToggle.querySelector('.switch').classList.toggle('is-on', s.settings.soundEnabled);
        soundToggle.setAttribute('aria-pressed', String(s.settings.soundEnabled));

        const onCloudAccount = TFS.Auth && TFS.Auth.isEnabled() && TFS.Auth.isCloudProfileId(TFS.Storage.getActiveProfileId());
        document.getElementById('settingsLogoutBtn').hidden = !onCloudAccount;
    }

    document.querySelectorAll('.js-open-settings').forEach(btn => {
        btn.addEventListener('click', () => { render(); TFS.Modal.open(settingsModal); });
    });
    document.getElementById('closeSettingsBtn').addEventListener('click', () => TFS.Modal.close(settingsModal));

    langBtnTh.addEventListener('click', () => { I18n.setLanguage('th'); render(); });
    langBtnEn.addEventListener('click', () => { I18n.setLanguage('en'); render(); });

    themeBtnLight.addEventListener('click', () => { TFS.Theme.setTheme('light'); render(); });
    themeBtnDark.addEventListener('click', () => { TFS.Theme.setTheme('dark'); render(); });
    themeBtnSystem.addEventListener('click', () => { TFS.Theme.setTheme('system'); render(); });

    dailyGoalInput.addEventListener('change', () => {
        let hrs = parseFloat(dailyGoalInput.value);
        if (!isFinite(hrs) || hrs <= 0) { TFS.Toast.warn(I18n.t('errors.setGoalMin')); render(); return; }
        hrs = U.clamp(hrs, 0.5, 16);
        State.commit({ plan: { dailyGoalSeconds: Math.round(hrs * 3600) } });
        render();
    });

    examDateBtn.addEventListener('click', () => {
        TFS.DatePicker.open({
            initialISO: State.get().plan.examDateISO,
            onSelect: (iso) => { State.commit({ plan: { examDateISO: iso } }); render(); }
        });
    });

    function commitPomodoroField(field, input, min, max) {
        let val = parseInt(input.value, 10);
        if (!isFinite(val)) val = min;
        val = U.clamp(val, min, max);
        State.commit({ settings: { pomodoro: { [field]: val } } });
        render();
    }
    focusMinInput.addEventListener('change', () => commitPomodoroField('focusMin', focusMinInput, 1, 180));
    shortBreakInput.addEventListener('change', () => commitPomodoroField('shortBreakMin', shortBreakInput, 1, 60));
    longBreakInput.addEventListener('change', () => commitPomodoroField('longBreakMin', longBreakInput, 1, 120));
    cyclesInput.addEventListener('change', () => commitPomodoroField('cyclesBeforeLongBreak', cyclesInput, 1, 12));

    soundToggle.addEventListener('click', () => {
        State.commit({ settings: { soundEnabled: !State.get().settings.soundEnabled } });
        render();
    });

    // ---------------------------------------------------------------- Change name / nickname
    // Works for both a real account (Firebase Auth profile + the mirrored
    // Firestore doc the leaderboard reads) and a local guest profile (just
    // its entry in storage.js's profiles index) — whichever is active.
    const renameModal = document.getElementById('renameModal');
    const renameInput = document.getElementById('renameInput');
    const renameAvatarField = document.getElementById('renameAvatarField');
    const renameAvatarPickBtn = document.getElementById('renameAvatarPickBtn');
    const renameAvatarInput = document.getElementById('renameAvatarInput');
    const renameAvatarPreview = document.getElementById('renameAvatarPreview');
    const renameAvatarPlaceholder = document.getElementById('renameAvatarPlaceholder');
    let pendingRenameAvatarFile = null;

    function currentDisplayName() {
        const activeId = TFS.Storage.getActiveProfileId();
        if (TFS.Auth && TFS.Auth.isEnabled() && TFS.Auth.isCloudProfileId(activeId)) {
            const user = TFS.Auth.getCurrentUser();
            return (user && user.displayName) || '';
        }
        const profile = TFS.Storage.listProfiles().find(p => p.id === activeId);
        return profile ? profile.name : '';
    }

    renameAvatarPickBtn.addEventListener('click', () => renameAvatarInput.click());
    renameAvatarInput.addEventListener('change', () => {
        const file = renameAvatarInput.files[0];
        if (!file) return;
        pendingRenameAvatarFile = file;
        renameAvatarPreview.src = URL.createObjectURL(file);
        renameAvatarPreview.hidden = false;
        renameAvatarPlaceholder.hidden = true;
    });

    document.getElementById('settingsRenameBtn').addEventListener('click', async () => {
        TFS.Modal.close(settingsModal);
        const isCloud = TFS.Auth && TFS.Auth.isEnabled() && TFS.Auth.isCloudProfileId(TFS.Storage.getActiveProfileId());
        renameInput.value = currentDisplayName();
        pendingRenameAvatarFile = null;
        renameAvatarField.hidden = !isCloud;
        renameAvatarPreview.hidden = true;
        renameAvatarPlaceholder.hidden = false;
        setTimeout(() => TFS.Modal.open(renameModal), 200);
        // Firestore is the only place the avatar lives (Firebase Auth's own
        // profile isn't used for it here) — fetch it after opening so the
        // modal doesn't wait on a network round-trip to appear.
        if (isCloud) {
            try {
                const profile = await TFS.Auth.getOwnProfile();
                if (profile && profile.avatarURL && !pendingRenameAvatarFile) {
                    renameAvatarPreview.src = profile.avatarURL;
                    renameAvatarPreview.hidden = false;
                    renameAvatarPlaceholder.hidden = true;
                }
            } catch (e) { console.warn('[settings] Could not load current avatar', e); }
        }
    });
    document.getElementById('closeRenameBtn').addEventListener('click', () => TFS.Modal.close(renameModal));
    document.getElementById('saveRenameBtn').addEventListener('click', async () => {
        const name = renameInput.value.trim();
        if (!name) { TFS.Toast.warn(I18n.t('s0.errName')); return; }
        const activeId = TFS.Storage.getActiveProfileId();
        try {
            if (TFS.Auth && TFS.Auth.isEnabled() && TFS.Auth.isCloudProfileId(activeId)) {
                await TFS.Auth.updateDisplayName(name);
                if (pendingRenameAvatarFile) await TFS.Auth.updateAvatar(pendingRenameAvatarFile);
            } else {
                TFS.Storage.renameProfile(activeId, name);
            }
            TFS.Toast.success(I18n.t('modalRename.success'));
            TFS.Modal.close(renameModal);
        } catch (e) {
            console.error('[settings] Rename failed', e);
            TFS.Toast.error(I18n.t('modalAuth.errGeneric'));
        }
    });

    document.getElementById('settingsSwitchProfileBtn').addEventListener('click', () => {
        TFS.Modal.close(settingsModal);
        TFS.Router.show('screen0');
    });
    document.getElementById('settingsLogoutBtn').addEventListener('click', async () => {
        try { await TFS.Auth.logOut(); } catch (e) { console.error('[settings] Sign-out failed', e); }
        TFS.Storage.setActiveProfileId(null);
        global.location.reload();
    });

    // ---------------------------------------------------------------- Bug/feedback report
    // No backend to receive this, so it hands off to the user's own email client
    // via a mailto: link — zero infrastructure, works offline-authored, and the
    // learner can review/edit the message before it actually sends anything.
    const REPORT_EMAIL = 'pupe15625@gmail.com';
    const reportModal = document.getElementById('reportModal');
    const reportTextarea = document.getElementById('reportTextarea');

    document.getElementById('settingsReportBtn').addEventListener('click', () => {
        TFS.Modal.close(settingsModal);
        reportTextarea.value = '';
        setTimeout(() => TFS.Modal.open(reportModal), 200);
    });
    document.getElementById('closeReportBtn').addEventListener('click', () => TFS.Modal.close(reportModal));
    document.getElementById('sendReportBtn').addEventListener('click', () => {
        const body = reportTextarea.value.trim();
        if (!body) { TFS.Toast.warn(I18n.t('modalReport.errEmpty')); return; }
        const subject = encodeURIComponent('SmartStudy — Bug report / suggestion');
        const mailto = `mailto:${REPORT_EMAIL}?subject=${subject}&body=${encodeURIComponent(body)}`;
        global.location.href = mailto;
        TFS.Modal.close(reportModal);
    });

    I18n.onChange(() => { if (TFS.Modal.isOpen(settingsModal)) render(); });

    TFS.Settings = { render };

})(window);
