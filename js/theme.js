/**
 * theme.js
 * Runtime theme control — Phase 8's 4-theme system (Pixel, Paper, Night,
 * Mint; see styles/tokens.css's header for the full token-mapping
 * rationale). The very first paint's theme is already decided by a tiny
 * inline script at the top of <head> in index.html (it has to run before
 * any CSS paints, before this file — or anything else — loads, so it
 * duplicates a few lines of logic on purpose, including the old-name
 * migration below). This module takes over afterwards: applying explicit
 * theme changes from Settings.
 *
 * Unlike the old light/dark/paper/night/system scheme, none of the 4
 * themes here are ever inferred from the OS's light/dark preference —
 * there is no "system" option anymore (see the phase brief: exactly 4
 * themes, no auto-switching, Pixel by default from first launch). A
 * profile's old saved value migrates once, on first read after this
 * shipped (js/storage.js's migrate()): 'light' -> 'mint', 'dark' -> 'pixel',
 * 'system' -> whichever of those two the OS preference would have
 * resolved to; 'paper'/'night' keep their names (same identities, new
 * palette values).
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};

    const THEMES = ['pixel', 'paper', 'night', 'mint'];
    const DEFAULT_THEME = 'pixel';

    function isValidTheme(id) {
        return THEMES.includes(id);
    }

    function apply(setting) {
        const eff = isValidTheme(setting) ? setting : DEFAULT_THEME;
        // Pixel is the classless :root default (matches the old scheme's
        // "light has no class" convention) — every other theme gets its
        // own html.<name> class, and never more than one at a time.
        THEMES.filter((t) => t !== DEFAULT_THEME).forEach((cls) => document.documentElement.classList.toggle(cls, eff === cls));
        document.documentElement.setAttribute('data-theme-setting', eff);
        // Keep the native UI (scrollbars, form controls) in sync with the theme too.
        document.documentElement.style.colorScheme = (eff === 'pixel' || eff === 'night') ? 'dark' : 'light';
    }

    function setTheme(setting) {
        TFS.State.commit({ settings: { theme: isValidTheme(setting) ? setting : DEFAULT_THEME } });
        apply(setting);
    }

    function getSetting() {
        return TFS.State.get().settings.theme;
    }

    function init() {
        apply(getSetting());
    }

    TFS.Theme = { init, setTheme, getSetting, THEMES, DEFAULT_THEME, isValidTheme };

})(window);
