/**
 * planner.js
 * Turns "which subject, which exam date, how many hours a day, in what
 * order" into a concrete day-by-day reading plan: which topics are due on
 * which date. Pure functions only — no DOM, no State reads/writes — so it
 * can be unit-tested in isolation and reused by both onboarding.js (when the
 * plan is first generated) and dashboard.js (to render "today's to-do").
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};
    const U = TFS.Utils;

    // Every option the "how do you want to order your reading?" step in
    // screen 2 can offer. Kept here (not just in i18n) because onboarding.js
    // needs the list of valid ids, not just their labels.
    const ORDER_STRATEGIES = ['sequential', 'easyFirst', 'hardFirst', 'balanced'];

    function orderTopics(topics, strategy) {
        const arr = topics.slice();
        const diff = (t) => t.difficulty || 2;
        if (strategy === 'easyFirst') return arr.sort((a, b) => diff(a) - diff(b));
        if (strategy === 'hardFirst') return arr.sort((a, b) => diff(b) - diff(a));
        if (strategy === 'balanced') {
            // Round-robin hard/medium/easy so tough topics are spread across the
            // whole plan instead of all landing back-to-back on the same days.
            const byDiff = { 1: [], 2: [], 3: [] };
            arr.forEach(t => byDiff[diff(t)].push(t));
            const out = [];
            while (byDiff[1].length || byDiff[2].length || byDiff[3].length) {
                [3, 2, 1].forEach(d => { if (byDiff[d].length) out.push(byDiff[d].shift()); });
            }
            return out;
        }
        return arr; // 'sequential' (or unknown) — keep the syllabus's own order
    }

    /**
     * Greedily pack ordered topics into days from `todayDate` up to (but not
     * including) `examDateISO`, filling each day up to `dailyGoalSeconds`
     * worth of estimated minutes before spilling into the next day. If the
     * subject has more content than days-until-exam allow, the overflow is
     * crammed onto the final available day rather than scheduled past the
     * exam or silently dropped — better a heavy last day than a plan that
     * quietly leaves topics unread.
     *
     * Returns `{ subjectId, orderStrategy, generatedAt, days: [{dateISO, topicIds}] }`,
     * or null if there is no subject to plan for.
     */
    function buildReadingPlan({ subject, examDateISO, dailyGoalSeconds, orderStrategy, todayDate, completedTopicIds = [] }) {
        if (!subject) return null;
        const today0 = U.startOfDay(todayDate || new Date());
        const remaining = subject.topics.filter(t => !completedTopicIds.includes(t.id));

        if (remaining.length === 0) {
            return { subjectId: subject.id, orderStrategy, generatedAt: U.formatDateISO(today0), days: [] };
        }

        const ordered = orderTopics(remaining, orderStrategy);
        const examDate = examDateISO ? U.parseISODate(examDateISO) : null;
        // Days available to study BEFORE the exam (today counts, exam day itself doesn't).
        const daysAvailable = examDate ? Math.max(1, Math.ceil((examDate - today0) / 86400000)) : Infinity;
        const dailyBudgetMin = Math.max(15, Math.round((dailyGoalSeconds || 4.5 * 3600) / 60));

        const days = [];
        let cursor = 0;
        let dayOffset = 0;

        while (cursor < ordered.length) {
            const dateISO = U.formatDateISO(U.addDays(today0, dayOffset));
            let budgetLeft = dailyBudgetMin;
            const topicIds = [];

            while (cursor < ordered.length) {
                const topic = ordered[cursor];
                const est = topic.estMinutes || 120;
                // Always seat at least one topic per day, even one bigger than the
                // whole daily budget, so a single long topic can never stall the loop.
                if (topicIds.length > 0 && est > budgetLeft) break;
                topicIds.push(topic.id);
                budgetLeft -= est;
                cursor++;
            }

            days.push({ dateISO, topicIds });
            dayOffset++;

            if (isFinite(daysAvailable) && dayOffset >= daysAvailable && cursor < ordered.length) {
                // Out of days before the exam — pile whatever's left onto the last day.
                const lastDay = days[days.length - 1];
                while (cursor < ordered.length) { lastDay.topicIds.push(ordered[cursor].id); cursor++; }
                break;
            }
        }

        return { subjectId: subject.id, orderStrategy, generatedAt: U.formatDateISO(today0), days };
    }

    /** Topic ids scheduled for exactly this date. */
    function topicsForDate(plan, dateISO) {
        if (!plan) return [];
        const day = plan.days.find(d => d.dateISO === dateISO);
        return day ? day.topicIds : [];
    }

    /**
     * Every topic id scheduled on or before `dateISO` (i.e. everything "due by
     * now"). Falling a day behind should roll that day's unfinished topics
     * forward into today's list rather than making them vanish — the caller
     * is expected to filter out ones already marked complete.
     */
    function topicsDueBy(plan, dateISO) {
        if (!plan) return [];
        const ids = [];
        for (const day of plan.days) {
            if (day.dateISO > dateISO) break;
            ids.push(...day.topicIds);
        }
        return ids;
    }

    /**
     * "Not up for it today" (screen 3): moves `topicIds` off of `fromDateISO`
     * and greedily re-packs them into the following days, respecting each
     * day's remaining minute budget exactly like buildReadingPlan does. If
     * every existing day already has a full plate (e.g. the exam is
     * tomorrow), new days are appended right after the plan rather than
     * silently dropping the deferred topics — nothing scheduled ever just
     * vanishes because there was no room for it.
     */
    function redistributeIncomplete(plan, fromDateISO, topicIds, dailyGoalSeconds, subjectTopics) {
        if (!plan || !topicIds || topicIds.length === 0) return plan;
        const dailyBudgetMin = Math.max(15, Math.round((dailyGoalSeconds || 4.5 * 3600) / 60));
        const estById = {};
        (subjectTopics || []).forEach(t => { estById[t.id] = t.estMinutes || 120; });
        const minutesOf = (id) => estById[id] || 120;

        const days = plan.days.map(d => ({ dateISO: d.dateISO, topicIds: d.topicIds.slice() }));
        const fromIdx = days.findIndex(d => d.dateISO === fromDateISO);
        if (fromIdx === -1) return plan;

        const deferSet = new Set(topicIds);
        days[fromIdx].topicIds = days[fromIdx].topicIds.filter(id => !deferSet.has(id));

        const queue = topicIds.slice();
        let idx = fromIdx + 1;
        while (queue.length) {
            if (idx >= days.length) {
                const lastISO = days.length ? days[days.length - 1].dateISO : fromDateISO;
                days.push({ dateISO: U.formatDateISO(U.addDays(U.parseISODate(lastISO), 1)), topicIds: [] });
            }
            const day = days[idx];
            let load = day.topicIds.reduce((sum, id) => sum + minutesOf(id), 0);
            // Always seat at least one topic on a day even if it alone exceeds
            // the budget, same rule buildReadingPlan uses, so a single big
            // deferred topic can never stall this loop either.
            while (queue.length && (day.topicIds.length === 0 || load + minutesOf(queue[0]) <= dailyBudgetMin)) {
                const id = queue.shift();
                day.topicIds.push(id);
                load += minutesOf(id);
            }
            idx++;
        }

        return { ...plan, days };
    }

    TFS.Planner = { ORDER_STRATEGIES, orderTopics, buildReadingPlan, topicsForDate, topicsDueBy, redistributeIncomplete };

})(window);
