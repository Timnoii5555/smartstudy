/**
 * flashcards.js
 * Screen 5: vocabulary decks and the flip-card review flow.
 *
 * Fixes bug 1.4 (adding a card while on the results screen used to wipe the
 * whole session's stats) and bug 1.5 (deleting a card could delete the wrong
 * one when two cards matched by value): deck *data* (`state.flashcards.decks`,
 * persisted, mutated by stable id) is kept completely separate from the
 * *review session* (`sessionOrder`/`sessionIndex`/`sessionResults`, an
 * in-memory-only ordering + score for the current pass through the deck).
 * Adding a card appends its id to the session in place; deleting a card
 * removes it by id from both — never by matching term/definition text.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};
    const U = TFS.Utils;
    const I18n = TFS.I18n;
    const State = TFS.State;

    // ---- Review session (NOT persisted — this is "what am I looking at right now") ----
    let sessionOrder = [];      // card ids, in the order being reviewed
    let sessionIndex = 0;
    let sessionResults = {};    // cardId -> true (remembered) | false (not yet)

    function isActive() { return TFS.Router.current() === 'screen5'; }
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

    function startSessionFromDeck() {
        const deck = getCurrentDeck();
        sessionOrder = deck ? deck.cards.map(c => c.id) : [];
        sessionIndex = 0;
        sessionResults = {};
    }

    function cardById(id) {
        const deck = getCurrentDeck();
        return deck ? deck.cards.find(c => c.id === id) : null;
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
        sessionOrder.forEach(id => {
            const card = cardById(id);
            if (!card) return;
            deleteWordSelect.appendChild(U.el('option', { attrs: { value: id, selected: id === currentCardId || undefined }, text: card.term }));
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
            U.el('div', { attrs: { style: 'display:flex;align-items:center;gap:0.5rem;background:#fef2f2;color:#b91c1c;padding:0.75rem 1.5rem;border-radius:1rem;width:100%;justify-content:center' } }, [
                U.el('span', { className: 'material-symbols-outlined', attrs: { 'aria-hidden': 'true' }, text: 'cancel' }),
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

    document.getElementById('btnReviewAgain').addEventListener('click', () => {
        sessionResults[sessionOrder[sessionIndex]] = false;
        sessionIndex++;
        render();
    });
    document.getElementById('btnRemembered').addEventListener('click', () => {
        sessionResults[sessionOrder[sessionIndex]] = true;
        sessionIndex++;
        render();
    });
    btnRestartFlashcards.addEventListener('click', () => {
        sessionOrder = sessionOrder.filter(id => sessionResults[id] !== true);
        sessionIndex = 0;
        render();
    });
    document.getElementById('btnReviewAllFlashcards').addEventListener('click', () => {
        startSessionFromDeck();
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
