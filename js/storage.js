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

    // ---- Local profiles ("login") ------------------------------------------
    // There is no server here, so "login" means "which named local profile on
    // this device am I studying as" rather than real authentication. Each
    // profile gets its own state blob under its own key so progress, points,
    // flashcards etc. never bleed between people sharing one computer.
    // These three keys live OUTSIDE the versioned state blob on purpose: they
    // must be readable before any profile's state has even been chosen.
    const PROFILES_INDEX_KEY = 'tfs:v1:profiles';
    const ACTIVE_PROFILE_KEY = 'tfs:v1:activeProfile';

    function profileStateKey(profileId) { return `tfs:v1:state:${profileId}`; }

    function readJSON(key, fallback) {
        try {
            const raw = global.localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) { return fallback; }
    }
    function writeJSON(key, value) {
        try { global.localStorage.setItem(key, JSON.stringify(value)); return true; }
        catch (e) { console.error('[storage] Failed to write', key, e); return false; }
    }

    function listProfiles() { return readJSON(PROFILES_INDEX_KEY, []); }

    function getActiveProfileId() {
        try { return global.localStorage.getItem(ACTIVE_PROFILE_KEY) || null; }
        catch (e) { return null; }
    }

    function setActiveProfileId(id) {
        try {
            if (id) global.localStorage.setItem(ACTIVE_PROFILE_KEY, id);
            else global.localStorage.removeItem(ACTIVE_PROFILE_KEY);
        } catch (e) { /* ignore — worst case the profile picker shows again next launch */ }
    }

    /** Create a brand-new, empty profile and make it the active one. Does NOT
     *  reload the page — the caller (profile.js) does that, the same way
     *  settings.js reloads after import/reset, so every stateful engine
     *  (timers, i18n, ambient audio) restarts clean against the new profile. */
    function createProfile(name, emoji) {
        const id = U.uuid();
        const profiles = [...listProfiles(), { id, name, emoji: emoji || '📚', createdAt: Date.now() }];
        writeJSON(PROFILES_INDEX_KEY, profiles);
        setActiveProfileId(id);
        return id;
    }

    function switchProfile(id) { setActiveProfileId(id); }

    function deleteProfile(id) {
        writeJSON(PROFILES_INDEX_KEY, listProfiles().filter(p => p.id !== id));
        try { global.localStorage.removeItem(profileStateKey(id)); } catch (e) { /* ignore */ }
        if (getActiveProfileId() === id) setActiveProfileId(null);
    }

    /** The localStorage key this session's state actually lives under: the
     *  active profile's own key once one has been chosen, or the legacy
     *  unscoped key before any profile system existed / before the very
     *  first profile is created. */
    function effectiveKey() {
        const activeId = getActiveProfileId();
        return activeId ? profileStateKey(activeId) : STORAGE_KEY;
    }

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
                dailyGoalSeconds: 4.5 * 3600,
                orderStrategy: 'balanced', // 'sequential' | 'easyFirst' | 'hardFirst' | 'balanced'
                readingPlan: null, // { subjectId, orderStrategy, generatedAt, days: [{dateISO, topicIds}] } — see planner.js
                completedSubjects: [], // subject ids the learner has fully finished, so a new one can be suggested
                readAheadUntilDate: null // set when the learner opts to pull tomorrow's (or later) topics into today — see dashboard.js
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
                lastScreen: 'screen1',
                hasSeenQuestIntro: false
            },
            quests: {
                dateISO: null, // set to today's date the first time quests.js touches it
                progress: {},  // questId -> number, reset daily
                claimed: {}    // questId -> true, reset daily
            },
            points: {
                total: 0 // cumulative — never reset by the daily quest rollover
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
            const raw = global.localStorage.getItem(effectiveKey());
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
            global.localStorage.setItem(effectiveKey(), JSON.stringify(state));
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
            try { global.localStorage.removeItem(effectiveKey()); } catch (e) { /* ignore */ }
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
        wasCorrupt: () => hadCorruptData,
        // Local profiles ("login") — see the block above.
        listProfiles, getActiveProfileId, setActiveProfileId, createProfile, switchProfile, deleteProfile
    };

})(window);
