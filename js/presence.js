/**
 * presence.js
 * "Co-study presence" (Phase 5), scoped down to per-flight rooms: a live
 * count of how many people are currently flying the exact same curated
 * study-session length as you (see js/focus.js's FLIGHTS) — nothing else.
 * No chat, no camera, no microphone, no reactions, no per-user profiles,
 * no list of names — the room displays one number, and it is only ever
 * meaningful because "same flight" means "an identical timer duration",
 * not a coincidence of being on the app at the same moment.
 *
 * This is a deliberate scope cut from the fuller spec that private
 * co-study rooms describe (invite-link-only rooms with member lists, a
 * creator, kick/report/leave, and link expiry): that's real per-user-
 * facing surface area a child-safety review has to sign off on, and it's
 * the single largest remaining piece of unfinished work in this app — see
 * FUTURE_IDEAS.md. A per-flight count needs none of that scrutiny, since
 * there's nothing to report or block: no other participant is ever
 * identifiable from it, same as before.
 *
 * Presence data stored per participant is exactly one field: a heartbeat
 * timestamp under an opaque id (this device's local profile id, or the
 * `fb:<uid>` cloud profile id — never a display name or anything else),
 * as a document in that flight's own members subcollection. There's no
 * cleanup job (this is a static site with no server to run one on), so
 * "who's currently on this flight" is answered by filtering for a
 * heartbeat in the last 90 seconds at *read* time rather than by trusting
 * that every participant's document gets deleted on their way out — a
 * closed tab or a dead connection ages out of the count within 90 seconds
 * either way, never inflating it indefinitely.
 *
 * Requires Firestore security rules that allow any signed-in — or, since
 * this room deliberately doesn't require an account, any request at all —
 * client to read a flight's members subcollection and write only to its
 * own document within it, e.g.:
 *   match /presence_flights/{flightId}/members/{id} {
 *     allow read: if true;
 *     allow write: if request.resource.data.keys().hasOnly(['lastHeartbeat']);
 *   }
 * Structuring this as one subcollection per flight (rather than one flat
 * collection with a `flightId` field) is deliberate too: it means "how
 * many people are on flight X" is a single-field range query
 * (lastHeartbeat > cutoff) inside that flight's own subcollection, with no
 * composite index to set up in the Firebase console — a flat collection
 * filtered by flightId *and* lastHeartbeat would need one.
 *
 * Every call here fails soft (logs a warning, returns null/no-ops) if
 * Firebase isn't configured or those rules aren't in place yet, so a
 * missing rule can never break the rest of the app.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};

    const HEARTBEAT_INTERVAL_MS = 30000;
    const STALE_AFTER_MS = 90000;
    const COLLECTION_ROOT = 'presence_flights';

    let db = null;
    let heartbeatTimerId = null;
    let currentFlightId = null;
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

    function membersRef(flightId) {
        const database = ensureDb();
        return database ? database.collection(COLLECTION_ROOT).doc(flightId).collection('members') : null;
    }

    async function sendHeartbeat(flightId) {
        const ref = membersRef(flightId);
        if (!isAvailable() || !ref) return;
        try {
            await ref.doc(myPresenceId()).set({ lastHeartbeat: Date.now() });
        } catch (e) { console.warn('[presence] heartbeat failed (Firestore rules for "presence_flights" may not be set up yet)', e); }
    }

    async function leave(flightId) {
        const ref = membersRef(flightId);
        if (!isAvailable() || !ref) return;
        try { await ref.doc(myPresenceId()).delete(); } catch (e) { /* best-effort — the 90s staleness filter covers this either way */ }
    }

    /** Joins `flightId`'s shared room. Switching flights (calling this
     *  again with a different id while already joined to one) leaves the
     *  old room first, so a learner is never counted on two flights at once. */
    function startHeartbeat(flightId) {
        if (currentFlightId === flightId && heartbeatTimerId !== null) return;
        if (heartbeatTimerId !== null) stopHeartbeat();
        currentFlightId = flightId;
        sendHeartbeat(flightId);
        heartbeatTimerId = setInterval(() => sendHeartbeat(currentFlightId), HEARTBEAT_INTERVAL_MS);
    }

    function stopHeartbeat() {
        if (heartbeatTimerId !== null) { clearInterval(heartbeatTimerId); heartbeatTimerId = null; }
        if (currentFlightId !== null) { leave(currentFlightId); currentFlightId = null; }
    }

    function isHeartbeatRunning() {
        return heartbeatTimerId !== null;
    }

    /** How many people currently count as "on this flight" — everyone with
     *  a heartbeat inside the last 90 seconds, including this learner once
     *  joined. Returns null (rather than 0) when the count itself couldn't
     *  be fetched, so the caller can tell "nobody else right now" apart
     *  from "couldn't check". */
    async function fetchFlightCount(flightId) {
        const ref = membersRef(flightId);
        if (!isAvailable() || !ref) return null;
        try {
            const cutoff = Date.now() - STALE_AFTER_MS;
            const snap = await ref.where('lastHeartbeat', '>', cutoff).get();
            return snap.size;
        } catch (e) {
            console.warn('[presence] count fetch failed (Firestore rules for "presence_flights" may not be set up yet)', e);
            return null;
        }
    }

    // Best-effort: if a heartbeat is active when the tab is actually being
    // torn down, try to leave immediately rather than waiting up to 90s to
    // age out of the count.
    global.addEventListener('pagehide', () => { if (isHeartbeatRunning()) stopHeartbeat(); });

    TFS.Presence = { isAvailable, startHeartbeat, stopHeartbeat, isHeartbeatRunning, fetchFlightCount };

})(window);
