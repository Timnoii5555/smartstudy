/**
 * dashboard.js
 * Screen 3: the syllabus progress ring + today's checklist. Checklist state
 * is stored per-subject in `state.syllabusProgress[subjectId][topicId] = true`
 * so switching subjects (via back-to-setup) never mixes up progress, and
 * everything survives a refresh.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};
    const U = TFS.Utils;
    const I18n = TFS.I18n;
    const State = TFS.State;

    const progressCircle = document.getElementById('progressCircle');
    const progressPercentText = document.getElementById('progressPercentText');
    const completedLessonsText = document.getElementById('completedLessonsText');
    const dashboardGoalHours = document.getElementById('dashboardGoalHours');
    const miniProgressBar = document.getElementById('miniProgressBar');
    const totalLessonsBadge = document.getElementById('totalLessonsBadge');
    const dashboardMainSubject = document.getElementById('dashboardMainSubject');
    const checklistContainer = document.getElementById('syllabusChecklistContainer');
    const readAheadPrompt = document.getElementById('readAheadPrompt');
    const streakBadge = document.getElementById('streakBadge');
    const readinessScoreCard = document.getElementById('readinessScoreCard');
    const notTodayBtn = document.getElementById('notTodayBtn');

    const RING_CIRCUMFERENCE = 2 * Math.PI * 88; // matches the SVG circle's r="88"

    let hasShownCongratsThisSession = false;

    function getCurrentSubject() {
        const subjectId = State.get().plan.subject;
        return subjectId ? TFS.Data.getSubject(subjectId) : null;
    }

    function getTopicProgressMap(subjectId) {
        return State.get().syllabusProgress[subjectId] || {};
    }

    function toggleTopic(subjectId, topicId) {
        const allProgress = { ...State.get().syllabusProgress };
        const topicMap = { ...(allProgress[subjectId] || {}) };
        const wasDone = !!topicMap[topicId];
        if (wasDone) delete topicMap[topicId];
        // Stores a completion timestamp (not just `true`) so js/history.js can
        // show a "what did I finish and when" view across every subject.
        else topicMap[topicId] = { completedAt: new Date().toISOString() };
        allProgress[subjectId] = topicMap;
        // No explicit render() call here: this screen is subscribed to state
        // changes below and re-renders itself whenever it is the active screen.
        State.commit({ syllabusProgress: allProgress });
    }

    /** The end of the "currently visible" window into the reading plan:
     *  today, or later if the learner already opted to read ahead (see
     *  renderReadAheadPrompt below). ISO date strings compare correctly with
     *  plain string comparison, so `Math.max`-by-string via `>` is enough. */
    function currentCutoffISO() {
        const today = U.formatDateISO(new Date());
        const readAhead = State.get().plan.readAheadUntilDate;
        return (readAhead && readAhead > today) ? readAhead : today;
    }

    /** Today's actionable slice of the syllabus: whatever the reading plan
     *  (built in onboarding.js from js/planner.js) has scheduled on or before
     *  the current cutoff date, still including already-completed ones so
     *  ticking a box doesn't make it vanish mid-session. Falls back to the
     *  full topic list when there is no plan yet (e.g. older saved data from
     *  before planner.js existed, or the daily-goal/exam-date fields were
     *  edited via Settings without regenerating a plan) so the checklist is
     *  never just empty.
     */
    function getTodaysTopics(subject) {
        const plan = State.get().plan.readingPlan;
        if (!plan || plan.subjectId !== subject.id || !plan.days.length) return subject.topics;
        const dueIds = TFS.Planner.topicsDueBy(plan, currentCutoffISO());
        const dueTopics = subject.topics.filter(t => dueIds.includes(t.id));
        return dueTopics.length ? dueTopics : subject.topics;
    }

    /** The next day in the plan (in the reading-order the learner picked on
     *  screen 2) that still has content beyond what's currently visible, or
     *  null if the plan has nothing left past the cutoff. */
    function findNextChunkDate(plan, cutoffISO) {
        if (!plan) return null;
        const next = plan.days.find(d => d.dateISO > cutoffISO && d.topicIds.length > 0);
        return next ? next.dateISO : null;
    }

    function renderReadAheadPrompt(subject, todaysTopics, progress) {
        readAheadPrompt.innerHTML = '';
        readAheadPrompt.hidden = true;
        if (todaysTopics.length === 0) return;

        const allDone = todaysTopics.every(t => !!progress[t.id]);
        if (!allDone) return;

        const plan = State.get().plan.readingPlan;
        if (!plan || plan.subjectId !== subject.id) return;
        const nextDate = findNextChunkDate(plan, currentCutoffISO());
        if (!nextDate) return; // nothing left beyond today — the "subject complete" flow handles that case

        readAheadPrompt.hidden = false;
        readAheadPrompt.appendChild(U.el('div', { className: 'read-ahead-card' }, [
            U.el('span', { className: 'material-symbols-outlined', attrs: { 'aria-hidden': 'true' }, text: 'auto_awesome' }),
            U.el('p', { text: I18n.t('s3.readAheadText') }),
            U.el('button', {
                className: 'btn btn--pill-white btn--sm', attrs: { type: 'button' },
                text: I18n.t('s3.readAheadBtn'),
                on: {
                    click: () => {
                        State.commit({ plan: { readAheadUntilDate: nextDate } });
                        render();
                    }
                }
            })
        ]));
    }

    function renderChecklist(subject) {
        checklistContainer.innerHTML = '';
        if (!subject) {
            // Reached by a guest who used the landing page's "just start
            // focusing" shortcut and then tapped Home before ever picking a
            // subject — still a real, useful state, not a dead end: explain
            // what to do next and offer both the structured path and staying
            // in Focus mode a moment longer (Phase 2's empty-state rule).
            checklistContainer.appendChild(U.el('div', { className: 'text-center', attrs: { style: 'padding:1rem 0' } }, [
                U.el('p', { className: 'text-outline', attrs: { style: 'margin-bottom:1rem' }, text: I18n.t('s3.emptyChecklist') }),
                U.el('button', {
                    className: 'btn btn--primary btn--sm', attrs: { type: 'button', style: 'margin:0 auto' },
                    text: I18n.t('s3.emptyChecklistCta'),
                    on: { click: () => TFS.Router.show('screen1') }
                })
            ]));
            readAheadPrompt.hidden = true;
            notTodayBtn.hidden = true;
            return;
        }
        notTodayBtn.hidden = false;
        const progress = getTopicProgressMap(subject.id);
        const todaysTopics = getTodaysTopics(subject);
        totalLessonsBadge.textContent = String(todaysTopics.length);
        todaysTopics.forEach(topic => {
            const done = !!progress[topic.id];
            const item = U.el('button', {
                className: 'task-item' + (done ? ' is-done' : ''),
                attrs: { type: 'button', 'aria-pressed': done ? 'true' : 'false' },
                on: { click: () => toggleTopic(subject.id, topic.id) }
            }, [
                U.el('span', { className: 'checkbox-box' }, done ? [
                    U.el('span', { className: 'material-symbols-outlined', attrs: { 'aria-hidden': 'true', style: "font-variation-settings:'wght' 700" }, text: 'check' })
                ] : []),
                U.el('div', { className: 'flex-1' }, [
                    U.el('h4', { className: 'task-text', text: I18n.pick(topic.label) })
                ])
            ]);
            checklistContainer.appendChild(item);
        });
        renderReadAheadPrompt(subject, todaysTopics, progress);
    }

    /** The streak badge is deliberately small, quiet, and never the most
     *  prominent thing on the screen (see js/streak.js's file header for the
     *  forgiving design it's built on) — just a number, plus how many
     *  "freeze" days are left this month once fewer than 2 remain. */
    function renderStreakBadge() {
        const streak = State.get().streak;
        if (!streak.current) { streakBadge.hidden = true; return; }
        streakBadge.hidden = false;
        streakBadge.innerHTML = '';
        streakBadge.appendChild(U.el('span', { className: 'material-symbols-outlined', attrs: { 'aria-hidden': 'true', style: "font-size:1rem;font-variation-settings:'FILL' 1" }, text: 'local_fire_department' }));
        streakBadge.appendChild(document.createTextNode(I18n.t('s3.streakBadge', { n: streak.current })));
        const freezesLeft = TFS.Streak ? TFS.Streak.freezesRemaining() : 2;
        if (freezesLeft < 2) {
            streakBadge.title = I18n.t('s3.streakFreezesLeft', { n: freezesLeft });
        }
    }

    /** How many of the last 7 calendar days (today included) hit the daily
     *  focus goal — the "consistency" leg of the readiness score below. */
    function goalHitRateLast7Days() {
        const goal = State.get().plan.dailyGoalSeconds;
        if (!goal) return 0;
        const totals = State.get().focus.totalSecondsByDate;
        let hits = 0;
        for (let i = 0; i < 7; i++) {
            const dateISO = U.formatDateISO(U.addDays(new Date(), -i));
            if ((totals[dateISO] || 0) >= goal) hits++;
        }
        return hits / 7;
    }

    /** A single "how ready am I really" number most planners don't attempt —
     *  most just show raw % of content read. This blends three real signals
     *  already tracked elsewhere in the app: how much of the syllabus is
     *  actually done (the dominant factor), how consistently the daily goal
     *  has been hit this past week, and how long the current study streak
     *  is — so someone who crammed 100% of the content in one all-nighter
     *  scores lower than someone who's been steadily consistent. */
    function renderReadinessScore(topicPercent) {
        const goalRate = goalHitRateLast7Days() * 100;
        const streakFactor = Math.min(State.get().streak.current / 7, 1) * 100;
        const composite = Math.round(0.5 * topicPercent + 0.3 * goalRate + 0.2 * streakFactor);

        readinessScoreCard.innerHTML = '';
        readinessScoreCard.appendChild(U.el('div', { className: 'readiness-score__head' }, [
            U.el('div', {}, [
                U.el('h3', { className: 'readiness-score__title', text: I18n.t('s3.readinessScoreTitle') }),
                U.el('p', { className: 'readiness-score__hint', text: I18n.t('s3.readinessScoreHint') })
            ]),
            U.el('div', { className: 'readiness-score__big', text: composite + '%' })
        ]));

        const rows = [
            { label: I18n.t('s3.readinessFactorContent'), value: Math.round(topicPercent) },
            { label: I18n.t('s3.readinessFactorConsistency'), value: Math.round(goalRate) },
            { label: I18n.t('s3.readinessFactorStreak'), value: Math.round(streakFactor) }
        ];
        const list = U.el('div', { className: 'readiness-score__rows' });
        rows.forEach(r => {
            list.appendChild(U.el('div', { className: 'readiness-score__row' }, [
                U.el('span', { className: 'readiness-score__row-label', text: r.label }),
                U.el('div', { className: 'readiness-score__row-track' }, [
                    U.el('div', { className: 'readiness-score__row-fill', attrs: { style: `width:${r.value}%` } })
                ]),
                U.el('span', { className: 'readiness-score__row-value', text: r.value + '%' })
            ]));
        });
        readinessScoreCard.appendChild(list);
    }

    /** "Not up for it today" (Phase 2): defers whatever is left of *today's*
     *  scheduled reading — never the whole due-by-cutoff window, which may
     *  already include topics the learner deliberately pulled forward via
     *  "read ahead" — into the following days, using the same day-capacity
     *  logic the plan was built with. No confirmation dialog, no streak
     *  penalty, just a brief neutral toast; see js/planner.js's
     *  redistributeIncomplete for how the re-packing itself works. */
    function deferToday(subject) {
        const plan = State.get().plan.readingPlan;
        const today = U.formatDateISO(new Date());
        if (!plan || plan.subjectId !== subject.id) {
            // No structured day-by-day plan to redistribute (e.g. legacy data) —
            // there's nothing to move, so just acknowledge and stop there.
            TFS.Toast.info(I18n.t('s3.notTodayToast'));
            return;
        }
        const progress = getTopicProgressMap(subject.id);
        const todaysScheduled = TFS.Planner.topicsForDate(plan, today);
        const incomplete = todaysScheduled.filter(id => !progress[id]);
        if (incomplete.length > 0) {
            const newPlan = TFS.Planner.redistributeIncomplete(plan, today, incomplete, State.get().plan.dailyGoalSeconds, subject.topics);
            State.commit({ plan: { readingPlan: newPlan, readAheadUntilDate: null } });
        }
        TFS.Toast.info(I18n.t('s3.notTodayToast'));
    }

    notTodayBtn.addEventListener('click', () => {
        const subject = getCurrentSubject();
        if (subject) deferToday(subject);
    });

    function markSubjectCompleted(subjectId) {
        const done = State.get().plan.completedSubjects || [];
        if (!done.includes(subjectId)) {
            State.commit({ plan: { completedSubjects: [...done, subjectId] } });
        }
    }

    function render() {
        const subject = getCurrentSubject();
        const plan = State.get().plan;

        dashboardMainSubject.textContent = subject ? I18n.t('s3.subjectPrefix', { subject: subject.code }) : I18n.t('s3.subjectLoading');
        dashboardGoalHours.textContent = U.formatSecondsToHHMM(plan.dailyGoalSeconds);

        const total = subject ? subject.topics.length : 0;
        const progress = subject ? getTopicProgressMap(subject.id) : {};
        const completed = Object.keys(progress).length;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

        U.animateCountUp(progressPercentText, percent, { formatFn: (n) => n + '%' });
        completedLessonsText.textContent = String(completed);
        miniProgressBar.style.width = percent + '%';
        progressCircle.setAttribute('stroke-dasharray', RING_CIRCUMFERENCE.toFixed(2));
        progressCircle.setAttribute('stroke-dashoffset', (RING_CIRCUMFERENCE - (percent / 100) * RING_CIRCUMFERENCE).toFixed(2));

        renderChecklist(subject);
        if (TFS.Streak) TFS.Streak.reconcile();
        renderStreakBadge();
        if (TFS.Garden) TFS.Garden.render();
        renderReadinessScore(percent);

        if (percent === 100 && total > 0) {
            if (subject) markSubjectCompleted(subject.id);
            if (!hasShownCongratsThisSession) {
                TFS.Modal.open('congratsModal');
                hasShownCongratsThisSession = true;
            }
        } else {
            hasShownCongratsThisSession = false;
        }
    }

    document.getElementById('closeCongratsBtn').addEventListener('click', () => TFS.Modal.close('congratsModal'));
    document.getElementById('chooseNextSubjectBtn').addEventListener('click', () => {
        TFS.Modal.close('congratsModal');
        TFS.Router.show('screen1');
    });

    function isActive() { return TFS.Router.current() === 'screen3'; }
    // Both guarded by isActive(): render() can pop the congrats modal open, which
    // must never happen just because the user changed language/theme on another screen.
    I18n.onChange(() => { if (isActive()) render(); });
    State.subscribe(() => { if (isActive()) render(); });

    TFS.Router.register('screen3', {
        onEnter: () => { TFS.Nav.show(); TFS.Nav.setActive('home'); render(); }
    });

    TFS.Dashboard = { render };

})(window);
