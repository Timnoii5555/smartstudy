/**
 * streak.js
 * A forgiving day-streak: it counts a calendar day once at least 15 minutes
 * of real focus time has been logged that day (see js/focus.js's
 * creditElapsedFocusTime), and it is deliberately hard to lose.
 *
 * "Forgiving by design" (a non-negotiable product rule here, not just a
 * nicety): a single missed day never resets the streak to zero. Every
 * learner gets 2 "freeze" days per calendar month that are consumed
 * automatically — silently protecting the streak — the next time the app
 * notices a gap since the last active day. Only once both of a month's
 * freezes are used up does a further missed day cost anything, and even
 * then it only ever costs one point off the streak, never the whole thing.
 *
 * This module never runs on a timer or in the background (there is no
 * server here to run one on) — it reconciles lazily, the next time the
 * learner opens the app, by comparing today's date to the last day that
 * counted. That's why `reconcile()` is safe and cheap to call from
 * anywhere that touches streak-relevant state (every dashboard render,
 * every second of credited focus time): it no-ops instantly once a given
 * calendar day has already been reconciled.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};
    const U = TFS.Utils;
    const I18n = TFS.I18n;
    const State = TFS.State;

    const QUALIFYING_SECONDS = 15 * 60;
    const FREEZES_PER_MONTH = 2;

    function todayISO() { return U.formatDateISO(new Date()); }
    function monthKeyOf(iso) { return iso.slice(0, 7); }
    function daysBetween(laterISO, earlierISO) {
        return Math.round((U.parseISODate(laterISO) - U.parseISODate(earlierISO)) / 86400000);
    }

    function hasQualifyingStudyToday() {
        const totals = State.get().focus.totalSecondsByDate;
        return (totals[todayISO()] || 0) >= QUALIFYING_SECONDS;
    }

    function freezesRemaining() {
        const s = State.get().streak;
        const usedThisMonth = (s.freezeMonthKey === monthKeyOf(todayISO())) ? s.freezesUsedThisMonth : 0;
        return Math.max(0, FREEZES_PER_MONTH - usedThisMonth);
    }

    /** If today already qualifies and hasn't been counted yet, extend the
     *  streak by exactly one day. Safe to call many times per day. */
    function markTodayIfQualifying() {
        const today = todayISO();
        const s = State.get().streak;
        if (s.lastActiveDateISO === today) return;
        if (!hasQualifyingStudyToday()) return;
        const nextCurrent = s.current + 1;
        State.commit({ streak: { current: nextCurrent, longest: Math.max(s.longest, nextCurrent), lastActiveDateISO: today } });
    }

    /** Closes any gap between the last counted day and today, spending
     *  monthly freezes first and only decrementing the streak (by exactly
     *  one per day beyond the freezes available, never to a shameful reset)
     *  once they run out. Runs the "did today already extend it" check
     *  either way, so a single call handles both directions. */
    function reconcile() {
        const today = todayISO();
        const s = State.get().streak;

        if (s.lastReconciledDateISO === today) {
            markTodayIfQualifying();
            return;
        }

        const monthKey = monthKeyOf(today);
        let freezesUsedThisMonth = (s.freezeMonthKey === monthKey) ? s.freezesUsedThisMonth : 0;
        let current = s.current;

        if (s.lastActiveDateISO && current > 0) {
            let missedDays = Math.max(0, daysBetween(today, s.lastActiveDateISO) - 1);
            let freezesAvail = FREEZES_PER_MONTH - freezesUsedThisMonth;
            let freezesUsedNow = 0;
            while (missedDays > 0) {
                if (freezesAvail > 0) { freezesAvail--; freezesUsedNow++; }
                else { current = Math.max(0, current - 1); }
                missedDays--;
            }
            if (freezesUsedNow > 0) {
                freezesUsedThisMonth += freezesUsedNow;
                TFS.Toast.info(I18n.t('streak.freezeUsedToast', { n: freezesUsedNow, left: Math.max(0, FREEZES_PER_MONTH - freezesUsedThisMonth) }));
            }
        }

        State.commit({ streak: { current, freezeMonthKey: monthKey, freezesUsedThisMonth, lastReconciledDateISO: today } });
        markTodayIfQualifying();
    }

    TFS.Streak = { reconcile, freezesRemaining, hasQualifyingStudyToday, QUALIFYING_SECONDS };

})(window);
