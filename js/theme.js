/**
 * theme.js
 * Runtime theme control (Part 3.2). The very first paint's theme is already
 * decided by a tiny inline script at the top of <head> in index.html (it has
 * to run before any CSS paints, before this file — or anything else — loads,
 * so it duplicates a few lines of logic on purpose). This module takes over
 * afterwards: applying explicit theme changes from Settings, and reacting to
 * OS-level light/dark changes while the "system" option is selected.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};

    const mediaQuery = global.matchMedia ? global.matchMedia('(prefers-color-scheme: dark)') : null;

    function effectiveTheme(setting) {
        if (setting === 'dark' || setting === 'light') return setting;
        return (mediaQuery && mediaQuery.matches) ? 'dark' : 'light';
    }

    function apply(setting) {
        const eff = effectiveTheme(setting);
        document.documentElement.classList.toggle('dark', eff === 'dark');
        document.documentElement.setAttribute('data-theme-setting', setting);
        // Keep the native UI (scrollbars, form controls) in sync with the theme too.
        document.documentElement.style.colorScheme = eff;
    }

    function setTheme(setting) {
        TFS.State.commit({ settings: { theme: setting } });
        apply(setting);
    }

    function getSetting() {
        return TFS.State.get().settings.theme;
    }

    function init() {
        apply(getSetting());
        if (mediaQuery) {
            const onChange = () => { if (getSetting() === 'system') apply('system'); };
            if (mediaQuery.addEventListener) mediaQuery.addEventListener('change', onChange);
            else if (mediaQuery.addListener) mediaQuery.addListener(onChange); // older Safari
        }
    }

    TFS.Theme = { init, setTheme, getSetting, effectiveTheme };

})(window);
