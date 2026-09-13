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
    const themeBtnPixel = document.getElementById('themeBtnPixel');
    const themeBtnPaper = document.getElementById('themeBtnPaper');
    const themeBtnNight = document.getElementById('themeBtnNight');
    const themeBtnMint = document.getElementById('themeBtnMint');
    const dailyGoalInput = document.getElementById('settingsDailyGoalHours');
    const examDateBtn = document.getElementById('settingsExamDateBtn');
    const examDateDisplay = document.getElementById('settingsExamDateDisplay');
    const focusMinInput = document.getElementById('settingsFocusMin');
    const shortBreakInput = document.getElementById('settingsShortBreakMin');
    const longBreakInput = document.getElementById('settingsLongBreakMin');
    const cyclesInput = document.getElementById('settingsCycles');
    const newCardsPerDayInput = document.getElementById('settingsNewCardsPerDay');
    const soundToggle = document.getElementById('settingsSoundToggle');
    const settingsAirportBtn = document.getElementById('settingsAirportBtn');
    const settingsAirportDisplay = document.getElementById('settingsAirportDisplay');
    const settingsReminderToggle = document.getElementById('settingsReminderToggle');
    const settingsReminderTimeField = document.getElementById('settingsReminderTimeField');
    const settingsReminderTime = document.getElementById('settingsReminderTime');

    function render() {
        const s = State.get();
        langBtnTh.classList.toggle('is-active', I18n.getLang() === 'th');
        langBtnEn.classList.toggle('is-active', I18n.getLang() === 'en');

        const theme = s.settings.theme;
        themeBtnPixel.classList.toggle('is-active', theme === 'pixel');
        themeBtnPaper.classList.toggle('is-active', theme === 'paper');
        themeBtnNight.classList.toggle('is-active', theme === 'night');
        themeBtnMint.classList.toggle('is-active', theme === 'mint');
        if (openThemeCollectionBtnLabel && TFS.Themes) openThemeCollectionBtnLabel.textContent = I18n.pick(TFS.Themes.currentDefinition().collectionName);

        dailyGoalInput.value = (s.plan.dailyGoalSeconds / 3600).toFixed(1).replace(/\.0$/, '');
        examDateDisplay.textContent = s.plan.examDateISO ? I18n.formatDate(U.parseISODate(s.plan.examDateISO)) : I18n.t('s2.examDatePlaceholder');

        focusMinInput.value = s.settings.pomodoro.focusMin;
        shortBreakInput.value = s.settings.pomodoro.shortBreakMin;
        longBreakInput.value = s.settings.pomodoro.longBreakMin;
        cyclesInput.value = s.settings.pomodoro.cyclesBeforeLongBreak;
        newCardsPerDayInput.value = s.flashcards.newCardsPerDayLimit;

        soundToggle.querySelector('.switch').classList.toggle('is-on', s.settings.soundEnabled);
        soundToggle.setAttribute('aria-pressed', String(s.settings.soundEnabled));

        const airport = (TFS.Geo && TFS.Geo.airportById(s.settings.departureAirportId)) || (TFS.AIRPORTS && TFS.AIRPORTS[0]);
        if (settingsAirportDisplay && airport) settingsAirportDisplay.textContent = `${I18n.pick(airport.name)} (${airport.code})`;

        const reminderOn = !!s.settings.dailyReminderTime;
        if (settingsReminderToggle) {
            settingsReminderToggle.querySelector('.switch').classList.toggle('is-on', reminderOn);
            settingsReminderToggle.setAttribute('aria-pressed', String(reminderOn));
        }
        if (settingsReminderTimeField) settingsReminderTimeField.hidden = !reminderOn;
        if (settingsReminderTime) settingsReminderTime.value = s.settings.dailyReminderTime || '09:00';

        const onCloudAccount = TFS.Auth && TFS.Auth.isEnabled() && TFS.Auth.isCloudProfileId(TFS.Storage.getActiveProfileId());
        document.getElementById('settingsLogoutBtn').hidden = !onCloudAccount;
    }

    document.querySelectorAll('.js-open-settings').forEach(btn => {
        btn.addEventListener('click', () => { render(); TFS.Modal.open(settingsModal); });
    });
    document.getElementById('closeSettingsBtn').addEventListener('click', () => TFS.Modal.close(settingsModal));

    langBtnTh.addEventListener('click', () => { I18n.setLanguage('th'); render(); });
    langBtnEn.addEventListener('click', () => { I18n.setLanguage('en'); render(); });

    themeBtnPixel.addEventListener('click', () => { TFS.Theme.setTheme('pixel'); render(); });
    themeBtnPaper.addEventListener('click', () => { TFS.Theme.setTheme('paper'); render(); });
    themeBtnNight.addEventListener('click', () => { TFS.Theme.setTheme('night'); render(); });
    themeBtnMint.addEventListener('click', () => { TFS.Theme.setTheme('mint'); render(); });

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

    newCardsPerDayInput.addEventListener('change', () => {
        let val = parseInt(newCardsPerDayInput.value, 10);
        if (!isFinite(val)) val = 20;
        val = U.clamp(val, 1, 200);
        State.commit({ flashcards: { newCardsPerDayLimit: val } });
        render();
    });

    soundToggle.addEventListener('click', () => {
        State.commit({ settings: { soundEnabled: !State.get().settings.soundEnabled } });
        render();
    });

    // ---------------------------------------------------------------- Daily reminder (js/reminder.js)

    if (settingsReminderToggle) {
        settingsReminderToggle.addEventListener('click', async () => {
            const turningOn = !State.get().settings.dailyReminderTime;
            if (turningOn) {
                // Must be requested from this click — a real user gesture —
                // or the browser refuses the permission prompt outright.
                const result = TFS.Reminder ? await TFS.Reminder.requestPermission() : 'unsupported';
                if (result === 'denied') { TFS.Toast.warn(I18n.t('settings.reminderDenied')); return; }
                State.commit({ settings: { dailyReminderTime: settingsReminderTime.value || '09:00' } });
            } else {
                State.commit({ settings: { dailyReminderTime: null } });
            }
            render();
        });
    }
    if (settingsReminderTime) {
        settingsReminderTime.addEventListener('change', () => {
            if (!State.get().settings.dailyReminderTime) return; // only meaningful once actually enabled
            State.commit({ settings: { dailyReminderTime: settingsReminderTime.value || '09:00' } });
        });
    }

    // ---------------------------------------------------------------- Change name / nickname
    // Works for both a real account (Firebase Auth profile + the mirrored
    // Firestore doc) and a local guest profile (just its entry in
    // storage.js's profiles index) — whichever is active.
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

    // ---------------------------------------------------------------- Departure airport (data/airports.js, js/geo.js)
    // Purely cosmetic (which real city the flight visual/boarding pass's
    // distance start from) — changing it any time is fine, unlike the
    // reference video's "locked once chosen" version, since nothing here
    // depends on it staying fixed.

    const airportPickerModal = document.getElementById('airportPickerModal');
    const airportListContainer = document.getElementById('airportListContainer');
    const airportSearchInput = document.getElementById('airportSearchInput');

    function selectAirport(airport) {
        if (!airport) return;
        State.commit({ settings: { departureAirportId: airport.id } });
        render();
        TFS.Modal.close(airportPickerModal);
        TFS.Toast.success(I18n.t('modalAirportPicker.selectedToast', { code: airport.code }));
    }

    function renderAirportList() {
        if (!airportListContainer) return;
        const query = (airportSearchInput.value || '').trim().toLowerCase();
        const currentId = State.get().settings.departureAirportId;
        airportListContainer.innerHTML = '';
        (TFS.AIRPORTS || [])
            .filter((a) => !query || a.code.toLowerCase().includes(query) || I18n.pick(a.name).toLowerCase().includes(query))
            .forEach((a) => {
                const isCurrent = a.id === currentId;
                airportListContainer.appendChild(U.el('button', {
                    className: 'search-result-item w-full',
                    attrs: { type: 'button', style: `border:2px solid ${isCurrent ? 'var(--color-primary)' : 'transparent'};background:${isCurrent ? 'var(--color-primary-fixed)' : 'var(--color-surface-lowest)'}` },
                    on: { click: () => selectAirport(a) }
                }, [
                    U.el('span', { className: 'flex items-center gap-3' }, [
                        U.el('span', { className: 'material-symbols-outlined text-primary', attrs: { 'aria-hidden': 'true' }, text: 'flight_takeoff' }),
                        U.el('span', {}, [
                            U.el('h3', { attrs: { style: 'font-weight:700;font-size:0.875rem' }, text: I18n.pick(a.name) }),
                            U.el('p', { className: 'text-outline', attrs: { style: 'font-size:0.6875rem' }, text: a.code })
                        ])
                    ]),
                    isCurrent ? U.el('span', { className: 'material-symbols-outlined text-primary', attrs: { 'aria-hidden': 'true' }, text: 'check_circle' }) : document.createTextNode('')
                ]));
            });
    }

    if (settingsAirportBtn) {
        settingsAirportBtn.addEventListener('click', () => {
            airportSearchInput.value = '';
            renderAirportList();
            TFS.Modal.open(airportPickerModal);
        });
    }
    if (airportSearchInput) airportSearchInput.addEventListener('input', renderAirportList);
    const closeAirportPickerBtn = document.getElementById('closeAirportPickerBtn');
    if (closeAirportPickerBtn) closeAirportPickerBtn.addEventListener('click', () => TFS.Modal.close(airportPickerModal));

    const airportUseRandomBtn = document.getElementById('airportUseRandomBtn');
    if (airportUseRandomBtn) {
        airportUseRandomBtn.addEventListener('click', () => selectAirport(TFS.Geo && TFS.Geo.randomAirport()));
    }
    const airportUseLocationBtn = document.getElementById('airportUseLocationBtn');
    if (airportUseLocationBtn) {
        airportUseLocationBtn.addEventListener('click', () => {
            if (!TFS.Geo) return;
            airportUseLocationBtn.disabled = true;
            TFS.Geo.nearestAirportFromDevice()
                .then((airport) => selectAirport(airport))
                .catch(() => TFS.Toast.warn(I18n.t('modalAirportPicker.locationDenied')))
                .finally(() => { airportUseLocationBtn.disabled = false; });
        });
    }

    // ---------------------------------------------------------------- Theme collection page (Phase 8, js/themes.js)

    const themeCollectionModal = document.getElementById('themeCollectionModal');
    const themeCollectionTitle = document.getElementById('themeCollectionTitle');
    const themeCollectionBody = document.getElementById('themeCollectionBody');
    const openThemeCollectionBtn = document.getElementById('openThemeCollectionBtn');
    const openThemeCollectionBtnLabel = document.getElementById('openThemeCollectionBtnLabel');
    const closeThemeCollectionBtn = document.getElementById('closeThemeCollectionBtn');

    // The label itself (named for the active theme, e.g. "View My Garden"
    // for Mint) is kept current by render() above, called both on every
    // theme switch and every time Settings is opened — no separate
    // language-change listener needed for just this one label.
    if (openThemeCollectionBtn) {
        openThemeCollectionBtn.addEventListener('click', () => {
            if (!TFS.Themes) return;
            const def = TFS.Themes.currentDefinition();
            if (themeCollectionTitle) themeCollectionTitle.querySelector('span:last-child').textContent = I18n.pick(def.collectionName);
            // Cleared here (not left to each gimmick) so a theme whose
            // collection isn't built yet can never leave a *different*
            // theme's leftover content on screen — same reasoning as
            // js/focus.js's refreshThemeGimmickScene().
            themeCollectionBody.innerHTML = '';
            try { TFS.Themes.currentGimmick().renderCollection(themeCollectionBody); }
            catch (e) { console.error('[settings] Theme collection failed to render.', e); }
            TFS.Modal.open(themeCollectionModal);
        });
    }
    if (closeThemeCollectionBtn) closeThemeCollectionBtn.addEventListener('click', () => TFS.Modal.close(themeCollectionModal));

    I18n.onChange(() => { if (TFS.Modal.isOpen(settingsModal)) render(); });

    TFS.Settings = { render };

})(window);
