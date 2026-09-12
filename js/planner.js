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
     * Packs ordered topics into days from `todayDate` up to (but not
     * including) `examDateISO`, at most `dailyGoalSeconds` worth of
     * estimated minutes per day. Three rules beyond simple greedy packing:
     *
     * 1. **Spread, don't cram.** When there's real slack (more days
     *    available than the content actually needs at a steady daily
     *    pace), content is spaced out across the *whole* window instead of
     *    finishing in the first few days and leaving the rest of, say, a
     *    3-week runway completely empty. If that spacing estimate turns
     *    out too generous, the previously-skipped days quietly absorb the
     *    overflow before anything is ever crammed or dropped.
     * 2. **Rest days.** Roughly one day in seven gets zero new material,
     *    as long as the window is long enough to spare it.
     * 3. **A review-only day before the exam.** The single calendar day
     *    right before `examDateISO` never gets new material — there's
     *    nothing to review yet if this is the very first plan, but once a
     *    plan has been running a while that day is deliberately left open
     *    for revisiting what's already been read.
     *
     * If the subject genuinely has more content than the window can hold
     * even using every eligible day at full daily capacity, the overflow is
     * crammed onto the last eligible day (never past the exam, never
     * silently dropped) and reported back as `overloadMinutes` so the
     * caller can show an actionable warning instead of a silently
     * overloaded day.
     *
     * Returns `{ subjectId, orderStrategy, generatedAt, days: [{dateISO, topicIds}], overloadMinutes }`,
     * or null if there is no subject to plan for.
     */
    function buildReadingPlan({ subject, examDateISO, dailyGoalSeconds, orderStrategy, todayDate, completedTopicIds = [] }) {
        if (!subject) return null;
        const today0 = U.startOfDay(todayDate || new Date());
        const remaining = subject.topics.filter(t => !completedTopicIds.includes(t.id));

        if (remaining.length === 0) {
            return { subjectId: subject.id, orderStrategy, generatedAt: U.formatDateISO(today0), days: [], overloadMinutes: 0 };
        }

        const ordered = orderTopics(remaining, orderStrategy);
        const examDate = examDateISO ? U.parseISODate(examDateISO) : null;
        // Days available to study BEFORE the exam (today counts, exam day itself doesn't).
        const daysAvailable = examDate ? Math.max(1, Math.ceil((examDate - today0) / 86400000)) : Infinity;
        const dailyBudgetMin = Math.max(15, Math.round((dailyGoalSeconds || 4.5 * 3600) / 60));
        const totalContentMin = ordered.reduce((sum, t) => sum + (t.estMinutes || 120), 0);

        // A rest-day cadence and a reserved pre-exam review day only make
        // sense with a real, finite deadline that has room to spare — a
        // same-week cram has neither. Without an exam date at all, plan far
        // enough ahead (at the stated daily pace) to fit everything.
        const planHorizon = isFinite(daysAvailable) ? daysAvailable : Math.ceil(totalContentMin / dailyBudgetMin) + 1;
        const reservedReviewOffset = (isFinite(daysAvailable) && daysAvailable > 1) ? daysAvailable - 1 : -1;
        const isRestOffset = (o) => o > 0 && o % 7 === 6 && o !== reservedReviewOffset;

        const contentOffsets = [];
        for (let o = 0; o < planHorizon; o++) {
            if (o !== reservedReviewOffset && !isRestOffset(o)) contentOffsets.push(o);
        }
        // A pathologically short window (e.g. the exam is tomorrow) can leave
        // no "normal" content day once the review day is reserved — use
        // every day rather than schedule nothing.
        if (contentOffsets.length === 0) { for (let o = 0; o < planHorizon; o++) contentOffsets.push(o); }

        // Roughly how many days the content needs at a steady full-budget
        // pace; a rough under-estimate is fine — see the "reserve" pass below.
        const neededDays = Math.max(1, Math.ceil(totalContentMin / dailyBudgetMin));
        const stride = Math.max(1, Math.floor(contentOffsets.length / neededDays));
        const activeOffsets = new Set();
        contentOffsets.forEach((o, i) => { if (i % stride === 0) activeOffsets.add(o); });

        function packDay(cursorRef) {
            let budgetLeft = dailyBudgetMin;
            const topicIds = [];
            while (cursorRef.i < ordered.length) {
                const topic = ordered[cursorRef.i];
                const est = topic.estMinutes || 120;
                // Always seat at least one topic per day, even one bigger than
                // the whole daily budget, so a single long topic can never
                // stall the loop.
                if (topicIds.length > 0 && est > budgetLeft) break;
                topicIds.push(topic.id);
                budgetLeft -= est;
                cursorRef.i++;
            }
            return topicIds;
        }

        const days = [];
        const cursor = { i: 0 };

        // Pass 1: spaced-out days only (rest days and the reserved review
        // day always stay empty; non-selected content days are left empty
        // too, on purpose, as spacing).
        for (let o = 0; o < planHorizon && cursor.i < ordered.length; o++) {
            const dateISO = U.formatDateISO(U.addDays(today0, o));
            if (o === reservedReviewOffset || isRestOffset(o) || !activeOffsets.has(o)) {
                days.push({ dateISO, topicIds: [] });
                continue;
            }
            days.push({ dateISO, topicIds: packDay(cursor) });
        }

        // Pass 2: the spacing estimate undershot — fill in the previously-
        // skipped content-eligible days too, in calendar order, before
        // resorting to genuine overload. Rest days and the review day are
        // still never touched.
        if (cursor.i < ordered.length) {
            for (let o = 0; o < days.length && cursor.i < ordered.length; o++) {
                if (o === reservedReviewOffset || isRestOffset(o)) continue;
                if (days[o].topicIds.length > 0) continue; // already packed in pass 1
                days[o].topicIds = packDay(cursor);
            }
        }

        // Genuine overload: every eligible day is already at full capacity
        // and content is still left over. Pile it onto the last eligible
        // day rather than scheduling past the exam or dropping it, and
        // report how much didn't fit so the caller can act on it.
        let overloadMinutes = 0;
        if (cursor.i < ordered.length) {
            let idx = -1;
            for (let o = days.length - 1; o >= 0; o--) {
                if (o !== reservedReviewOffset && !isRestOffset(o)) { idx = o; break; }
            }
            if (idx === -1) {
                days.push({ dateISO: U.formatDateISO(U.addDays(today0, days.length)), topicIds: [] });
                idx = days.length - 1;
            }
            while (cursor.i < ordered.length) {
                overloadMinutes += (ordered[cursor.i].estMinutes || 120);
                days[idx].topicIds.push(ordered[cursor.i].id);
                cursor.i++;
            }
        }

        return {
            subjectId: subject.id, orderStrategy, generatedAt: U.formatDateISO(today0), days, overloadMinutes,
            // Exposed so a caller (onboarding.js) can build an accurate,
            // actionable overload message — e.g. "you'd need N hours/day" —
            // without having to re-derive the same numbers itself.
            totalContentMinutes: totalContentMin,
            eligibleContentDays: contentOffsets.length
        };
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
