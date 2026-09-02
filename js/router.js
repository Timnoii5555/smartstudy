/**
 * router.js
 * Tiny screen router. Fixes bug 1.2 (focus timer surviving a screen change):
 * every screen switch now runs a teardown hook for the screen being left and
 * a setup hook for the screen being entered, so intervals/listeners that
 * belong to one screen never keep running once you've navigated away from it.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};

    const screens = new Map(); // id -> { el, onEnter, onLeave }
    let currentId = null;
    let changeListeners = [];

    function register(id, { onEnter, onLeave } = {}) {
        const el = document.getElementById(id);
        if (!el) { console.error('[router] Unknown screen id', id); return; }
        screens.set(id, { el, onEnter: onEnter || (() => {}), onLeave: onLeave || (() => {}) });
    }

    function onChange(fn) { changeListeners.push(fn); }

    function show(id, payload) {
        if (!screens.has(id)) { console.error('[router] Cannot show unknown screen', id); return; }
        const prev = currentId && screens.get(currentId);
        if (prev && currentId !== id) {
            try { prev.onLeave(); } catch (e) { console.error('[router] onLeave threw for', currentId, e); }
        }

        screens.forEach((s, sid) => { s.el.style.display = sid === id ? 'block' : 'none'; });
        currentId = id;

        const next = screens.get(id);
        try { next.onEnter(payload); } catch (e) { console.error('[router] onEnter threw for', id, e); }

        global.scrollTo(0, 0);

        // Move focus to the screen's main heading for keyboard/screen-reader users,
        // without stealing focus away from an element the caller wants to keep it on.
        if (!payload || !payload.keepFocus) {
            // Prefer an explicitly-marked content heading (every screen's <main>
            // title) over the header's brand <h1>, which is the same on every
            // screen and so tells a screen-reader user nothing about the switch.
            const heading = next.el.querySelector('[data-screen-heading]') || next.el.querySelector('main h1, main h2');
            if (heading) {
                const hadTabIndex = heading.hasAttribute('tabindex');
                if (!hadTabIndex) heading.setAttribute('tabindex', '-1');
                heading.focus({ preventScroll: true });
                if (!hadTabIndex) heading.addEventListener('blur', () => heading.removeAttribute('tabindex'), { once: true });
            }
        }

        changeListeners.forEach(fn => { try { fn(id, payload); } catch (e) { console.error(e); } });
    }

    function current() { return currentId; }

    TFS.Router = { register, show, current, onChange };

})(window);
