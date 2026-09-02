/**
 * app.js
 * Bootstraps the app once every other module has loaded and registered its
 * screen with the router: resolves the initial language/theme, wires the
 * cross-cutting UI (bottom nav, "back to setup"), decides which screen to
 * resume on (Part 1.1 — nothing, including *where you were*, is lost on
 * refresh), and surfaces any storage problems detected at load time.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS;
    const I18n = TFS.I18n;
    const State = TFS.State;
    const Router = TFS.Router;

    const bottomNav = document.getElementById('bottomNav');
    const navButtons = {
        home: document.getElementById('navHomeBtn'),
        sched: document.getElementById('navSchedBtn'),
        flash: document.getElementById('navFlashBtn'),
        focus: document.getElementById('navFocusBtn')
    };
    const PAGE_TO_SCREEN = { home: 'screen3', sched: 'screen4', flash: 'screen5', focus: 'screen6' };

    TFS.Nav = {
        show() { bottomNav.hidden = false; },
        hide() { bottomNav.hidden = true; },
        setActive(page) {
            Object.entries(navButtons).forEach(([key, btn]) => btn.classList.toggle('is-active', key === page));
        }
    };

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const screenId = PAGE_TO_SCREEN[btn.dataset.page];
            if (screenId) Router.show(screenId);
        });
    });

    document.querySelectorAll('.js-back-to-setup').forEach(btn => {
        btn.addEventListener('click', () => Router.show('screen1'));
    });

    // Closing every open modal on a screen change avoids a modal from one
    // screen visually surviving on top of the next screen.
    Router.onChange((screenId) => {
        document.querySelectorAll('.modal-overlay.is-open').forEach(overlay => TFS.Modal.close(overlay));
        State.commit({ ui: { lastScreen: screenId } });
    });

    function resolveInitialScreen() {
        if (!TFS.Storage.getActiveProfileId()) return 'screen0';
        const s = State.get();
        if (!s.plan.subject) return 'screen1';
        if (!s.plan.examDateISO) return 'screen2';
        const resumable = ['screen3', 'screen4', 'screen5', 'screen6'];
        return resumable.includes(s.ui.lastScreen) ? s.ui.lastScreen : 'screen3';
    }

    function boot() {
        I18n.init();
        TFS.Theme.init();
        I18n.applyTranslations(document);

        Router.show(resolveInitialScreen());

        if (TFS.Storage.isBroken()) TFS.Toast.warn(I18n.t('errors.storageUnavailable'), 7000);
        else if (TFS.Storage.wasCorrupt()) TFS.Toast.warn(I18n.t('errors.corruptData'), 7000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

})(window);
