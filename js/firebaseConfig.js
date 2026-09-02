/**
 * firebaseConfig.js
 * Fill this in with YOUR OWN Firebase project's config — Firebase console →
 * ⚙️ Project settings → General tab → "Your apps" → the web app's config
 * object. Paste it in exactly, keys and all.
 *
 * Until real values replace the "PASTE_..." placeholders below,
 * TFS.FIREBASE_ENABLED stays false and js/auth.js never touches the network:
 * the app quietly runs on the local-only profile system (js/profile.js)
 * exactly as it did before real accounts existed. Nothing breaks either way
 * — real accounts, photo avatars and the leaderboard just switch on
 * automatically the moment this file has real values.
 */
(function (global) {
    'use strict';
    const TFS = global.TFS = global.TFS || {};

    const FIREBASE_CONFIG = {
        apiKey: "PASTE_YOUR_API_KEY_HERE",
        authDomain: "PASTE_YOUR_PROJECT_ID.firebaseapp.com",
        projectId: "PASTE_YOUR_PROJECT_ID",
        storageBucket: "PASTE_YOUR_PROJECT_ID.appspot.com",
        messagingSenderId: "PASTE_YOUR_SENDER_ID",
        appId: "PASTE_YOUR_APP_ID"
    };

    TFS.FIREBASE_CONFIG = FIREBASE_CONFIG;
    TFS.FIREBASE_ENABLED = !!(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey.indexOf('PASTE_') !== 0);

})(window);
