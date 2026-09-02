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
        if (topicMap[topicId]) delete topicMap[topicId];
        else topicMap[topicId] = true;
        allProgress[subjectId] = topicMap;
        // No explicit render() call here: this screen is subscribed to state
        // changes below and re-renders itself whenever it is the active screen.
        State.commit({ syllabusProgress: allProgress });
    }

    function renderChecklist(subject) {
        checklistContainer.innerHTML = '';
        if (!subject) {
            checklistContainer.appendChild(U.el('p', { className: 'text-outline text-center', text: I18n.t('s3.emptyChecklist') }));
            return;
        }
        const progress = getTopicProgressMap(subject.id);
        subject.topics.forEach(topic => {
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
        totalLessonsBadge.textContent = String(total);
        miniProgressBar.style.width = percent + '%';
        progressCircle.setAttribute('stroke-dasharray', RING_CIRCUMFERENCE.toFixed(2));
        progressCircle.setAttribute('stroke-dashoffset', (RING_CIRCUMFERENCE - (percent / 100) * RING_CIRCUMFERENCE).toFixed(2));

        renderChecklist(subject);

        if (percent === 100 && total > 0) {
            if (!hasShownCongratsThisSession) {
                TFS.Modal.open('congratsModal');
                hasShownCongratsThisSession = true;
            }
        } else {
            hasShownCongratsThisSession = false;
        }
    }

    document.getElementById('closeCongratsBtn').addEventListener('click', () => TFS.Modal.close('congratsModal'));

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
