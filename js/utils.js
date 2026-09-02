/**
 * utils.js
 * Small, dependency-free helper functions shared across every module.
 * Loaded first (classic <script>, not an ES module) so `window.TFS.Utils`
 * exists before any other module runs. Classic scripts (not `type="module"`)
 * are used throughout this project because the app is meant to be opened
 * directly from disk (file://) — module scripts and `fetch()` of local files
 * are blocked by the browser's CORS rules under file://, plain <script src>
 * tags are not.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};

    /** Generate a stable unique id. Falls back gracefully if crypto.randomUUID
     *  is unavailable (older WebViews, some locked-down browsers). */
    function uuid() {
        if (global.crypto && typeof global.crypto.randomUUID === 'function') {
            return global.crypto.randomUUID();
        }
        // RFC4122-ish fallback using Math.random. Good enough for local ids
        // that only ever need to be unique within one browser's storage.
        return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    }

    function clamp(n, min, max) {
        return Math.min(max, Math.max(min, n));
    }

    function pad2(n) {
        return n.toString().padStart(2, '0');
    }

    /** Debounce: collapse rapid repeated calls into one, `wait` ms after the last call. */
    function debounce(fn, wait) {
        let t = null;
        function debounced(...args) {
            clearTimeout(t);
            t = setTimeout(() => fn.apply(this, args), wait);
        }
        debounced.flush = (...args) => { clearTimeout(t); fn.apply(this, args); };
        debounced.cancel = () => clearTimeout(t);
        return debounced;
    }

    /** Format a Date as a local (NOT UTC) ISO date string 'YYYY-MM-DD'. */
    function formatDateISO(date) {
        return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
    }

    /**
     * Parse a 'YYYY-MM-DD' string as a LOCAL midnight Date.
     * IMPORTANT: `new Date('YYYY-MM-DD')` parses as UTC midnight, which shifts
     * to the previous calendar day in any timezone behind UTC. This helper
     * avoids that class of bug entirely by building the Date from local parts.
     */
    function parseISODate(str) {
        if (!str) return null;
        const [y, m, d] = str.split('-').map(Number);
        if (!y || !m || !d) return null;
        return new Date(y, m - 1, d);
    }

    function isSameDate(a, b) {
        return !!a && !!b &&
            a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate();
    }

    function startOfDay(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function addDays(date, n) {
        const d = new Date(date);
        d.setDate(d.getDate() + n);
        return d;
    }

    /** Monday-anchored start of week (matches the Thai week layout used in the grid: Mon..Sun). */
    function startOfWeekMonday(date) {
        const d = startOfDay(date);
        const day = d.getDay(); // 0 = Sunday
        const diffToMonday = day === 0 ? 6 : day - 1;
        return addDays(d, -diffToMonday);
    }

    function formatSecondsToHMS(totalSeconds) {
        totalSeconds = Math.max(0, Math.floor(totalSeconds));
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = Math.floor(totalSeconds % 60);
        return `${h}:${pad2(m)}:${pad2(s)}`;
    }

    function formatSecondsToHHMM(totalSeconds) {
        totalSeconds = Math.max(0, Math.floor(totalSeconds));
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        return `${pad2(h)}:${pad2(m)}`;
    }

    function timeStrToMinutes(hhmm) {
        const [h, m] = hhmm.split(':').map(Number);
        return (h * 60) + (m || 0);
    }

    function minutesToTimeStr(mins) {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${pad2(h)}:${pad2(m)}`;
    }

    // Note: there is no HTML-escaping helper here on purpose. Every render in
    // this app builds DOM nodes with `el()` (below) and assigns user-provided
    // text via `.textContent`, never by concatenating it into an HTML string —
    // so there is nothing that ever needs escaping in the first place.

    function qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

    /** Create a DOM element from a small options object. Keeps render code terse and safe
     *  (uses textContent for the label, so no HTML-escaping footguns). */
    function el(tag, opts = {}, children = []) {
        const node = document.createElement(tag);
        if (opts.className) node.className = opts.className;
        if (opts.attrs) {
            Object.entries(opts.attrs).forEach(([k, v]) => {
                if (v === false || v === null || v === undefined) return;
                node.setAttribute(k, v === true ? '' : v);
            });
        }
        if (opts.text !== undefined) node.textContent = opts.text;
        if (opts.html !== undefined) node.innerHTML = opts.html;
        if (opts.on) {
            Object.entries(opts.on).forEach(([evt, handler]) => node.addEventListener(evt, handler));
        }
        children.forEach(c => { if (c) node.appendChild(c); });
        return node;
    }

    /** Trigger a browser download of a text payload (used for JSON export). */
    function downloadText(filename, text, mime = 'application/json') {
        const blob = new Blob([text], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }

    /** Detect whether localStorage is actually usable (private browsing / quota / disabled). */
    function isStorageAvailable() {
        try {
            const testKey = '__tfs_storage_test__';
            global.localStorage.setItem(testKey, '1');
            global.localStorage.removeItem(testKey);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * State fields that are "maps keyed by dynamic id" (decks, per-date totals,
     * per-topic completion) rather than a fixed config shape. These must always
     * be replaced wholesale during merges — never deep-merged key-by-key —
     * otherwise a deleted entry (a removed deck, an unmarked-complete topic)
     * would silently reappear because the default/previous copy still had that
     * key. Both storage.js (load-time defaults-fill) and state.js (runtime
     * commits) share this list so the two behave consistently.
     */
    const ATOMIC_STATE_PATHS = new Set(['flashcards.decks', 'syllabusProgress', 'focus.totalSecondsByDate']);
    function isAtomicPath(pathParts) {
        return ATOMIC_STATE_PATHS.has(pathParts.join('.'));
    }

    TFS.Utils = {
        uuid, clamp, pad2, debounce,
        formatDateISO, parseISODate, isSameDate, startOfDay, addDays, startOfWeekMonday,
        formatSecondsToHMS, formatSecondsToHHMM, timeStrToMinutes, minutesToTimeStr,
        qsa, el, downloadText, readFileAsText, isStorageAvailable, isAtomicPath
    };

})(window);
