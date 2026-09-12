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

    function goToLogin() {
        TFS.Storage.markLandingSeen();
        TFS.Router.show('screen0');
    }

    document.getElementById('landingLoginLink').addEventListener('click', goToLogin);
    document.getElementById('landingCtaBtn').addEventListener('click', goToLogin);
    document.getElementById('landingCtaBtn2').addEventListener('click', goToLogin);

    TFS.Router.register('screenLanding', {
        onEnter: () => { TFS.Nav.hide(); }
    });

})(window);
