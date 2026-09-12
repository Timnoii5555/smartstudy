/**
 * landing.js
 * The marketing/"why this app" screen shown to anyone with no active
 * profile yet (see app.js's resolveInitialScreen) — a first-time visitor
 * lands here instead of a bare login form, so the very first thing they see
 * answers "why should I use this instead of a plain planner app" before
 * asking for an email and password. Returning, already-signed-in learners
 * never see this screen again once a profile is active.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};
    const I18n = TFS.I18n;

    // A one-shot flag read by app.js's resolveInitialScreen() right after the
    // reload below, so "just start a focus session" really does land on the
    // focus screen instead of the normal new-profile flow (pick a subject,
    // set an exam date) that a real sign-up goes through.
    const SKIP_TO_FOCUS_KEY = 'tfs:v1:skipToFocusOnce';

    function goToLogin() {
        TFS.Storage.markLandingSeen();
        TFS.Router.show('screen0');
    }

    /** Phase 2's "no forced setup wall" escape hatch: create a throwaway
     *  local guest profile (or reuse a pre-existing one, so tapping this
     *  twice doesn't spawn a pile of empty profiles) and go straight to the
     *  focus timer — no account, no subject, no exam date required. A
     *  reload is unavoidable here, same as every other profile switch in
     *  this app (see js/storage.js's file header for why). */
    function startFocusNow() {
        TFS.Storage.markLandingSeen();
        if (!TFS.Storage.getActiveProfileId()) {
            const existing = TFS.Storage.listProfiles()[0];
            if (existing) TFS.Storage.setActiveProfileId(existing.id);
            else TFS.Storage.createProfile(I18n.t('landing.quickGuestName'), '⚡');
        }
        try { global.sessionStorage.setItem(SKIP_TO_FOCUS_KEY, '1'); } catch (e) { /* ignore — worst case it lands on the normal first screen */ }
        global.location.reload();
    }

    document.getElementById('landingLoginLink').addEventListener('click', goToLogin);
    document.getElementById('landingCtaBtn').addEventListener('click', goToLogin);
    document.getElementById('landingCtaBtn2').addEventListener('click', goToLogin);
    document.getElementById('landingSkipToFocusBtn').addEventListener('click', startFocusNow);

    TFS.Router.register('screenLanding', {
        onEnter: () => { TFS.Nav.hide(); }
    });

    TFS.Landing = { SKIP_TO_FOCUS_KEY };

})(window);
