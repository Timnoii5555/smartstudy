/**
 * history.js
 * A read-only "what have I actually finished, and when" view across every
 * subject the learner has ever touched — not just the one currently active
 * in state.plan.subject. Reads state.syllabusProgress, which dashboard.js
 * populates with a completion timestamp per topic (see toggleTopic there),
 * and just presents it; it never writes anything itself.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};
    const U = TFS.Utils;
    const I18n = TFS.I18n;
    const State = TFS.State;

    const historyModal = document.getElementById('historyModal');
    const historyListContainer = document.getElementById('historyListContainer');

    /** Accepts both the current `{ completedAt }` shape and the older plain
     *  `true` a topic could have been marked done with before this file
     *  existed, so nobody's earlier progress looks broken. */
    function completedAtOf(entry) {
        return (entry && typeof entry === 'object') ? entry.completedAt : null;
    }

    function render() {
        historyListContainer.innerHTML = '';
        const allProgress = State.get().syllabusProgress;
        const subjects = TFS.Data.getSubjects()
            .map(subject => {
                const progress = allProgress[subject.id] || {};
                const completedTopics = subject.topics
                    .filter(t => progress[t.id])
                    .map(t => ({ topic: t, completedAt: completedAtOf(progress[t.id]) }))
                    .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));
                return { subject, completedTopics };
            })
            .filter(group => group.completedTopics.length > 0);

        if (subjects.length === 0) {
            historyListContainer.appendChild(U.el('p', { className: 'text-outline text-center', attrs: { style: 'padding:2rem 0' }, text: I18n.t('modalHistory.empty') }));
            return;
        }

        subjects.forEach(({ subject, completedTopics }) => {
            const group = U.el('div', {}, [
                U.el('div', { className: 'flex items-center justify-between', attrs: { style: 'margin-bottom:0.5rem' } }, [
                    U.el('h3', { attrs: { style: 'font-size:0.9375rem;font-weight:700' }, text: I18n.pick(subject.name) }),
                    U.el('span', { className: 'text-outline', attrs: { style: 'font-size:0.75rem' } , text: I18n.t('modalHistory.countLabel', { n: completedTopics.length, total: subject.topics.length }) })
                ])
            ]);
            const list = U.el('div', { className: 'flex flex-col gap-2' });
            completedTopics.forEach(({ topic, completedAt }) => {
                list.appendChild(U.el('div', { className: 'task-item task-item--bordered is-done', attrs: { style: 'cursor:default' } }, [
                    U.el('span', { className: 'checkbox-box' }, [
                        U.el('span', { className: 'material-symbols-outlined', attrs: { 'aria-hidden': 'true' }, text: 'check' })
                    ]),
                    U.el('div', { className: 'flex-1' }, [
                        U.el('h4', { className: 'task-text', text: I18n.pick(topic.label) }),
                        completedAt ? U.el('p', { className: 'task-meta', text: I18n.formatDate(new Date(completedAt), { day: 'numeric', month: 'short', year: 'numeric' }) }) : null
                    ].filter(Boolean))
                ]));
            });
            group.appendChild(list);
            historyListContainer.appendChild(group);
        });
    }

    document.getElementById('settingsHistoryBtn').addEventListener('click', () => {
        TFS.Modal.close(document.getElementById('settingsModal'));
        render();
        setTimeout(() => TFS.Modal.open(historyModal), 200);
    });
    document.getElementById('closeHistoryBtn').addEventListener('click', () => TFS.Modal.close(historyModal));

    I18n.onChange(() => { if (TFS.Modal.isOpen(historyModal)) render(); });

})(window);
