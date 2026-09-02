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
    const pointsBadge = document.getElementById('pointsBadge');
    const questsCard = document.getElementById('questsCard');

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
        if (!wasDone && TFS.Quests) TFS.Quests.bump('complete-topic', 1);
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
            checklistContainer.appendChild(U.el('p', { className: 'text-outline text-center', text: I18n.t('s3.emptyChecklist') }));
            readAheadPrompt.hidden = true;
            return;
        }
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

    function renderPointsBadge() {
        if (!TFS.Quests) return;
        const points = State.get().points.total;
        const level = TFS.Quests.levelFor(points);
        pointsBadge.innerHTML = '';
        pointsBadge.appendChild(U.el('span', { className: 'material-symbols-outlined', attrs: { 'aria-hidden': 'true', style: 'font-size:1rem' }, text: 'star' }));
        pointsBadge.appendChild(document.createTextNode(I18n.t('quests.pointsBadge', { n: points, level: I18n.pick(level.current.title) })));
    }

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

        progressPercentText.textContent = percent + '%';
        completedLessonsText.textContent = String(completed);
        miniProgressBar.style.width = percent + '%';
        progressCircle.setAttribute('stroke-dasharray', RING_CIRCUMFERENCE.toFixed(2));
        progressCircle.setAttribute('stroke-dashoffset', (RING_CIRCUMFERENCE - (percent / 100) * RING_CIRCUMFERENCE).toFixed(2));

        renderChecklist(subject);
        renderPointsBadge();
        if (TFS.Quests) TFS.Quests.renderCard(questsCard);

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
