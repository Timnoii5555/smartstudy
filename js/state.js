/**
 * state.js
 * A tiny centralized store: one state object in memory, a `commit()` that
 * applies a patch/updater, persists it (debounced) via storage.js, and
 * notifies subscribers. Every module reads through `State.get()` and writes
 * through `State.commit()` — nothing else touches localStorage directly.
 * This is what makes "nothing is lost on refresh" (bug 1.1) hold for every
 * feature at once instead of being patched in per-screen.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};
    const Storage = TFS.Storage;

    let state = Storage.load();
    const subscribers = new Set();

    function get() {
        return state;
    }

    /** Merge a patch (object) or run an updater(draftCopy) => patch, then persist + notify. */
    function commit(patchOrUpdater, opts = {}) {
        const patch = typeof patchOrUpdater === 'function'
            ? patchOrUpdater(state)
            : patchOrUpdater;
        if (!patch) return state;

        state = deepMergeState(state, patch);
        Storage.save(state, !!opts.immediate);
        subscribers.forEach(fn => {
            try { fn(state); } catch (e) { console.error('[state] subscriber threw', e); }
        });
        return state;
    }

    // See Utils.isAtomicPath: dynamic-id maps (decks, per-date totals, per-topic
    // completion) must be committed as a complete replacement object, never
    // patched key-by-key, or a deleted entry could reappear from the old copy.
    function deepMergeState(base, patch, pathParts = []) {
        if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) return patch;
        if (TFS.Utils.isAtomicPath(pathParts)) return patch;
        const out = { ...base };
        Object.keys(patch).forEach(key => {
            const pv = patch[key];
            const bv = base[key];
            if (pv && typeof pv === 'object' && !Array.isArray(pv) && bv && typeof bv === 'object' && !Array.isArray(bv)) {
                out[key] = deepMergeState(bv, pv, [...pathParts, key]);
            } else {
                out[key] = pv;
            }
        });
        return out;
    }

    function subscribe(fn) {
        subscribers.add(fn);
        return () => subscribers.delete(fn);
    }

    /** Force an immediate synchronous flush to storage (used before export / unload). */
    function flushNow() {
        Storage.flush(state);
    }

    function resetToDefaults() {
        Storage.clearAll();
        state = Storage.defaultState();
        Storage.save(state, true);
        subscribers.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } });
        return state;
    }

    function replaceAll(newState) {
        state = newState;
        Storage.save(state, true);
        subscribers.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } });
        return state;
    }

    global.addEventListener('beforeunload', flushNow);
    global.addEventListener('pagehide', flushNow);

    TFS.State = { get, commit, subscribe, flushNow, resetToDefaults, replaceAll };

})(window);
