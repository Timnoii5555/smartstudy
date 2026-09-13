/**
 * pilotClub.js
 * "Mine" — a flight-themed profile hub on screen 6 (a membership card for
 * delight, the map-style/scenario preferences, and the flight log written
 * by js/focus.js's logFlight()). Full Settings stays the real control
 * panel for everything else; the gear icon here just jumps to it, the same
 * "Mine ⚙️" pairing the reference video itself uses.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};
    const U = TFS.Utils;
    const I18n = TFS.I18n;
    const State = TFS.State;

    const pilotClubModal = document.getElementById('pilotClubModal');
    const openPilotClubBtn = document.getElementById('openPilotClubBtn');
    const closePilotClubBtn = document.getElementById('closePilotClubBtn');
    const openSettingsFromClubBtn = document.getElementById('openSettingsFromClubBtn');
    const pilotCardMemberName = document.getElementById('pilotCardMemberName');
    const clubMapStyleRow = document.getElementById('clubMapStyleRow');
    const pilotCardScenarios = document.getElementById('pilotCardScenarios');
    const flightLogContainer = document.getElementById('flightLogContainer');
    const flightLogEmpty = document.getElementById('flightLogEmpty');

    const MAP_STYLE_META = {
        satellite: { icon: 'satellite_alt', labelKey: 'modalPilotClub.styleSatellite' },
        standard: { icon: 'map', labelKey: 'modalPilotClub.styleStandard' },
        monochrome: { icon: 'tonality', labelKey: 'modalPilotClub.styleMonochrome' }
    };

    /** Whatever name is already shown elsewhere for the active profile —
     *  a real account's display name, or a local guest profile's name. */
    function currentDisplayName() {
        const activeId = TFS.Storage.getActiveProfileId();
        if (TFS.Auth && TFS.Auth.isEnabled() && TFS.Auth.isCloudProfileId(activeId)) {
            const user = TFS.Auth.getCurrentUser();
            return (user && user.displayName) || '';
        }
        const profile = TFS.Storage.listProfiles().find((p) => p.id === activeId);
        return profile ? profile.name : '';
    }

    function renderMapStyleRow() {
        if (!clubMapStyleRow || !TFS.Focus) return;
        clubMapStyleRow.innerHTML = '';
        const current = State.get().settings.mapStyle;
        TFS.Focus.MAP_STYLE_KEYS.forEach((key) => {
            const meta = MAP_STYLE_META[key];
            if (!meta) return;
            const isSelected = key === current;
            clubMapStyleRow.appendChild(U.el('button', {
                className: 'pilot-card__style-btn' + (isSelected ? ' is-selected' : ''),
                attrs: { type: 'button', role: 'radio', 'aria-checked': String(isSelected) },
                on: { click: () => { State.commit({ settings: { mapStyle: key } }); renderMapStyleRow(); } }
            }, [
                U.el('span', { className: 'material-symbols-outlined', attrs: { 'aria-hidden': 'true' }, text: meta.icon }),
                U.el('span', { text: I18n.t(meta.labelKey) })
            ]));
        });
    }

    function renderScenarios() {
        if (!pilotCardScenarios || !TFS.Focus) return;
        pilotCardScenarios.innerHTML = '';
        TFS.Focus.SCENARIOS.forEach((sc) => {
            pilotCardScenarios.appendChild(U.el('span', { className: 'pilot-card__scenario-chip' }, [
                U.el('span', { className: 'material-symbols-outlined', attrs: { 'aria-hidden': 'true' }, text: sc.icon }),
                U.el('span', { text: I18n.pick(sc.label) })
            ]));
        });
    }

    function scenarioIcon(scenarioId) {
        const found = TFS.Focus && TFS.Focus.SCENARIOS.find((s) => s.id === scenarioId);
        return found ? found.icon : 'hub';
    }

    function renderFlightLog() {
        if (!flightLogContainer) return;
        const log = State.get().focus.flightLog || [];
        flightLogContainer.innerHTML = '';
        if (flightLogEmpty) flightLogEmpty.hidden = log.length > 0;
        // Most recent first — the array itself is oldest-first (append-only).
        [...log].reverse().forEach((entry) => {
            flightLogContainer.appendChild(U.el('div', { className: 'flight-log-entry' }, [
                U.el('div', {}, [
                    U.el('div', { className: 'flight-log-entry__route' }, [
                        U.el('span', { className: 'material-symbols-outlined', attrs: { 'aria-hidden': 'true' }, text: scenarioIcon(entry.scenarioId) }),
                        U.el('span', { text: `${entry.originCode} → ${entry.destCode}` })
                    ]),
                    U.el('div', { className: 'flight-log-entry__meta', text: `${entry.destName} · ${I18n.formatDate(U.parseISODate(entry.dateISO))}${entry.seat ? ' · ' + I18n.t('modalSeatPicker.seatLabel', { seat: entry.seat }) : ''}` })
                ]),
                U.el('span', { className: 'flight-log-entry__mins', text: I18n.t('s6.flightMinutes', { n: entry.minutes }) })
            ]));
        });
    }

    function render() {
        if (pilotCardMemberName) pilotCardMemberName.textContent = currentDisplayName() || I18n.t('modalPilotClub.guestMember');
        renderMapStyleRow();
        renderScenarios();
        renderFlightLog();
    }

    if (openPilotClubBtn) {
        openPilotClubBtn.addEventListener('click', () => { render(); TFS.Modal.open(pilotClubModal); });
    }
    if (closePilotClubBtn) closePilotClubBtn.addEventListener('click', () => TFS.Modal.close(pilotClubModal));
    if (openSettingsFromClubBtn) {
        openSettingsFromClubBtn.addEventListener('click', () => {
            TFS.Modal.close(pilotClubModal);
            if (TFS.Settings) TFS.Settings.render();
            setTimeout(() => TFS.Modal.open('settingsModal'), 200);
        });
    }

    I18n.onChange(() => { if (TFS.Modal.isOpen(pilotClubModal)) render(); });
    State.subscribe(() => { if (TFS.Modal.isOpen(pilotClubModal)) render(); });

})(window);
