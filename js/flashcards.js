/**
 * flashcards.js
 * Screen 5: vocabulary decks and the flip-card review flow, scheduled by
 * js/srs.js's SM-2 algorithm.
 *
 * Deck *data* (`state.flashcards.decks`, persisted, mutated by stable id) is
 * kept completely separate from the *review session* (`sessionOrder`/
 * `sessionIndex`/`sessionResults`, an in-memory-only ordering + score for
 * the current pass through the deck) — this avoids two old bugs: adding a
 * card while on the results screen used to wipe the whole session's stats,
 * and deleting a card could delete the wrong one when two cards matched by
 * value. Adding a card appends its id to the session in place; deleting a
 * card removes it by id from both — never by matching term/definition text.
 *
 * A review session is composed from two pools, same as most spaced-
 * repetition apps: every card already due today or overdue (from
 * `state.flashcards.srs`), plus brand-new cards up to a daily cap
 * (`newCardsPerDayLimit`, default 20) so a huge deck can't dump hundreds of
 * unseen cards into one sitting. Grading a card ("Again"/"Hard"/"Good"/
 * "Easy") updates its SM-2 state and logs the outcome into a rolling
 * 30-ish-day `reviewLog`, which js/flashcards.js's "weak spots" view uses to
 * surface which decks need more attention.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};
    const U = TFS.Utils;
    const I18n = TFS.I18n;
    const State = TFS.State;
    const SRS = TFS.SRS;

    // ---- Review session (NOT persisted — this is "what am I looking at right now") ----
    let sessionOrder = [];      // card ids, in the order being reviewed (grows if a card is graded "Again")
    let sessionIndex = 0;
    let sessionResults = {};    // cardId -> true (Good/Easy) | false (Again/Hard) — drives the end-of-session summary

    function isActive() { return TFS.Router.current() === 'screen5'; }
    function todayISO() { return U.formatDateISO(new Date()); }
    function getDecks() { return State.get().flashcards.decks; }
    function getCurrentDeckId() { return State.get().flashcards.currentDeckId; }
    function getCurrentDeck() { return getDecks()[getCurrentDeckId()] || null; }
    function getDeckOrder() {
        const order = State.get().flashcards.deckOrder;
        const decks = getDecks();
        // Defensive: include any deck id present in `decks` but missing from
        // `deckOrder` (e.g. after a hand-edited import) so nothing becomes invisible.
        const extra = Object.keys(decks).filter(id => !order.includes(id));
        return [...order, ...extra];
    }

    function cardById(id) {
        const deck = getCurrentDeck();
        return deck ? deck.cards.find(c => c.id === id) : null;
    }

    // ---------------------------------------------------------------- New-card daily cap

    function ensureNewCardWindowFresh() {
        const shown = State.get().flashcards.newCardsShownToday;
        if (shown.dateISO !== todayISO()) {
            State.commit({ flashcards: { newCardsShownToday: { dateISO: todayISO(), cardIds: [] } } });
        }
    }
    function newCardsRemainingToday() {
        ensureNewCardWindowFresh();
        const limit = State.get().flashcards.newCardsPerDayLimit || 20;
        return Math.max(0, limit - State.get().flashcards.newCardsShownToday.cardIds.length);
    }
    function markNewCardsShown(cardIds) {
        if (!cardIds.length) return;
        ensureNewCardWindowFresh();
        const shown = State.get().flashcards.newCardsShownToday;
        State.commit({ flashcards: { newCardsShownToday: { dateISO: todayISO(), cardIds: [...shown.cardIds, ...cardIds] } } });
    }

    /** Builds today's review queue: everything due/overdue first, then as
     *  many never-seen cards as today's new-card allowance still has room
     *  for. A card shown earlier today but not yet graded (session was left
     *  mid-way) is treated as "due" rather than "new" so resuming never
     *  double-spends the daily cap. */
    function startSessionFromDeck() {
        const deck = getCurrentDeck();
        sessionResults = {};
        sessionIndex = 0;
        if (!deck) { sessionOrder = []; return; }

        ensureNewCardWindowFresh();
        const today = todayISO();
        const shownTodaySet = new Set(State.get().flashcards.newCardsShownToday.cardIds);
        const srsMap = State.get().flashcards.srs;

        const due = [];
        const brandNew = [];
        deck.cards.forEach(c => {
            const srsState = srsMap[c.id];
            if (srsState) {
                if (SRS.isDue(srsState, today)) due.push(c.id);
            } else if (shownTodaySet.has(c.id)) {
                due.push(c.id); // introduced today already, not yet graded — keep it, don't re-spend the cap
            } else {
                brandNew.push(c.id);
            }
        });

        const newToInclude = brandNew.slice(0, newCardsRemainingToday());
        if (newToInclude.length) markNewCardsShown(newToInclude);
        sessionOrder = [...due, ...newToInclude];
    }

    function logReview(deckId, grade) {
        const cutoffISO = U.formatDateISO(U.addDays(new Date(), -35));
        const log = State.get().flashcards.reviewLog.filter(e => e.dateISO >= cutoffISO);
        log.push({ dateISO: todayISO(), deckId, grade });
        State.commit({ flashcards: { reviewLog: log } });
    }

    // ---------------------------------------------------------------- Deck mutation helpers

    function commitDecks(newDecks) { State.commit({ flashcards: { decks: newDecks } }); }

    function addDeck(name) {
        const id = U.uuid();
        const decks = { ...getDecks(), [id]: { id, subjectId: null, name, cards: [] } };
        const deckOrder = [...getDeckOrder(), id];
        State.commit({ flashcards: { decks, deckOrder, currentDeckId: id } });
        startSessionFromDeck();
    }

    function switchDeck(deckId) {
        State.commit({ flashcards: { currentDeckId: deckId } });
        startSessionFromDeck();
        render();
    }

    function addCardToCurrentDeck(term, def, ex) {
        const deck = getCurrentDeck();
        const newCard = { id: U.uuid(), term, def, ex };
        const decks = { ...getDecks(), [deck.id]: { ...deck, cards: [...deck.cards, newCard] } };
        commitDecks(decks);
        sessionOrder = [...sessionOrder, newCard.id]; // append only — never touches existing progress
    }

    function deleteCardFromCurrentDeck(cardId) {
        const deck = getCurrentDeck();
        const decks = { ...getDecks(), [deck.id]: { ...deck, cards: deck.cards.filter(c => c.id !== cardId) } };
        commitDecks(decks);

        const srsMap = { ...State.get().flashcards.srs };
        if (srsMap[cardId]) { delete srsMap[cardId]; State.commit({ flashcards: { srs: srsMap } }); }

        const removedIdx = sessionOrder.indexOf(cardId);
        sessionOrder = sessionOrder.filter(id => id !== cardId);
        delete sessionResults[cardId];
        if (removedIdx > -1) {
            if (sessionIndex > removedIdx) sessionIndex--;
            else if (sessionIndex >= sessionOrder.length && sessionIndex > 0) sessionIndex--;
        }
    }

    // ---------------------------------------------------------------- Deck selector modal

    const deckSelectorModal = document.getElementById('deckSelectorModal');
    const deckListContainer = document.getElementById('deckListContainer');
    const customDeckSelectorBtn = document.getElementById('customDeckSelectorBtn');
    const currentDeckLabel = document.getElementById('currentDeckLabel');

    customDeckSelectorBtn.addEventListener('click', () => {
        deckListContainer.innerHTML = '';
        const decks = getDecks();
        getDeckOrder().forEach(deckId => {
            const deck = decks[deckId];
            if (!deck) return;
            const isCurrent = deckId === getCurrentDeckId();
            const btn = U.el('button', {
                className: 'search-result-item w-full',
                attrs: { type: 'button', style: `border:2px solid ${isCurrent ? 'var(--color-primary)' : 'transparent'};background:${isCurrent ? 'var(--color-primary-fixed)' : 'var(--color-surface-lowest)'}` },
                on: { click: () => { switchDeck(deckId); TFS.Modal.close(deckSelectorModal); } }
            }, [
                U.el('span', { className: 'flex items-center gap-3' }, [
                    U.el('span', { className: 'material-symbols-outlined text-primary', attrs: { 'aria-hidden': 'true' }, text: 'folder' }),
                    U.el('span', {}, [
                        U.el('h3', { attrs: { style: 'font-weight:700;font-size:0.875rem' }, text: deck.name }),
                        U.el('p', { className: 'text-outline', attrs: { style: 'font-size:0.6875rem' }, text: I18n.t('modalDeckSelector.wordsCount', { n: deck.cards.length }) })
                    ])
                ]),
                isCurrent ? U.el('span', { className: 'material-symbols-outlined text-primary', attrs: { 'aria-hidden': 'true' }, text: 'check_circle' }) : document.createTextNode('')
            ]);
            deckListContainer.appendChild(btn);
        });
        TFS.Modal.open(deckSelectorModal);
    });

    document.getElementById('closeDeckSelectorBtn').addEventListener('click', () => TFS.Modal.close(deckSelectorModal));
    document.getElementById('btnOpenAddDeckModalFromSelector').addEventListener('click', () => {
        TFS.Modal.close(deckSelectorModal);
        setTimeout(() => TFS.Modal.open(addDeckModal), 200);
    });

    // ---------------------------------------------------------------- Weak decks modal (Phase 4's "weak-topic view",
    // adapted to this app's deck-per-topic-area structure — see file header)

    const weakDecksModal = document.getElementById('weakDecksModal');
    const weakDecksBody = document.getElementById('weakDecksBody');

    function deckAccuracyLast30Days() {
        const cutoffISO = U.formatDateISO(U.addDays(new Date(), -30));
        const log = State.get().flashcards.reviewLog.filter(e => e.dateISO >= cutoffISO);
        const decks = getDecks();
        const byDeck = {};
        log.forEach(e => {
            if (!decks[e.deckId]) return; // deck since deleted
            if (!byDeck[e.deckId]) byDeck[e.deckId] = { correct: 0, total: 0 };
            byDeck[e.deckId].total++;
            if (e.grade === 'good' || e.grade === 'easy') byDeck[e.deckId].correct++;
        });
        return Object.keys(byDeck)
            .map(id => ({ deckId: id, name: decks[id].name, total: byDeck[id].total, accuracy: Math.round((byDeck[id].correct / byDeck[id].total) * 100) }))
            .sort((a, b) => a.accuracy - b.accuracy);
    }

    document.getElementById('btnOpenWeakDecks').addEventListener('click', () => {
        weakDecksBody.innerHTML = '';
        const rows = deckAccuracyLast30Days();
        if (rows.length === 0) {
            weakDecksBody.appendChild(U.el('p', { className: 'text-outline text-center', attrs: { style: 'padding:1.5rem 0' }, text: I18n.t('modalWeakDecks.empty') }));
        } else {
            rows.forEach(row => {
                weakDecksBody.appendChild(U.el('button', {
                    className: 'search-result-item w-full', attrs: { type: 'button' },
                    on: { click: () => { switchDeck(row.deckId); TFS.Modal.close(weakDecksModal); } }
                }, [
                    U.el('span', {}, [
                        U.el('h3', { attrs: { style: 'font-weight:700;font-size:0.875rem' }, text: row.name }),
                        U.el('p', { className: 'text-outline', attrs: { style: 'font-size:0.6875rem' }, text: I18n.t('modalWeakDecks.reviewCount', { n: row.total }) })
                    ]),
                    U.el('span', { attrs: { style: `font-weight:800;font-size:1.125rem;color:${row.accuracy < 60 ? 'var(--color-danger)' : (row.accuracy < 80 ? '#b45309' : 'var(--color-success)')}` }, text: row.accuracy + '%' })
                ]));
            });
        }
        TFS.Modal.open(weakDecksModal);
    });
    document.getElementById('closeWeakDecksBtn').addEventListener('click', () => TFS.Modal.close(weakDecksModal));

    // ---------------------------------------------------------------- Add deck modal

    const addDeckModal = document.getElementById('addDeckModal');
    const deckNameInput = document.getElementById('deckNameInput');

    document.getElementById('closeAddDeckBtn').addEventListener('click', () => TFS.Modal.close(addDeckModal));
    document.getElementById('saveAddDeckBtn').addEventListener('click', () => {
        const name = deckNameInput.value.trim();
        if (!name) { TFS.Toast.error(I18n.t('modalAddDeck.errRequired')); return; }
        const exists = Object.values(getDecks()).some(d => d.name.trim().toLowerCase() === name.toLowerCase());
        if (exists) { TFS.Toast.error(I18n.t('modalAddDeck.errExists')); return; }

        addDeck(name);
        deckNameInput.value = '';
        TFS.Modal.close(addDeckModal);
        render();
    });

    // ---------------------------------------------------------------- Add / delete card modals

    const addFcModal = document.getElementById('addFlashcardModal');
    const btnOpenAddFlashcard = document.getElementById('btnOpenAddFlashcard');
    const btnOpenDeleteFlashcard = document.getElementById('btnOpenDeleteFlashcard');

    btnOpenAddFlashcard.addEventListener('click', () => {
        if (!getCurrentDeckId()) { TFS.Toast.warn(I18n.t('s5.selectDeckFirst')); return; }
        TFS.Modal.open(addFcModal);
    });
    document.getElementById('closeAddFcBtn').addEventListener('click', () => TFS.Modal.close(addFcModal));
    document.getElementById('saveAddFcBtn').addEventListener('click', () => {
        const term = document.getElementById('fcInputTerm').value.trim();
        const def = document.getElementById('fcInputDef').value.trim();
        const ex = document.getElementById('fcInputEx').value.trim();
        if (!term || !def) { TFS.Toast.error(I18n.t('modalAddCard.errRequired')); return; }

        addCardToCurrentDeck(term, def, ex);
        document.getElementById('fcInputTerm').value = '';
        document.getElementById('fcInputDef').value = '';
        document.getElementById('fcInputEx').value = '';
        TFS.Modal.close(addFcModal);
        render();
    });

    const deleteFcMenuModal = document.getElementById('deleteFlashcardMenuModal');
    const deleteWordSelect = document.getElementById('deleteWordSelect');

    btnOpenDeleteFlashcard.addEventListener('click', () => {
        const deck = getCurrentDeck();
        if (!deck || deck.cards.length === 0) return;
        deleteWordSelect.innerHTML = '';
        const currentCardId = sessionOrder[sessionIndex];
        deck.cards.forEach(card => {
            deleteWordSelect.appendChild(U.el('option', { attrs: { value: card.id, selected: card.id === currentCardId || undefined }, text: card.term }));
        });
        TFS.Modal.open(deleteFcMenuModal);
    });

    document.getElementById('closeDeleteMenuBtn').addEventListener('click', () => TFS.Modal.close(deleteFcMenuModal));
    document.getElementById('confirmDeleteMenuBtn').addEventListener('click', () => {
        const cardId = deleteWordSelect.value;
        if (!cardId) return;
        deleteCardFromCurrentDeck(cardId);
        TFS.Modal.close(deleteFcMenuModal);
        render();
    });

    // ---------------------------------------------------------------- Review UI

    const flashcardInner = document.getElementById('flashcardInner');
    const flashcardContainer = document.getElementById('flashcardContainer');
    const flashcardEmptyState = document.getElementById('flashcardEmptyState');
    const flashcardActionButtons = document.getElementById('flashcardActionButtons');
    const flashcardSummaryButtons = document.getElementById('flashcardSummaryButtons');
    const flashcardTipContainer = document.getElementById('flashcardTipContainer');
    const flashcardProgressText = document.getElementById('flashcardProgressText');
    const flashcardProgressBar = document.getElementById('flashcardProgressBar');
    const flashcardTerm = document.getElementById('flashcardTerm');
    const flashcardHint = document.getElementById('flashcardHint');
    const flashcardIconContainer = document.getElementById('flashcardIconContainer');
    const flashcardDef = document.getElementById('flashcardDef');
    const flashcardExContainer = document.getElementById('flashcardExContainer');
    const flashcardEx = document.getElementById('flashcardEx');
    const btnRestartFlashcards = document.getElementById('btnRestartFlashcards');
    const btnRestartText = document.getElementById('btnRestartText');

    function render() {
        const deck = getCurrentDeck();
        currentDeckLabel.textContent = deck ? deck.name : I18n.t('s5.selectDeckFirst');
        flashcardInner.classList.remove('is-flipped');

        if (!deck || deck.cards.length === 0) {
            flashcardContainer.style.display = 'none';
            flashcardEmptyState.style.display = 'flex';
            flashcardActionButtons.style.display = 'none';
            flashcardSummaryButtons.style.display = 'none';
            flashcardTipContainer.style.display = 'none';
            btnOpenDeleteFlashcard.hidden = true;
            btnOpenAddFlashcard.hidden = !deck;
            flashcardProgressText.textContent = I18n.t('s5.progressCount', { current: 0, total: 0 });
            flashcardProgressBar.style.width = '0%';
            return;
        }

        flashcardEmptyState.style.display = 'none';
        flashcardContainer.style.display = 'block';
        btnOpenAddFlashcard.hidden = false;

        if (sessionOrder.length === 0) {
            renderNothingDue();
            return;
        }

        if (sessionIndex >= sessionOrder.length) {
            renderSummary(deck);
            return;
        }

        flashcardActionButtons.style.display = 'grid';
        flashcardSummaryButtons.style.display = 'none';
        flashcardTipContainer.style.display = 'flex';
        btnOpenDeleteFlashcard.hidden = false;
        flashcardIconContainer.style.display = 'block';

        const card = cardById(sessionOrder[sessionIndex]);
        flashcardTerm.textContent = card.term;
        flashcardHint.textContent = I18n.t('s5.hintTap');
        flashcardDef.textContent = card.def;
        flashcardExContainer.style.background = 'var(--color-tertiary-fixed)';
        flashcardEx.style.color = 'var(--color-on-tertiary-fixed)';
        flashcardEx.style.textAlign = 'left';
        flashcardEx.textContent = card.ex ? I18n.t('s5.example', { ex: card.ex }) : I18n.t('s5.noExample');

        const progressPct = Math.round((sessionIndex / sessionOrder.length) * 100);
        flashcardProgressText.textContent = I18n.t('s5.progressCount', { current: sessionIndex + 1, total: sessionOrder.length });
        flashcardProgressBar.style.width = progressPct + '%';
    }

    /** Everything in the deck is fully scheduled for a future date and
     *  today's new-card allowance (if any cards are still unseen) is used
     *  up — a genuinely good state, not an error, so it reads as a
     *  congratulation rather than a dead end. */
    function renderNothingDue() {
        flashcardIconContainer.style.display = 'none';
        btnOpenDeleteFlashcard.hidden = true;
        flashcardActionButtons.style.display = 'none';
        flashcardTipContainer.style.display = 'none';

        flashcardTerm.textContent = I18n.t('s5.nothingDueTitle');
        flashcardHint.textContent = I18n.t('s5.nothingDueHint');
        flashcardDef.innerHTML = '';
        flashcardExContainer.style.background = 'var(--color-primary-fixed)';
        flashcardEx.style.color = 'var(--color-primary)';
        flashcardEx.style.textAlign = 'center';
        flashcardEx.style.fontWeight = '700';
        const deck = getCurrentDeck();
        const capped = newCardsRemainingToday() === 0 && deck.cards.some(c => !State.get().flashcards.srs[c.id]);
        flashcardEx.textContent = capped ? I18n.t('s5.newCardCapHint', { n: State.get().flashcards.newCardsPerDayLimit }) : '';

        flashcardProgressText.textContent = I18n.t('s5.progressCount', { current: 0, total: 0 });
        flashcardProgressBar.style.width = '0%';

        setTimeout(() => flashcardInner.classList.add('is-flipped'), 150);

        flashcardSummaryButtons.style.display = 'flex';
        btnRestartFlashcards.style.display = 'none';
    }

    function renderSummary(deck) {
        flashcardIconContainer.style.display = 'none';
        btnOpenDeleteFlashcard.hidden = true;

        const total = sessionOrder.length;
        const correct = sessionOrder.filter(id => sessionResults[id] === true).length;
        const wrong = total - correct;
        const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

        if (wrong === 0) {
            flashcardTerm.textContent = I18n.t('s5.perfectTitle');
            flashcardHint.textContent = I18n.t('s5.perfectHint');
            btnRestartFlashcards.style.display = 'none';
        } else {
            flashcardTerm.textContent = I18n.t('s5.summaryTitle');
            flashcardHint.textContent = I18n.t('s5.summaryHint');
            btnRestartText.textContent = I18n.t('s5.restartWrongCount', { n: wrong });
            btnRestartFlashcards.style.display = 'flex';
        }

        flashcardDef.innerHTML = '';
        flashcardDef.appendChild(U.el('div', { className: 'flex flex-col gap-3', attrs: { style: 'font-size:1.125rem;width:100%;align-items:center' } }, [
            U.el('div', { attrs: { style: 'display:flex;align-items:center;gap:0.5rem;background:#ecfdf3;color:#15803d;padding:0.75rem 1.5rem;border-radius:1rem;width:100%;justify-content:center' } }, [
                U.el('span', { className: 'material-symbols-outlined', attrs: { 'aria-hidden': 'true' }, text: 'check_circle' }),
                U.el('span', { attrs: { style: 'font-weight:700' }, text: I18n.t('s5.correctCount', { n: correct }) })
            ]),
            // Deliberately not red: a card graded "Again" just needs another
            // look, not a failure marker (this app never uses red/guilt
            // copy for a study outcome — see js/streak.js's file header for
            // the same "forgiving by design" principle applied here).
            U.el('div', { attrs: { style: 'display:flex;align-items:center;gap:0.5rem;background:var(--color-surface-low);color:var(--color-on-surface);padding:0.75rem 1.5rem;border-radius:1rem;width:100%;justify-content:center' } }, [
                U.el('span', { className: 'material-symbols-outlined text-outline', attrs: { 'aria-hidden': 'true' }, text: 'refresh' }),
                U.el('span', { attrs: { style: 'font-weight:700' }, text: I18n.t('s5.wrongCount', { n: wrong }) })
            ])
        ]));

        flashcardExContainer.style.background = 'var(--color-primary-fixed)';
        flashcardEx.style.color = 'var(--color-primary)';
        flashcardEx.style.textAlign = 'center';
        flashcardEx.style.fontWeight = '700';
        flashcardEx.textContent = I18n.t('s5.accuracy', { pct: accuracy });

        flashcardProgressText.textContent = I18n.t('s5.progressCount', { current: total, total });
        flashcardProgressBar.style.width = '100%';

        setTimeout(() => flashcardInner.classList.add('is-flipped'), 150);

        flashcardActionButtons.style.display = 'none';
        flashcardSummaryButtons.style.display = 'flex';
    }

    function flipIfReviewing() {
        if (sessionIndex < sessionOrder.length) flashcardInner.classList.toggle('is-flipped');
    }
    flashcardContainer.addEventListener('click', flipIfReviewing);
    flashcardContainer.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flipIfReviewing(); } });

    /** Applies one SM-2 grade to the card currently on screen: updates its
     *  schedule, logs the outcome for the weak-decks view, and — only for
     *  "Again" — requeues it later in this same session so a forgotten card
     *  gets one more look today instead of waiting until its next scheduled
     *  date (which "again" just reset to today anyway). */
    function gradeCurrentCard(grade) {
        const deck = getCurrentDeck();
        const cardId = sessionOrder[sessionIndex];
        const prevSrs = State.get().flashcards.srs[cardId] || null;
        const nextSrs = SRS.gradeCard(prevSrs, grade, todayISO());
        State.commit({ flashcards: { srs: { ...State.get().flashcards.srs, [cardId]: nextSrs } } });
        logReview(deck.id, grade);

        // "Hard" still means the learner recalled it — only "Again" (a true
        // miss) counts against the session summary below; conflating the two
        // would understate genuine recall and read as harsher than it is.
        sessionResults[cardId] = (grade !== 'again');
        if (grade === 'again') sessionOrder = [...sessionOrder, cardId];
        sessionIndex++;
        render();
    }

    document.getElementById('btnGradeAgain').addEventListener('click', () => gradeCurrentCard('again'));
    document.getElementById('btnGradeHard').addEventListener('click', () => gradeCurrentCard('hard'));
    document.getElementById('btnGradeGood').addEventListener('click', () => gradeCurrentCard('good'));
    document.getElementById('btnGradeEasy').addEventListener('click', () => gradeCurrentCard('easy'));

    btnRestartFlashcards.addEventListener('click', () => {
        sessionOrder = sessionOrder.filter(id => sessionResults[id] !== true);
        sessionIndex = 0;
        render();
    });
    document.getElementById('btnReviewAllFlashcards').addEventListener('click', () => {
        // "Review the whole deck anyway" deliberately bypasses the due-date
        // gate (but never the daily new-card cap) — sometimes a learner just
        // wants a refresher, not to wait for the schedule.
        const deck = getCurrentDeck();
        sessionOrder = deck ? deck.cards.map(c => c.id) : [];
        sessionIndex = 0;
        sessionResults = {};
        render();
    });

    I18n.onChange(() => { if (isActive()) render(); });

    TFS.Router.register('screen5', {
        onEnter: () => {
            TFS.Nav.show(); TFS.Nav.setActive('flash');
            if (!getCurrentDeckId() || !getDecks()[getCurrentDeckId()]) {
                const order = getDeckOrder();
                if (order.length) State.commit({ flashcards: { currentDeckId: order[0] } });
            }
            startSessionFromDeck();
            render();
        }
    });

})(window);
