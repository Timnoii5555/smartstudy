/**
 * presence.js
 * "Co-study presence" (Phase 5), scoped down to exactly the public room —
 * a single global count of how many people are currently in a focus
 * session, nothing else. No chat, no camera, no microphone, no reactions,
 * no per-user profiles, no list of names — the room displays one number.
 * This is a deliberate scope cut from the fuller spec (which also
 * describes invite-link-only private rooms with member lists, a creator,
 * kick/report/leave, and link expiry): that's real per-user-facing surface
 * area a child-safety review has to sign off on, and it's the single
 * largest remaining piece of unfinished work in this app — see
 * FUTURE_IDEAS.md. The public count above needs none of that scrutiny,
 * since there's nothing to report or block: no other participant is ever
 * identifiable from it.
 *
 * Presence data stored per participant is exactly one field: a heartbeat
 * timestamp under an opaque id (this device's local profile id, or the
 * `fb:<uid>` cloud profile id — never a display name or anything else).
 * There's no cleanup job (this is a static site with no server to run one
 * on), so "who's currently focusing" is answered by filtering for a
 * heartbeat in the last 90 seconds at *read* time rather than by trusting
 * that every participant's document gets deleted on their way out — a
 * closed tab or a dead connection ages out of the count within 90 seconds
 * either way, never inflating it indefinitely.
 *
 * Requires Firestore security rules that allow any signed-in — or, since
 * this room deliberately doesn't require an account, any request at all —
 * client to read the whole `presence_public` collection and write only to
 * its own document, e.g.:
 *   match /presence_public/{id} {
 *     allow read: if true;
 *     allow write: if request.resource.data.keys().hasOnly(['lastHeartbeat']);
 *   }
 * Every call here fails soft (logs a warning, returns null/no-ops) if
 * Firebase isn't configured or those rules aren't in place yet, so a
 * missing rule can never break the rest of the app.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};

    const HEARTBEAT_INTERVAL_MS = 30000;
    const STALE_AFTER_MS = 90000;
    const COLLECTION = 'presence_public';

    let db = null;
    let heartbeatTimerId = null;
    let cachedId = null;

    function isAvailable() {
        return !!(TFS.Auth && TFS.Auth.isEnabled());
    }

    function ensureDb() {
        if (db) return db;
        try { db = global.firebase.firestore(); } catch (e) { db = null; }
        return db;
    }

    /** An opaque id with no personal information — reuses this browser's
     *  active local/cloud profile id, which is already exactly that. */
    function myPresenceId() {
        if (!cachedId) cachedId = TFS.Storage.getActiveProfileId() || TFS.Utils.uuid();
        return cachedId;
    }

    async function sendHeartbeat() {
        const database = ensureDb();
        if (!isAvailable() || !database) return;
        try {
            await database.collection(COLLECTION).doc(myPresenceId()).set({ lastHeartbeat: Date.now() });
        } catch (e) { console.warn('[presence] heartbeat failed (Firestore rules for "presence_public" may not be set up yet)', e); }
    }

    async function leave() {
        const database = ensureDb();
        if (!isAvailable() || !database) return;
        try { await database.collection(COLLECTION).doc(myPresenceId()).delete(); } catch (e) { /* best-effort — the 90s staleness filter covers this either way */ }
    }

    function startHeartbeat() {
        if (heartbeatTimerId !== null) return;
        sendHeartbeat();
        heartbeatTimerId = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    }

    function stopHeartbeat() {
        if (heartbeatTimerId !== null) { clearInterval(heartbeatTimerId); heartbeatTimerId = null; }
        leave();
    }

    function isHeartbeatRunning() {
        return heartbeatTimerId !== null;
    }

    /** How many people currently count as "in a focus session" — everyone
     *  with a heartbeat inside the last 90 seconds. Returns null (rather
     *  than 0) when the count itself couldn't be fetched, so the caller can
     *  tell "nobody else right now" apart from "couldn't check". */
    async function fetchCount() {
        const database = ensureDb();
        if (!isAvailable() || !database) return null;
        try {
            const cutoff = Date.now() - STALE_AFTER_MS;
            const snap = await database.collection(COLLECTION).where('lastHeartbeat', '>', cutoff).get();
            return snap.size;
        } catch (e) {
            console.warn('[presence] count fetch failed (Firestore rules for "presence_public" may not be set up yet)', e);
            return null;
        }
    }

    // Best-effort: if a heartbeat is active when the tab is actually being
    // torn down, try to leave immediately rather than waiting up to 90s to
    // age out of the count.
    global.addEventListener('pagehide', () => { if (isHeartbeatRunning()) leave(); });

    TFS.Presence = { isAvailable, startHeartbeat, stopHeartbeat, isHeartbeatRunning, fetchCount };

})(window);
