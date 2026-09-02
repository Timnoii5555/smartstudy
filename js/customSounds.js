/**
 * customSounds.js
 * Lets a learner upload their own ambient-sound file (rain recorded outside
 * their window, a favorite lo-fi loop, whatever helps them focus) instead of
 * being limited to the built-in generated noises. Audio files are binary and
 * can be a few MB — too big to comfortably live inside the single JSON blob
 * `storage.js` round-trips through `JSON.stringify` on every change — so
 * they get their own tiny IndexedDB store, keyed by id, completely separate
 * from the main app state. focus.js reads a blob back, decodes it once with
 * the Web Audio API, and loops the decoded buffer for playback.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};

    const DB_NAME = 'tfs-custom-sounds';
    const DB_VERSION = 1;
    const STORE = 'sounds';

    let dbPromise = null;

    function isSupported() { return !!global.indexedDB; }

    function openDB() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            if (!isSupported()) { reject(new Error('indexeddb_unavailable')); return; }
            const req = global.indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        return dbPromise;
    }

    /** Store `file` (a File/Blob from an <input type="file">) under a new id. */
    async function addSound(name, file) {
        const db = await openDB();
        const id = TFS.Utils.uuid();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put({ id, name, blob: file, createdAt: Date.now() });
            tx.oncomplete = () => resolve(id);
            tx.onerror = () => reject(tx.error);
        });
    }

    /** Metadata only (id/name/createdAt) — cheap to list without pulling every blob into memory. */
    async function listSounds() {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
            req.onsuccess = () => resolve((req.result || []).map(r => ({ id: r.id, name: r.name, createdAt: r.createdAt })));
            req.onerror = () => reject(req.error);
        });
    }

    async function getSoundBlob(id) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
            req.onsuccess = () => resolve(req.result ? req.result.blob : null);
            req.onerror = () => reject(req.error);
        });
    }

    async function deleteSound(id) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    TFS.CustomSounds = { isSupported, addSound, listSounds, getSoundBlob, deleteSound };

})(window);
