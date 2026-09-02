/**
 * leaderboard.js
 * Cross-user ranking by total points — only possible at all because
 * js/auth.js mirrors each logged-in learner's points into a shared
 * Firestore `users` collection (see auth.js's syncPoints). Reading it back
 * here is the other half of that: query everyone ordered by points, render
 * it, highlight whichever row is "me".
 *
 * If Firebase isn't configured, or the learner is on a local (non-account)
 * profile, there is no shared data to rank against — this shows an
 * explanatory prompt instead of an empty/broken list.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};
    const U = TFS.Utils;
    const I18n = TFS.I18n;
    const Auth = TFS.Auth;

    const leaderboardModal = document.getElementById('leaderboardModal');
    const leaderboardBody = document.getElementById('leaderboardBody');
    const openLeaderboardBtn = document.getElementById('openLeaderboardBtn');

    function renderPrompt(messageKey) {
        leaderboardBody.innerHTML = '';
        leaderboardBody.appendChild(U.el('div', { className: 'text-center', attrs: { style: 'padding:2rem 1rem' } }, [
            U.el('span', { className: 'material-symbols-outlined', attrs: { 'aria-hidden': 'true', style: 'font-size:2.5rem;color:var(--color-outline-variant);margin-bottom:1rem' }, text: 'emoji_events' }),
            U.el('p', { className: 'text-outline', attrs: { style: 'font-size:0.875rem' }, text: I18n.t(messageKey) })
        ]));
    }

    function renderLoading() {
        leaderboardBody.innerHTML = '';
        leaderboardBody.appendChild(U.el('p', { className: 'text-outline text-center', attrs: { style: 'padding:2rem 0' }, text: I18n.t('common.loading') }));
    }

    async function render() {
        if (!Auth.isEnabled()) { renderPrompt('modalLeaderboard.notConfigured'); return; }
        const user = Auth.getCurrentUser();
        if (!user) { renderPrompt('modalLeaderboard.needLogin'); return; }

        renderLoading();
        let rows;
        try {
            rows = await Auth.fetchLeaderboard(50);
        } catch (e) {
            console.error('[leaderboard] fetch failed', e);
            renderPrompt('modalLeaderboard.loadError');
            return;
        }

        leaderboardBody.innerHTML = '';
        if (rows.length === 0) { renderPrompt('modalLeaderboard.empty'); return; }

        const list = U.el('div', { className: 'flex flex-col gap-2 custom-scroll', attrs: { style: 'max-height:26rem;overflow-y:auto' } });
        rows.forEach((row, index) => {
            const isMe = row.uid === user.uid;
            const rank = index + 1;
            list.appendChild(U.el('div', { className: 'leaderboard-row' + (isMe ? ' is-me' : '') }, [
                U.el('span', { className: 'leaderboard-row__rank', text: rankLabel(rank) }),
                row.avatarURL
                    ? U.el('img', { className: 'leaderboard-row__avatar', attrs: { src: row.avatarURL, alt: '' } })
                    : U.el('span', { className: 'leaderboard-row__avatar leaderboard-row__avatar--fallback material-symbols-outlined', attrs: { 'aria-hidden': 'true' }, text: 'person' }),
                U.el('span', { className: 'leaderboard-row__name', text: row.displayName || I18n.t('modalLeaderboard.anonymous') }),
                U.el('span', { className: 'leaderboard-row__points', text: I18n.t('quests.pointsTotal', { n: row.points || 0 }) })
            ]));
        });
        leaderboardBody.appendChild(list);
    }

    function rankLabel(rank) {
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return '#' + rank;
    }

    openLeaderboardBtn.addEventListener('click', () => {
        TFS.Modal.open(leaderboardModal);
        render();
    });
    document.getElementById('closeLeaderboardBtn').addEventListener('click', () => TFS.Modal.close(leaderboardModal));

    I18n.onChange(() => { if (TFS.Modal.isOpen(leaderboardModal)) render(); });

})(window);
