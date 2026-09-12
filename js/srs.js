/**
 * srs.js
 * A pure, dependency-free SM-2 spaced-repetition scheduler — no DOM, no
 * State reads/writes, so it can be reasoned about (and manually verified,
 * see test-srs.html) in isolation from the review UI in js/flashcards.js.
 *
 * This is a simplified SM-2, adapted for 4 grade buttons (Again/Hard/Good/
 * Easy) instead of SuperMemo's original 6-point 0-5 quality scale — the
 * same adaptation most modern flashcard apps make, since almost nobody can
 * usefully distinguish 6 shades of "how well did I know that". The core
 * SM-2 ideas are kept: an ease factor that grows or shrinks with how easy a
 * card felt, floored so a card can never become impossibly hard to
 * graduate from; an interval that grows geometrically (interval * ease)
 * once a card is past its first two repetitions; and a full reset back to
 * the beginning whenever a card is graded "Again".
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};
    const U = TFS.Utils;

    const DEFAULT_EASE = 2.5;
    const MIN_EASE = 1.3;
    const GRADES = ['again', 'hard', 'good', 'easy'];

    /** A brand-new card's scheduling state — due immediately, since it has
     *  never been reviewed. */
    function newCardState() {
        return { easeFactor: DEFAULT_EASE, intervalDays: 0, repetitions: 0, dueDateISO: null };
    }

    function isDue(cardState, todayISO) {
        if (!cardState || !cardState.dueDateISO) return true; // never scheduled yet == due now
        return cardState.dueDateISO <= todayISO;
    }

    /**
     * Applies one grade to a card's current scheduling state and returns the
     * *new* state — never mutates its input, so callers can commit it
     * straight into state.flashcards.srs.
     *
     * - "again": full reset. Repetitions back to 0, ease drops (floored),
     *   and the card is due again today so it resurfaces later in the very
     *   same review session rather than tomorrow.
     * - "hard"/"good"/"easy": repetitions advance, ease adjusts by a small
     *   amount either way, and the interval grows — linearly for the first
     *   two repetitions (classic SM-2's fixed 1-day/3-day bootstrap), then
     *   geometrically (interval * ease, nudged further by how easy this
     *   particular grade felt) after that.
     */
    function gradeCard(cardState, grade, todayISO) {
        const today = todayISO || U.formatDateISO(new Date());
        const from = cardState || newCardState();
        let { easeFactor, intervalDays, repetitions } = from;

        if (grade === 'again') {
            return {
                easeFactor: Math.max(MIN_EASE, easeFactor - 0.2),
                intervalDays: 0,
                repetitions: 0,
                dueDateISO: today
            };
        }

        const easeDelta = { hard: -0.15, good: 0, easy: 0.15 }[grade] || 0;
        easeFactor = Math.max(MIN_EASE, easeFactor + easeDelta);
        repetitions += 1;

        if (repetitions === 1) {
            intervalDays = 1;
        } else if (repetitions === 2) {
            intervalDays = grade === 'hard' ? 2 : (grade === 'easy' ? 4 : 3);
        } else {
            const growthFactor = grade === 'hard' ? 0.8 : (grade === 'easy' ? 1.15 : 1);
            intervalDays = Math.max(1, Math.round(intervalDays * easeFactor * growthFactor));
        }

        const dueDateISO = U.formatDateISO(U.addDays(U.parseISODate(today), intervalDays));
        return { easeFactor, intervalDays, repetitions, dueDateISO };
    }

    TFS.SRS = { GRADES, DEFAULT_EASE, MIN_EASE, newCardState, isDue, gradeCard };

})(window);
