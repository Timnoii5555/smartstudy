/**
 * groups.js
 * "Study groups" — a deliberately scoped-down safe version of what the
 * reference video shows: a named, shareable room with a daily goal and a
 * live "studying now" headcount, joined by a code or found in a public
 * list. No camera ("Cam Study" in the reference — a live-video feature
 * this file does not implement, full stop: recording or streaming video of
 * what could be minors studying alone at home is a real child-safety risk,
 * not a design choice to weigh against convenience), no ranking/leaderboard
 * (this app's own non-negotiable rule), and — for this first version — no
 * member list, nicknames, or per-member stats either: everyone in a group
 * is fully anonymous, which is what keeps this feature out of "needs a
 * report/block flow" territory (see this app's own rule: any room UI
 * needs one *unless* it exposes zero identifying info). A richer version
 * with named members is real, separate future work — see FUTURE_IDEAS.md
 * — that does need to build a report/block flow alongside it, not skip it.
 *
 * A 90s-old heartbeat ages out of the "studying now" count automatically,
 * so there's no cleanup job to run on a static site with nowhere to run one.
 *
 * Requires a Firestore security rule for the new `study_groups` collection:
 *   match /study_groups/{groupId} {
 *     allow read: if true;
 *     allow create: if request.resource.data.keys().hasOnly(
 *       ['name', 'description', 'dailyGoalMinutes', 'isPublic', 'joinCode', 'createdAtMs']);
 *     allow update, delete: if false;
 *     match /members/{id} {
 *       allow read: if true;
 *       allow write: if request.resource.data.keys().hasOnly(['lastHeartbeat']);
 *     }
 *   }
 * Every call here fails soft (logs a warning, returns null) if Firebase
 * isn't configured or that rule isn't deployed yet.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};
    const U = TFS.Utils;

    const HEARTBEAT_INTERVAL_MS = 30000;
    const STALE_AFTER_MS = 90000;
    const COLLECTION_ROOT = 'study_groups';
    const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I — easy to read back off a screen

    let db = null;
    let heartbeatTimerId = null;
    let heartbeatGroupId = null;
    let cachedId = null;

    function isAvailable() {
        return !!(TFS.Auth && TFS.Auth.isEnabled());
    }

    function ensureDb() {
        if (db) return db;
        try { db = global.firebase.firestore(); } catch (e) { db = null; }
        return db;
    }

    function myPresenceId() {
        if (!cachedId) cachedId = TFS.Storage.getActiveProfileId() || TFS.Utils.uuid();
        return cachedId;
    }

    function groupsRef() {
        const database = ensureDb();
        return database ? database.collection(COLLECTION_ROOT) : null;
    }

    function membersRef(groupId) {
        const ref = groupsRef();
        return ref ? ref.doc(groupId).collection('members') : null;
    }

    function randomJoinCode() {
        let code = '';
        for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
        return code;
    }

    /** Creates a new group and immediately makes it this device's current
     *  one (js/storage.js's state.groups). Returns the created group
     *  (including its joinCode, needed once here to show/share) or null if
     *  it couldn't be created. */
    async function createGroup({ name, dailyGoalMinutes, isPublic }) {
        const ref = groupsRef();
        if (!isAvailable() || !ref) return null;
        const group = {
            name: String(name).slice(0, 40),
            dailyGoalMinutes: U.clamp(Math.round(dailyGoalMinutes) || 60, 10, 600),
            isPublic: !!isPublic,
            joinCode: randomJoinCode(),
            createdAtMs: Date.now()
        };
        try {
            const doc = await ref.add(group);
            TFS.State.commit({ groups: { currentGroupId: doc.id, currentGroupName: group.name } });
            return { id: doc.id, ...group };
        } catch (e) {
            console.warn('[groups] Could not create a group (Firestore rules for "study_groups" may not be set up yet)', e);
            return null;
        }
    }

    /** Looks up a group by its 6-character join code and, if found, makes
     *  it this device's current group. Returns the group, or null if the
     *  code doesn't match anything (or the lookup itself failed). */
    async function joinByCode(code) {
        const ref = groupsRef();
        if (!isAvailable() || !ref) return null;
        const normalized = String(code).trim().toUpperCase();
        if (!normalized) return null;
        try {
            const snap = await ref.where('joinCode', '==', normalized).limit(1).get();
            if (snap.empty) return null;
            const doc = snap.docs[0];
            const group = { id: doc.id, ...doc.data() };
            TFS.State.commit({ groups: { currentGroupId: group.id, currentGroupName: group.name } });
            return group;
        } catch (e) {
            console.warn('[groups] Join-by-code lookup failed (Firestore rules for "study_groups" may not be set up yet)', e);
            return null;
        }
    }

    /** Directly joins an already-known group (e.g. one picked from
     *  fetchPublicGroups' results) without a code round-trip. */
    function joinGroup(group) {
        if (!group) return;
        TFS.State.commit({ groups: { currentGroupId: group.id, currentGroupName: group.name } });
    }

    /** Up to 20 public groups, in whatever order Firestore returns them —
     *  deliberately not sorted server-side (an equality filter plus a sort
     *  on a different field needs a composite index to set up in the
     *  Firebase console; a bare equality filter never does).
     *  Returns null (not []) if the fetch itself couldn't be attempted or
     *  failed, so the caller can tell "none public right now" apart from
     *  "couldn't check". */
    async function fetchPublicGroups() {
        const ref = groupsRef();
        if (!isAvailable() || !ref) return null;
        try {
            const snap = await ref.where('isPublic', '==', true).limit(20).get();
            return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        } catch (e) {
            console.warn('[groups] Could not list public groups (Firestore rules for "study_groups" may not be set up yet)', e);
            return null;
        }
    }

    /** The full document for a group this device already knows the id of
     *  (e.g. its current group) — used for fields the cached
     *  {currentGroupId, currentGroupName} in state.groups doesn't carry,
     *  like the join code. Returns null if it doesn't exist or the read
     *  failed. */
    async function fetchGroup(groupId) {
        const ref = groupsRef();
        if (!isAvailable() || !ref || !groupId) return null;
        try {
            const doc = await ref.doc(groupId).get();
            return doc.exists ? { id: doc.id, ...doc.data() } : null;
        } catch (e) {
            console.warn('[groups] Could not load this group\'s details (Firestore rules for "study_groups" may not be set up yet)', e);
            return null;
        }
    }

    function leaveGroup() {
        stopHeartbeat();
        TFS.State.commit({ groups: { currentGroupId: null, currentGroupName: null } });
    }

    async function sendHeartbeat(groupId) {
        const ref = membersRef(groupId);
        if (!isAvailable() || !ref) return;
        try { await ref.doc(myPresenceId()).set({ lastHeartbeat: Date.now() }); }
        catch (e) { console.warn('[groups] Heartbeat failed (Firestore rules for "study_groups" may not be set up yet)', e); }
    }

    async function leaveHeartbeatDoc(groupId) {
        const ref = membersRef(groupId);
        if (!isAvailable() || !ref) return;
        try { await ref.doc(myPresenceId()).delete(); } catch (e) { /* best-effort — the 90s staleness filter covers this either way */ }
    }

    /** Starts counting this device toward `groupId`'s "studying now" total
     *  — meant to run only while a focus session is actually running. */
    function startHeartbeat(groupId) {
        if (!groupId) return;
        if (heartbeatGroupId === groupId && heartbeatTimerId !== null) return;
        if (heartbeatTimerId !== null) stopHeartbeat();
        heartbeatGroupId = groupId;
        sendHeartbeat(groupId);
        heartbeatTimerId = setInterval(() => sendHeartbeat(heartbeatGroupId), HEARTBEAT_INTERVAL_MS);
    }

    function stopHeartbeat() {
        if (heartbeatTimerId !== null) { clearInterval(heartbeatTimerId); heartbeatTimerId = null; }
        if (heartbeatGroupId !== null) { leaveHeartbeatDoc(heartbeatGroupId); heartbeatGroupId = null; }
    }

    /** How many members currently count as "studying now" — everyone with
     *  a heartbeat inside the last 90s. Returns null (not 0) when it
     *  couldn't be fetched at all. */
    async function fetchStudyingCount(groupId) {
        const ref = membersRef(groupId);
        if (!isAvailable() || !ref) return null;
        try {
            const cutoff = Date.now() - STALE_AFTER_MS;
            const snap = await ref.where('lastHeartbeat', '>', cutoff).get();
            return snap.size;
        } catch (e) {
            console.warn('[groups] Studying-now count fetch failed (Firestore rules for "study_groups" may not be set up yet)', e);
            return null;
        }
    }

    global.addEventListener('pagehide', () => { if (heartbeatTimerId !== null) stopHeartbeat(); });

    TFS.Groups = { isAvailable, createGroup, joinByCode, joinGroup, fetchGroup, fetchPublicGroups, leaveGroup, startHeartbeat, stopHeartbeat, fetchStudyingCount };

})(window);
