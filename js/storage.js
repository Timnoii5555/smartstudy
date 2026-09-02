/**
 * storage.js
 * Everything that touches localStorage lives here. One versioned namespace
 * key holds the entire app state as a single JSON blob. This module never
 * assumes localStorage works — every call is wrapped so a corrupt value,
 * a disabled storage API (private browsing in some browsers), or a quota
 * error degrades to an in-memory fallback instead of crashing the app.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};
    const U = TFS.Utils;

    const STORAGE_KEY = 'tfs:v1:state';
    const SCHEMA_VERSION = 1;

    // In-memory fallback used only when localStorage is unavailable, so the
    // app keeps working for the current tab session even without persistence.
    let memoryFallback = null;
    let storageBroken = !U.isStorageAvailable();
    let hadCorruptData = false;

    function defaultState() {
        return {
            schemaVersion: SCHEMA_VERSION,
            settings: {
                language: null, // null = "not chosen yet", app.js resolves it from the browser
                theme: 'system', // 'light' | 'dark' | 'system'
                soundEnabled: true,
                ambientType: 'brown', // 'brown' | 'rain'
                ambientVolume: 0.5,
                pomodoro: { focusMin: 25, shortBreakMin: 5, longBreakMin: 15, cyclesBeforeLongBreak: 4 }
            },
            plan: {
                subject: null,
                examDateISO: null,
                dailyGoalSeconds: 4.5 * 3600
            },
            syllabusProgress: {
                // subjectId -> { topicId: true }
            },
            schedule: {
                sessions: []
                // { id, dateISO, startMin, endMin, topicId, topicLabel, color, completed }
            },
            flashcards: (function seedFlashcards() {
                // Seed a small starter deck per subject on a brand-new install only.
                // Once anything is saved, the saved copy is authoritative (see
                // Utils.ATOMIC_STATE_PATHS) — deleting a starter deck stays deleted.
                const decks = (TFS.Data && TFS.Data.createStarterDecks) ? TFS.Data.createStarterDecks() : {};
                return { decks, deckOrder: Object.keys(decks), currentDeckId: Object.keys(decks)[0] || null };
            })(),
            focus: {
                totalSecondsByDate: {}, // 'YYYY-MM-DD' -> seconds
                mode: 'focus',          // 'focus' | 'shortBreak' | 'longBreak'
                phaseRemainingSeconds: 25 * 60, // matches settings.pomodoro.focusMin by default
                cyclesCompletedToday: 0,
                lastActiveDateISO: null
            },
            ui: {
                lastScreen: 'screen1'
            }
        };
    }

    /** Upgrade an older persisted shape to the current one. Runs once on load. */
    function migrate(raw) {
        if (!raw || typeof raw !== 'object') return defaultState();
        let state = raw;
        const version = Number(state.schemaVersion) || 0;

        if (version < 1) {
            // No released schema existed before v1 — treat anything unversioned as legacy/corrupt
            // and start clean rather than guessing at a shape that was never persisted by this app.
            state = defaultState();
        }

        // Future migrations get appended here, e.g.:
        // if (state.schemaVersion < 2) { ...transform...; state.schemaVersion = 2; }

        state.schemaVersion = SCHEMA_VERSION;
        return state;
    }

    /**
     * Deep-merge `patch` onto `base` for fixed-shape config objects (arrays and
     * "atomic" dynamic-map fields — see Utils.isAtomicPath — are replaced
     * wholesale, never merged key-by-key, so a deleted map entry cannot be
     * resurrected by a default/previous copy that still has that key).
     */
    function deepMerge(base, patch, pathParts = []) {
        if (Array.isArray(base) || Array.isArray(patch) || typeof patch !== 'object' || patch === null) {
            return patch === undefined ? base : patch;
        }
        if (U.isAtomicPath(pathParts)) {
            return patch === undefined ? base : patch;
        }
        const out = { ...base };
        Object.keys(patch).forEach(key => {
            if (typeof patch[key] === 'object' && patch[key] !== null && !Array.isArray(patch[key]) &&
                typeof base[key] === 'object' && base[key] !== null && !Array.isArray(base[key])) {
                out[key] = deepMerge(base[key], patch[key], [...pathParts, key]);
            } else {
                out[key] = patch[key];
            }
        });
        return out;
    }

    function load() {
        // Note: this can run before toast.js/i18n.js have loaded (state.js calls
        // it at module-init time), so it cannot show a toast itself. app.js checks
        // `Storage.isBroken()` once everything is ready and warns the user then.
        if (storageBroken) {
            return memoryFallback || defaultState();
        }
        try {
            const raw = global.localStorage.getItem(STORAGE_KEY);
            if (!raw) return defaultState();
            const parsed = JSON.parse(raw);
            // Merge onto defaults so any field missing from an older/partial save
            // (or a hand-edited import) still ends up with a valid full shape.
            const merged = deepMerge(defaultState(), migrate(parsed));
            return merged;
        } catch (e) {
            console.error('[storage] Failed to parse saved state, falling back to defaults.', e);
            hadCorruptData = true;
            return defaultState();
        }
    }

    function writeNow(state) {
        if (storageBroken) {
            memoryFallback = state;
            return false;
        }
        try {
            global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            return true;
        } catch (e) {
            console.error('[storage] Failed to write state (quota exceeded or storage disabled).', e);
            storageBroken = true;
            memoryFallback = state;
            return false;
        }
    }

    // Debounced writer so rapid state changes (e.g. a running timer ticking every
    // second) don't hammer localStorage on every single update.
    const debouncedWrite = U.debounce(writeNow, 400);

    function save(state, immediate = false) {
        if (immediate) {
            debouncedWrite.cancel();
            return writeNow(state);
        }
        debouncedWrite(state);
    }

    function flush(state) {
        writeNow(state);
    }

    function clearAll() {
        debouncedWrite.cancel && debouncedWrite.cancel();
        memoryFallback = null;
        if (!storageBroken) {
            try { global.localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
        }
    }

    function exportJSON(state) {
        return JSON.stringify(state, null, 2);
    }

    /** Parse + validate an imported JSON payload. Throws with a human-readable message on failure. */
    function importJSON(text) {
        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch (e) {
            throw new Error('invalid_json');
        }
        if (!parsed || typeof parsed !== 'object' || !('settings' in parsed || 'plan' in parsed)) {
            throw new Error('invalid_shape');
        }
        return deepMerge(defaultState(), migrate(parsed));
    }

    TFS.Storage = {
        STORAGE_KEY, SCHEMA_VERSION,
        defaultState, load, save, flush, clearAll, exportJSON, importJSON,
        isBroken: () => storageBroken,
        wasCorrupt: () => hadCorruptData
    };

})(window);
