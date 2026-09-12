/**
 * reminder.js
 * "Time to focus" — a daily reminder at a time the learner picks (Settings,
 * see js/settings.js), matching the reference video's onboarding step.
 * Off by default; at most one a day, matching this app's own notification
 * rule (see the pasted spec's non-negotiable rules).
 *
 * Honesty about what this actually is: a website has no way to schedule a
 * real background notification the way a native app can — there is no
 * server here to send a push, and a Service Worker's periodic-sync APIs
 * that could do it without one are experimental and unsupported on iOS
 * Safari, which is most of this app's real audience. So this checks the
 * clock periodically *while the app is open* (foreground or a backgrounded
 * tab/PWA) and fires the first time it notices the reminder time has
 * passed today. Reliable for anyone who tends to leave the PWA running;
 * silent for a learner whose tab or app was fully closed all day — there
 * is no way around that from inside a browser, so this file doesn't
 * pretend otherwise.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};
    const U = TFS.Utils;
    const State = TFS.State;

    const CHECK_INTERVAL_MS = 30000;
    let intervalId = null;

    function isSupported() {
        return 'Notification' in global;
    }

    function permission() {
        return isSupported() ? Notification.permission : 'unsupported';
    }

    /** Must be called from a real user gesture (a click) — browsers refuse
     *  the permission prompt otherwise. Resolves to the resulting
     *  permission string; never throws. */
    async function requestPermission() {
        if (!isSupported()) return 'unsupported';
        try { return await Notification.requestPermission(); } catch (e) { return 'denied'; }
    }

    function fire() {
        const title = TFS.I18n ? TFS.I18n.t('modalReminder.notifTitle') : 'Time to focus!';
        const body = TFS.I18n ? TFS.I18n.t('modalReminder.notifBody') : "Let's get started.";
        if (isSupported() && Notification.permission === 'granted') {
            try { new Notification(title, { body, icon: 'icons/icon-192.png', tag: 'tfs-daily-reminder' }); return; } catch (e) { /* fall through to the toast below */ }
        }
        // Best-effort fallback for a denied/unsupported browser — only ever
        // seen if the learner happens to have the app open right then, but
        // still better than firing nothing at all.
        if (TFS.Toast) TFS.Toast.info(body);
    }

    function check() {
        const s = State.get().settings;
        if (!s.dailyReminderTime) return;
        const now = new Date();
        const todayISO = U.formatDateISO(now);
        if (s.dailyReminderLastFiredISO === todayISO) return; // already fired today
        const [h, m] = s.dailyReminderTime.split(':').map(Number);
        if (!isFinite(h) || !isFinite(m)) return;
        const dueAt = new Date(now); dueAt.setHours(h, m, 0, 0);
        if (now < dueAt) return; // not time yet
        State.commit({ settings: { dailyReminderLastFiredISO: todayISO } });
        fire();
    }

    function init() {
        check(); // covers "the app was opened after today's time already passed"
        if (intervalId === null) intervalId = setInterval(check, CHECK_INTERVAL_MS);
    }

    TFS.Reminder = { init, isSupported, permission, requestPermission };

})(window);
