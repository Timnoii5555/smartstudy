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
        apiKey: "AIzaSyCKg9JTSiRmI9gviorGz1BWO57g0Zvwr-k",
        authDomain: "smartstudy-7a7cc.firebaseapp.com",
        projectId: "smartstudy-7a7cc",
        storageBucket: "smartstudy-7a7cc.firebasestorage.app",
        messagingSenderId: "1035137479760",
        appId: "1:1035137479760:web:56e189c2bdb244e84fcd55"
    };

    TFS.FIREBASE_CONFIG = FIREBASE_CONFIG;
    TFS.FIREBASE_ENABLED = !!(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey.indexOf('PASTE_') !== 0);

})(window);
