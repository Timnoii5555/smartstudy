/**
 * stats.js
 * Screen 3's "This week" modal (Phase 6): weekly total focus time compared
 * to the learner's own previous week, minutes per subject so a neglected
 * one becomes visible, a coarse "best time of day" derived from when focus
 * time actually happened, and one short plain-language summary sentence.
 *
 * Every number here compares the learner only to their own past — never to
 * other users — and the summary sentence is built to stay factual and
 * neutral even when the direction is a decrease: no red, no "you fell
 * behind", just what happened.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};
    const U = TFS.Utils;
    const I18n = TFS.I18n;
    const State = TFS.State;

    function sumDaysAgoRange(totals, fromDaysAgo, toDaysAgo) {
        let sum = 0;
        for (let i = toDaysAgo; i <= fromDaysAgo; i++) {
            sum += totals[U.formatDateISO(U.addDays(new Date(), -i))] || 0;
        }
        return sum;
    }

    /** This calendar week (today + the 6 days before it) vs. the 7 days
     *  before that — a rolling 7-day window rather than a Mon-Sun split, so
     *  "this week" always means "the last 7 days" regardless of what day it is. */
    function weeklyComparison() {
        const totals = State.get().focus.totalSecondsByDate;
        const thisWeekSeconds = sumDaysAgoRange(totals, 6, 0);
        const lastWeekSeconds = sumDaysAgoRange(totals, 13, 7);
        return { thisWeekSeconds, lastWeekSeconds, deltaSeconds: thisWeekSeconds - lastWeekSeconds };
    }

    function minutesPerSubject() {
        const bySubject = State.get().focus.totalSecondsBySubject;
        return Object.keys(bySubject)
            .map(subjectId => {
                const subject = TFS.Data.getSubject(subjectId);
                const totalSeconds = Object.values(bySubject[subjectId]).reduce((a, b) => a + b, 0);
                return { subjectId, name: subject ? I18n.pick(subject.name) : subjectId, totalSeconds };
            })
            .filter(row => row.totalSeconds > 0)
            .sort((a, b) => b.totalSeconds - a.totalSeconds);
    }

    const TIME_BUCKET_KEYS = ['morning', 'afternoon', 'evening', 'night'];

    /** Which of the 4 coarse time-of-day buckets has the most cumulative
     *  focus minutes ever logged, or null if there isn't enough data yet to
     *  say anything meaningful (avoids a confident-sounding claim from, say,
     *  a single 20-minute session). */
    function bestTimeOfDay() {
        const buckets = State.get().focus.timeOfDayMinutes;
        const totalMin = TIME_BUCKET_KEYS.reduce((sum, k) => sum + (buckets[k] || 0), 0);
        if (totalMin < 60) return null;
        return TIME_BUCKET_KEYS.reduce((best, k) => (buckets[k] > (buckets[best] || 0) ? k : best), TIME_BUCKET_KEYS[0]);
    }

    /** One short, plain-language sentence: what happened this week, and —
     *  only when there's more than one subject to compare — which one got
     *  the least attention. Never mentions other users, never uses words
     *  like "behind" or "failed" (see js/i18n.js's stats.* keys). */
    function weeklySummaryMessage() {
        const { thisWeekSeconds, deltaSeconds } = weeklyComparison();
        const parts = [I18n.t('stats.summaryTotal', { hrs: U.formatSecondsToHHMM(thisWeekSeconds) })];

        if (Math.abs(deltaSeconds) >= 300) { // ignore noise under 5 minutes
            const key = deltaSeconds > 0 ? 'stats.summaryUp' : 'stats.summaryDown';
            parts.push(I18n.t(key, { hrs: U.formatSecondsToHHMM(Math.abs(deltaSeconds)) }));
        }

        const subjects = minutesPerSubject();
        if (subjects.length >= 2) {
            parts.push(I18n.t('stats.summaryLeastSubject', { subject: subjects[subjects.length - 1].name }));
        }

        return parts.join(' ');
    }

    // ---------------------------------------------------------------- UI

    const statsModal = document.getElementById('statsModal');
    const statsBody = document.getElementById('statsBody');
    const TIME_BUCKET_ICON = { morning: 'wb_twilight', afternoon: 'light_mode', evening: 'wb_twilight', night: 'bedtime' };

    function render() {
        statsBody.innerHTML = '';

        statsBody.appendChild(U.el('div', { className: 'read-ahead-card' }, [
            U.el('span', { className: 'material-symbols-outlined', attrs: { 'aria-hidden': 'true' }, text: 'insights' }),
            U.el('p', { text: weeklySummaryMessage() })
        ]));

        const { thisWeekSeconds, deltaSeconds } = weeklyComparison();
        const deltaKey = deltaSeconds > 0 ? 'stats.deltaUp' : (deltaSeconds < 0 ? 'stats.deltaDown' : 'stats.deltaSame');
        statsBody.appendChild(U.el('div', { className: 'card', attrs: { style: 'padding:1.25rem 1.5rem' } }, [
            U.el('p', { className: 'text-outline', attrs: { style: 'font-size:0.75rem;margin-bottom:0.25rem' }, text: I18n.t('stats.thisWeekLabel') }),
            U.el('p', { attrs: { style: 'font-family:var(--font-headline);font-size:1.75rem;font-weight:800;color:var(--color-primary)' }, text: U.formatSecondsToHHMM(thisWeekSeconds) }),
            Math.abs(deltaSeconds) >= 300
                ? U.el('p', { className: 'text-outline', attrs: { style: 'font-size:0.75rem' }, text: I18n.t(deltaKey, { hrs: U.formatSecondsToHHMM(Math.abs(deltaSeconds)) }) })
                : document.createTextNode('')
        ]));

        const subjects = minutesPerSubject();
        if (subjects.length > 0) {
            const maxSeconds = subjects[0].totalSeconds;
            const list = U.el('div', { className: 'card', attrs: { style: 'padding:1.25rem 1.5rem' } }, [
                U.el('h3', { attrs: { style: 'font-size:0.9375rem;font-weight:700;margin-bottom:1rem' }, text: I18n.t('stats.perSubjectTitle') })
            ]);
            const rows = U.el('div', { className: 'readiness-score__rows' });
            subjects.forEach(row => {
                const pct = maxSeconds > 0 ? Math.round((row.totalSeconds / maxSeconds) * 100) : 0;
                rows.appendChild(U.el('div', { className: 'readiness-score__row' }, [
                    U.el('span', { className: 'readiness-score__row-label', attrs: { style: 'flex-basis:8rem' }, text: row.name }),
                    U.el('div', { className: 'readiness-score__row-track' }, [
                        U.el('div', { className: 'readiness-score__row-fill', attrs: { style: `width:${pct}%` } })
                    ]),
                    U.el('span', { className: 'readiness-score__row-value', attrs: { style: 'flex-basis:3.5rem' }, text: U.formatSecondsToHHMM(row.totalSeconds) })
                ]));
            });
            list.appendChild(rows);
            statsBody.appendChild(list);
        }

        const best = bestTimeOfDay();
        if (best) {
            statsBody.appendChild(U.el('div', { className: 'card flex items-center gap-3', attrs: { style: 'padding:1rem 1.5rem' } }, [
                U.el('span', { className: 'material-symbols-outlined text-primary', attrs: { 'aria-hidden': 'true', style: 'font-size:1.5rem' }, text: TIME_BUCKET_ICON[best] }),
                U.el('p', { attrs: { style: 'font-size:0.8125rem' }, text: I18n.t('stats.bestTimeOfDay', { time: I18n.t('stats.bucket.' + best) }) })
            ]));
        }
    }

    document.getElementById('openStatsBtn').addEventListener('click', () => { render(); TFS.Modal.open(statsModal); });
    document.getElementById('closeStatsBtn').addEventListener('click', () => TFS.Modal.close(statsModal));
    I18n.onChange(() => { if (TFS.Modal.isOpen(statsModal)) render(); });

    TFS.Stats = { weeklyComparison, minutesPerSubject, bestTimeOfDay, weeklySummaryMessage };

})(window);
