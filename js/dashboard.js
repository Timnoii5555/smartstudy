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
        else topicMap[topicId] = true;
        allProgress[subjectId] = topicMap;
        // No explicit render() call here: this screen is subscribed to state
        // changes below and re-renders itself whenever it is the active screen.
        State.commit({ syllabusProgress: allProgress });
        if (!wasDone && TFS.Quests) TFS.Quests.bump('complete-topic', 1);
    }

    /** Today's actionable slice of the syllabus: whatever the reading plan
     *  (built in onboarding.js from js/planner.js) has scheduled on or before
     *  today, still including already-completed ones so ticking a box doesn't
     *  make it vanish mid-session. Falls back to the full topic list when
     *  there is no plan yet (e.g. older saved data from before planner.js
     *  existed, or the daily-goal/exam-date fields were edited via Settings
     *  without regenerating a plan) so the checklist is never just empty.
     */
    function getTodaysTopics(subject) {
        const plan = State.get().plan.readingPlan;
        if (!plan || plan.subjectId !== subject.id || !plan.days.length) return subject.topics;
        const todayISO = U.formatDateISO(new Date());
        const dueIds = TFS.Planner.topicsDueBy(plan, todayISO);
        const dueTopics = subject.topics.filter(t => dueIds.includes(t.id));
        return dueTopics.length ? dueTopics : subject.topics;
    }

    function renderChecklist(subject) {
        checklistContainer.innerHTML = '';
        if (!subject) {
            checklistContainer.appendChild(U.el('p', { className: 'text-outline text-center', text: I18n.t('s3.emptyChecklist') }));
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
