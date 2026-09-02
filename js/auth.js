/**
 * auth.js
 * Real accounts (email/password sign-up & log-in), photo avatars, and a
 * cross-user leaderboard — all via Firebase Auth + Firestore (no Firebase
 * Storage — see the avatar note below for why). Every function here is
 * safe to call even when Firebase isn't configured
 * yet (see js/firebaseConfig.js): `isEnabled()` returns false and the app
 * keeps working entirely offline through the local profile system
 * (js/profile.js) either way.
 *
 * Scope decision, on purpose: only identity + leaderboard fields (display
 * name, avatar URL, points) live in the cloud, in one Firestore document per
 * user (`users/{uid}`). Everything else a learner has — schedule,
 * flashcards, focus stats, syllabus progress, the reading plan — stays local
 * to this device/profile, exactly as before. Syncing *all* of that across
 * devices would be a much bigger project than "let people log in for real
 * and see how they stack up against others."
 *
 * Avatar photos deliberately do NOT use Firebase Storage: as of late 2024,
 * new Firebase projects must be on the paid "Blaze" plan (a billing card on
 * file) before Storage will even turn on, purely-free "Spark" projects
 * can't use it at all. Requiring a linked card just to show a small profile
 * picture isn't worth that trade-off, so instead the photo is resized down
 * to a small square and compressed client-side (see resizeImageToDataURL)
 * into a compact base64 JPEG stored directly as a string field on the same
 * Firestore document everything else already lives in — comfortably under
 * Firestore's 1MB-per-document limit, and free on every Firebase plan.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};
    const Storage = TFS.Storage;

    let auth = null, db = null;
    let currentUser = null;
    let initialAuthResolved = false;
    const listeners = new Set();

    function isEnabled() { return !!TFS.FIREBASE_ENABLED; }
    function cloudProfileId(uid) { return 'fb:' + uid; }
    function isCloudProfileId(id) { return typeof id === 'string' && id.indexOf('fb:') === 0; }

    function init() {
        if (!isEnabled() || auth) return;
        try {
            const app = global.firebase.initializeApp(TFS.FIREBASE_CONFIG);
            auth = app.auth();
            db = app.firestore();

            auth.onAuthStateChanged(user => {
                currentUser = user;

                // Defensive self-heal: if Firebase's own session says someone is
                // logged in but this browser's local "active profile" pointer
                // doesn't agree yet (e.g. localStorage was cleared but Firebase's
                // separate IndexedDB session survived), correct it and reload
                // once so state.js re-initializes against the right per-account
                // key. Guarded by a one-shot sessionStorage flag so a genuinely
                // broken config can't reload-loop forever.
                if (user && Storage.getActiveProfileId() !== cloudProfileId(user.uid)) {
                    const guardKey = 'tfs:v1:authReloadGuard';
                    if (!global.sessionStorage.getItem(guardKey)) {
                        global.sessionStorage.setItem(guardKey, '1');
                        Storage.setActiveProfileId(cloudProfileId(user.uid));
                        global.location.reload();
                        return;
                    }
                }

                initialAuthResolved = true;
                listeners.forEach(fn => { try { fn(user); } catch (e) { console.error('[auth] listener threw', e); } });
            });
        } catch (e) {
            console.error('[auth] Firebase init failed — continuing with local profiles only.', e);
            auth = null;
        }
    }

    function onAuthChange(fn) {
        listeners.add(fn);
        if (initialAuthResolved) fn(currentUser); // late subscribers still get the current state once
        return () => listeners.delete(fn);
    }

    function getCurrentUser() { return currentUser; }

    /** Maps a handful of the Firebase Auth error codes worth explaining to a
     *  learner into an i18n key; everything else gets a generic fallback. */
    function errorKey(e) {
        const map = {
            'auth/email-already-in-use': 'modalAuth.errEmailInUse',
            'auth/invalid-email': 'modalAuth.errInvalidEmail',
            'auth/weak-password': 'modalAuth.errWeakPassword',
            'auth/user-not-found': 'modalAuth.errUserNotFound',
            'auth/wrong-password': 'modalAuth.errWrongPassword',
            'auth/invalid-credential': 'modalAuth.errWrongPassword',
            'auth/network-request-failed': 'modalAuth.errNetwork',
            'auth/too-many-requests': 'modalAuth.errTooMany'
        };
        return map[e && e.code] || 'modalAuth.errGeneric';
    }

    /** Downscales `file` to at most `size`×`size` (cropped to a centered
     *  square) and re-encodes it as a JPEG, returning a `data:` URL small
     *  enough to store directly as a Firestore string field — see the file
     *  header comment for why this exists instead of Firebase Storage. */
    function resizeImageToDataURL(file, size = 128, quality = 0.7) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const objectUrl = URL.createObjectURL(file);
            img.onload = () => {
                URL.revokeObjectURL(objectUrl);
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                // Center-crop to a square before scaling, so a non-square photo
                // doesn't come out squished.
                const srcSize = Math.min(img.naturalWidth, img.naturalHeight);
                const srcX = (img.naturalWidth - srcSize) / 2;
                const srcY = (img.naturalHeight - srcSize) / 2;
                ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, size, size);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('image_decode_failed')); };
            img.src = objectUrl;
        });
    }

    async function signUp({ email, password, displayName, avatarFile }) {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        const uid = cred.user.uid;
        let avatarURL = null;
        if (avatarFile) {
            try { avatarURL = await resizeImageToDataURL(avatarFile); }
            catch (e) { console.warn('[auth] Avatar processing failed — signing up without a photo.', e); }
        }
        await cred.user.updateProfile({ displayName });
        await db.collection('users').doc(uid).set({
            displayName, avatarURL: avatarURL || null, points: 0,
            createdAt: global.firebase.firestore.FieldValue.serverTimestamp(),
            lastActive: global.firebase.firestore.FieldValue.serverTimestamp()
        });
        return cred.user;
    }

    async function logIn(email, password) {
        const cred = await auth.signInWithEmailAndPassword(email, password);
        db.collection('users').doc(cred.user.uid)
            .set({ lastActive: global.firebase.firestore.FieldValue.serverTimestamp() }, { merge: true })
            .catch(e => console.warn('[auth] Could not update lastActive', e));
        return cred.user;
    }

    function logOut() { return auth.signOut(); }

    function resetPassword(email) { return auth.sendPasswordResetEmail(email); }

    /** One-way mirror: local points (computed by quests.js) → cloud. The
     *  cloud copy is read-only from the app's own point of view — it exists
     *  only so the leaderboard query has something to read across users. */
    function syncPoints(points) {
        if (!currentUser || !db) return;
        db.collection('users').doc(currentUser.uid).set({ points }, { merge: true })
            .catch(e => console.warn('[auth] Points sync failed (offline?)', e));
    }

    async function fetchLeaderboard(limitCount = 50) {
        const snap = await db.collection('users').orderBy('points', 'desc').limit(limitCount).get();
        return snap.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
    }

    init();

    TFS.Auth = {
        isEnabled, isCloudProfileId, cloudProfileId, init, onAuthChange, getCurrentUser,
        signUp, logIn, logOut, resetPassword, syncPoints, fetchLeaderboard, errorKey
    };

})(window);
