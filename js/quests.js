/**
 * quests.js
 * A small daily-quest + points/level layer that sits on top of the real
 * study data (topics completed, flashcards reviewed, focus sessions run) so
 * studying feels a little more like a game. Nothing here invents new numbers
 * — every quest's progress is driven by an action that already happened
 * elsewhere (dashboard.js, flashcards.js, focus.js call `TFS.Quests.bump()`);
 * this module only tracks daily progress against a target, and turns
 * "target reached" into a claimable reward.
 *
 * State shape (see storage.js defaultState()):
 *   state.quests = { dateISO, progress: { [questId]: number }, claimed: { [questId]: true } }
 *   state.points = { total: number }
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};
    const U = TFS.Utils;
    const I18n = TFS.I18n;
    const State = TFS.State;

    const QUEST_DEFS = [
        {
            id: 'complete-topic', icon: 'menu_book', points: 15, target: 1,
            label: { th: 'อ่านเนื้อหาให้จบอย่างน้อย 1 บทวันนี้', en: 'Finish at least 1 topic today' },
            hint: { th: 'ไปที่ "หัวข้อที่ต้องอ่านวันนี้" ด้านล่าง แล้วติ๊กหัวข้อที่อ่านจบ 1 อัน', en: 'Go to "Today\'s reading topics" below and tick off one topic you finished.' }
        },
        {
            id: 'focus-session', icon: 'timer', points: 15, target: 1,
            label: { th: 'ทำ Focus Session ให้ครบ 1 รอบ', en: 'Complete 1 focus session' },
            hint: { th: 'ไปที่แท็บ "โฟกัส" กดเริ่มจับเวลา แล้วปล่อยให้ครบรอบโฟกัส 1 ครั้ง', en: 'Go to the Focus tab, press Start, and let one focus phase run to completion.' }
        },
        {
            id: 'flashcard-review', icon: 'style', points: 10, target: 10,
            label: { th: 'ทบทวนคำศัพท์ 10 คำ', en: 'Review 10 flashcards' },
            hint: { th: 'ไปที่แท็บ "แฟลชการ์ด" แล้วกด "จำได้แล้ว" หรือ "ข้าม" ให้ครบ 10 ครั้ง', en: 'Go to the Flashcards tab and tap "Got it" or "Skip" 10 times.' }
        },
        {
            id: 'daily-goal', icon: 'flag_circle', points: 25, target: 1,
            label: { th: 'ถึงเป้าหมายชั่วโมงอ่านของวันนี้', en: "Hit today's study-hour goal" },
            hint: { th: 'สะสมเวลาโฟกัสในแท็บ "โฟกัส" ให้ครบตามเป้าหมายที่ตั้งไว้', en: 'Rack up focus time on the Focus tab until it reaches your daily goal.' }
        }
    ];

    const LEVELS = [
        { min: 0, title: { th: 'นักเรียนหน้าใหม่', en: 'Freshman Learner' }, icon: 'school' },
        { min: 100, title: { th: 'นักอ่านฝึกหัด', en: 'Diligent Reader' }, icon: 'auto_stories' },
        { min: 300, title: { th: 'นักปราชญ์น้อย', en: 'Rising Scholar' }, icon: 'workspace_premium' },
        { min: 700, title: { th: 'เจ้าแห่งความรู้', en: 'Master of Knowledge' }, icon: 'military_tech' },
        { min: 1500, title: { th: 'ปรมาจารย์แห่งการสอบ', en: 'Exam Grandmaster' }, icon: 'emoji_events' }
    ];

    function todayISO() { return U.formatDateISO(new Date()); }

    function levelFor(points) {
        let current = LEVELS[0], next = LEVELS[1] || null;
        for (let i = 0; i < LEVELS.length; i++) {
            if (points >= LEVELS[i].min) { current = LEVELS[i]; next = LEVELS[i + 1] || null; }
        }
        const span = next ? (next.min - current.min) : 1;
        const into = next ? U.clamp(points - current.min, 0, span) : span;
        return { current, next, progressPct: next ? Math.round((into / span) * 100) : 100 };
    }

    /** Reset quest progress at the start of a new day. Points earned are never
     *  reset — only which quests are in progress "for today" is. */
    function ensureTodayReset() {
        const q = State.get().quests;
        if (q.dateISO !== todayISO()) {
            State.commit({ quests: { dateISO: todayISO(), progress: {}, claimed: {} } });
        }
    }

    function getProgress(questId) {
        return State.get().quests.progress[questId] || 0;
    }
    function isClaimed(questId) {
        return !!State.get().quests.claimed[questId];
    }

    /** Increment a quest's progress by `amount` (default 1), capped at its target.
     *  Safe to call even if the quest is already complete/claimed — it just no-ops. */
    function bump(questId, amount = 1) {
        ensureTodayReset();
        const def = QUEST_DEFS.find(q => q.id === questId);
        if (!def || isClaimed(questId)) return;
        const progress = { ...State.get().quests.progress };
        progress[questId] = U.clamp((progress[questId] || 0) + amount, 0, def.target);
        State.commit({ quests: { progress } });
        renderIfMounted();
    }

    /** Set a quest's progress to an absolute value (used by the daily-goal
     *  quest, whose "progress" is derived from focus totals rather than
     *  incremented event-by-event). */
    function setProgress(questId, value) {
        ensureTodayReset();
        const def = QUEST_DEFS.find(q => q.id === questId);
        if (!def || isClaimed(questId)) return;
        const progress = { ...State.get().quests.progress };
        progress[questId] = U.clamp(value, 0, def.target);
        State.commit({ quests: { progress } });
        renderIfMounted();
    }

    function claim(questId) {
        const def = QUEST_DEFS.find(q => q.id === questId);
        if (!def || isClaimed(questId)) return;
        if (getProgress(questId) < def.target) return;
        const claimed = { ...State.get().quests.claimed, [questId]: true };
        const total = State.get().points.total + def.points;
        State.commit({ quests: { claimed }, points: { total } });
        TFS.Toast.success(I18n.t('quests.claimedToast', { points: def.points }));
        renderIfMounted();
    }

    // ---------------------------------------------------------------- UI

    let mountedContainer = null;

    function renderIfMounted() { if (mountedContainer) renderCard(mountedContainer); }

    function renderCard(container) {
        mountedContainer = container;
        ensureTodayReset();
        container.innerHTML = '';

        const points = State.get().points.total;
        const level = levelFor(points);

        container.appendChild(U.el('h3', { className: 'quests-card__title', text: I18n.t('quests.cardTitle') }));

        // Shown once per profile until dismissed — a first-timer has no idea
        // yet what "quests" even means here, so spell it out plainly before
        // they've had to guess from the list alone.
        if (!State.get().ui.hasSeenQuestIntro) {
            container.appendChild(U.el('div', { className: 'quests-intro' }, [
                U.el('span', { className: 'material-symbols-outlined quests-intro__icon', attrs: { 'aria-hidden': 'true' }, text: 'auto_awesome' }),
                U.el('p', { className: 'quests-intro__text', text: I18n.t('quests.introText') }),
                U.el('button', {
                    className: 'btn btn--pill-white btn--sm', attrs: { type: 'button' }, text: I18n.t('quests.introDismiss'),
                    on: { click: () => { State.commit({ ui: { hasSeenQuestIntro: true } }); renderIfMounted(); } }
                })
            ]));
        }

        const header = U.el('div', { className: 'quests-card__header' }, [
            U.el('div', { className: 'quests-card__level' }, [
                U.el('span', { className: 'material-symbols-outlined quests-card__level-icon', attrs: { 'aria-hidden': 'true' }, text: level.current.icon }),
                U.el('div', {}, [
                    U.el('p', { className: 'quests-card__level-title', text: I18n.pick(level.current.title) }),
                    U.el('p', { className: 'quests-card__level-points', text: I18n.t('quests.pointsTotal', { n: points }) })
                ])
            ]),
            U.el('div', { className: 'quests-card__level-track' }, [
                U.el('div', { className: 'quests-card__level-fill', attrs: { style: `width:${level.progressPct}%` } })
            ])
        ]);
        container.appendChild(header);

        const list = U.el('div', { className: 'quests-card__list' });
        QUEST_DEFS.forEach(def => {
            const progress = getProgress(def.id);
            const claimedAlready = isClaimed(def.id);
            const done = progress >= def.target;
            const pct = Math.round((progress / def.target) * 100);

            const row = U.el('div', { className: 'quest-row' + (claimedAlready ? ' is-claimed' : '') }, [
                U.el('span', { className: 'quest-row__icon', attrs: { 'aria-hidden': 'true' } }, [
                    U.el('span', { className: 'material-symbols-outlined', text: claimedAlready ? 'check_circle' : def.icon })
                ]),
                U.el('div', { className: 'quest-row__body' }, [
                    U.el('p', { className: 'quest-row__label', text: I18n.pick(def.label) }),
                    U.el('p', { className: 'quest-row__hint', text: I18n.pick(def.hint) }),
                    U.el('div', { className: 'quest-row__track' }, [
                        U.el('div', { className: 'quest-row__fill', attrs: { style: `width:${pct}%` } })
                    ])
                ]),
                done && !claimedAlready
                    ? U.el('button', {
                        className: 'btn btn--pill-white btn--sm quest-row__claim', attrs: { type: 'button' },
                        text: I18n.t('quests.claim', { points: def.points }),
                        on: { click: () => claim(def.id) }
                    })
                    : U.el('span', { className: 'quest-row__count', text: `${progress}/${def.target}` })
            ]);
            list.appendChild(row);
        });
        container.appendChild(list);
    }

    // ---------------------------------------------------------------- Wiring

    I18n.onChange(() => renderIfMounted());
    State.subscribe(() => { /* consumers re-render explicitly via bump()/claim() to avoid render storms during ticking timers */ });

    TFS.Quests = { QUEST_DEFS, LEVELS, levelFor, ensureTodayReset, getProgress, isClaimed, bump, setProgress, claim, renderCard };

})(window);
