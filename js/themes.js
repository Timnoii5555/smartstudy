/**
 * themes.js
 * Phase 8's single source of truth for theme metadata and the "gimmick"
 * interface every theme's animated scene implements. styles/tokens.css
 * owns the actual color/shape values and js/theme.js applies them; this
 * file owns *identity* (display name, collection-page name) and dispatches
 * the shared lifecycle hooks (session start/complete, task complete, day/
 * week rollover) to whichever theme's gimmick is currently registered —
 * callers never branch on which theme is active, they just call
 * TFS.Themes.notify*() and the right implementation (or a safe no-op)
 * runs.
 *
 * Every theme registers a gimmick object implementing all 7 hooks — empty
 * ones are fine ("ธีมไหนไม่ใช้ hook ไหน ปล่อยว่าง" — a theme that doesn't use
 * a hook just leaves it empty), never partial: registerGimmick() rejects
 * an object missing one, so a call site can never hit "not a function"
 * from a hook a theme's author forgot. As of this phase every theme's
 * gimmick is the shared NOOP_GIMMICK below — later phases replace each
 * with a real scene, one theme (and one commit) at a time, in the order
 * the phase brief specifies (Mint first to prove the architecture, Pixel
 * last as the most involved).
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};

    const ORDER = ['pixel', 'paper', 'night', 'mint'];
    const DEFAULT = 'pixel';

    const DEFINITIONS = {
        pixel: {
            id: 'pixel',
            name: { th: 'ทุ่งหญ้า', en: 'Pixel' },
            collectionName: { th: 'ทุ่งของฉัน', en: 'My Meadow' }
        },
        paper: {
            id: 'paper',
            name: { th: 'สมุดจด', en: 'Paper' },
            collectionName: { th: 'สมุดเก่า', en: 'Old Notebook' }
        },
        night: {
            id: 'night',
            name: { th: 'ท้องฟ้า', en: 'Night' },
            collectionName: { th: 'ท้องฟ้าที่ผ่านมา', en: 'Past Skies' }
        },
        mint: {
            id: 'mint',
            name: { th: 'ต้นไม้', en: 'Mint' },
            collectionName: { th: 'สวนของฉัน', en: 'My Garden' }
        }
    };

    const NOOP_GIMMICK = {
        onSessionStart() {}, onSessionComplete() {}, onTaskComplete() {},
        onDayRollover() {}, onWeekRollover() {},
        renderFocusScene() {}, renderCollection() {}
    };
    const HOOK_NAMES = Object.keys(NOOP_GIMMICK);

    const gimmicks = { pixel: NOOP_GIMMICK, paper: NOOP_GIMMICK, night: NOOP_GIMMICK, mint: NOOP_GIMMICK };

    /** A later phase's gimmick module calls this once to install its real
     *  implementation for one theme. Rejects (logs, keeps the no-op stub)
     *  anything missing a required hook, rather than installing a partial
     *  object that would throw "not a function" the first time an
     *  un-implemented hook is actually called. */
    function registerGimmick(themeId, gimmick) {
        if (!DEFINITIONS[themeId]) { console.error(`[themes] Unknown theme id "${themeId}" — ignoring registerGimmick.`); return; }
        const missing = HOOK_NAMES.filter((k) => typeof gimmick[k] !== 'function');
        if (missing.length) {
            console.error(`[themes] Gimmick for "${themeId}" is missing hook(s): ${missing.join(', ')} — keeping the no-op stub instead.`);
            return;
        }
        gimmicks[themeId] = gimmick;
    }

    function currentId() {
        return (TFS.Theme && TFS.Theme.isValidTheme(TFS.Theme.getSetting())) ? TFS.Theme.getSetting() : DEFAULT;
    }

    function currentDefinition() {
        return DEFINITIONS[currentId()];
    }

    function currentGimmick() {
        return gimmicks[currentId()] || NOOP_GIMMICK;
    }

    // ---------------------------------------------------------------- Lifecycle dispatch
    //
    // The data-collecting hooks (everything except the two render*() calls
    // below) go to *every* theme's gimmick, not just the active one — "even
    // if the learner only ever uses one theme, the others still collect in
    // the background" is one of this phase's controlling rules, so a
    // finished session/task has to reach all 4 regardless of which theme
    // happens to be on screen when it happens. Only renderFocusScene() and
    // renderCollection() are current-theme-only, since only one theme's
    // visuals are ever actually showing.
    //
    // Every call is wrapped per-theme — one gimmick throwing must never
    // break the real feature it's decorating, nor stop the other 3 themes
    // from still recording the same event, the same defensive stance
    // js/focus.js's own render path already takes for its own risks
    // (Leaflet, iOS Safari SVG quirks).

    function broadcast(hookName, ...args) {
        ORDER.forEach((themeId) => {
            try { gimmicks[themeId][hookName](...args); }
            catch (e) { console.error(`[themes] "${themeId}" gimmick's ${hookName} threw`, e); }
        });
    }

    function notifySessionStart(session) { broadcast('onSessionStart', session); }
    function notifySessionComplete(session) { broadcast('onSessionComplete', session); }
    function notifyTaskComplete(task) { broadcast('onTaskComplete', task); }
    function notifyDayRollover() { broadcast('onDayRollover'); }
    function notifyWeekRollover() { broadcast('onWeekRollover'); }

    TFS.Themes = {
        ORDER, DEFAULT, DEFINITIONS,
        registerGimmick, currentId, currentDefinition, currentGimmick,
        notifySessionStart, notifySessionComplete, notifyTaskComplete, notifyDayRollover, notifyWeekRollover
    };

})(window);
