/**
 * errorBoundary.js
 * This is a plain imperative-DOM app with no virtual DOM to "crash" the way
 * a React component tree can, so there is no literal render-time error
 * boundary to build. What this provides instead is the same user-facing
 * contract Phase 7 asks for: an uncaught error anywhere in the app never
 * surfaces as a raw stack trace or a silently broken page — it shows one
 * plain, recoverable message with a single retry action.
 *
 * Loaded first, before every other script, specifically so it can catch an
 * error even during another module's own top-level setup code.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};

    let banner = null;
    let shown = false;

    function ensureBanner() {
        if (banner) return banner;
        banner = document.createElement('div');
        banner.className = 'error-boundary-banner';
        banner.setAttribute('role', 'alert');
        banner.hidden = true;

        const text = document.createElement('p');
        text.className = 'error-boundary-banner__text';
        // Deliberately plain strings, not TFS.I18n.t(): a boot-time failure
        // is exactly the moment i18n itself might not have loaded yet.
        text.textContent = 'เกิดข้อผิดพลาดบางอย่าง ลองรีเฟรชหน้านี้อีกครั้งได้เลยครับ · Something went wrong — try reloading this page.';

        const retryBtn = document.createElement('button');
        retryBtn.type = 'button';
        retryBtn.className = 'error-boundary-banner__retry';
        retryBtn.textContent = 'รีเฟรช · Reload';
        retryBtn.addEventListener('click', () => global.location.reload());

        banner.appendChild(text);
        banner.appendChild(retryBtn);
        (document.body || document.documentElement).appendChild(banner);
        return banner;
    }

    function handleError(detail) {
        console.error('[errorBoundary]', detail);
        // Show once per page load — a second unrelated error while the
        // learner is already looking at "please reload" adds nothing.
        if (shown) return;
        shown = true;
        if (document.body) { ensureBanner().hidden = false; }
        else {
            // Fired before <body> exists yet (extremely early boot failure) —
            // wait for it rather than losing the message entirely.
            document.addEventListener('DOMContentLoaded', () => { ensureBanner().hidden = false; });
        }
    }

    global.addEventListener('error', (e) => handleError(e.error || e.message));
    global.addEventListener('unhandledrejection', (e) => handleError(e.reason));

    TFS.ErrorBoundary = { reset: () => { shown = false; if (banner) banner.hidden = true; } };

})(window);
