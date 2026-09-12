/**
 * groupsUI.js
 * Wires up the "Study groups" modal (index.html) to js/groups.js. Kept
 * separate from that file the same way js/focus.js is kept separate from
 * js/presence.js — one file owns the Firestore calls, this one owns the
 * screen.
 *
 * The group heartbeat (js/groups.js's startHeartbeat/stopHeartbeat) is
 * driven reactively off shared state rather than focus.js calling it
 * directly: whenever a focus phase is actually running *and* this device
 * currently belongs to a group, it's on; otherwise it's off. That keeps
 * focus.js — already the largest file in this app — untouched by a
 * feature it doesn't otherwise need to know exists.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};
    const U = TFS.Utils;
    const I18n = TFS.I18n;
    const State = TFS.State;
    const Groups = TFS.Groups;

    const studyGroupsModal = document.getElementById('studyGroupsModal');
    const openStudyGroupsBtn = document.getElementById('openStudyGroupsBtn');
    const closeStudyGroupsBtn = document.getElementById('closeStudyGroupsBtn');

    const groupsViewList = document.getElementById('groupsViewList');
    const groupsViewCreate = document.getElementById('groupsViewCreate');
    const groupsViewDetail = document.getElementById('groupsViewDetail');

    const groupJoinCodeInput = document.getElementById('groupJoinCodeInput');
    const groupJoinCodeBtn = document.getElementById('groupJoinCodeBtn');
    const groupCreateBtn = document.getElementById('groupCreateBtn');
    const groupsPublicList = document.getElementById('groupsPublicList');
    const groupsPublicEmpty = document.getElementById('groupsPublicEmpty');

    const groupsBackFromCreateBtn = document.getElementById('groupsBackFromCreateBtn');
    const groupNameInput = document.getElementById('groupNameInput');
    const groupGoalInput = document.getElementById('groupGoalInput');
    const groupIsPublicToggle = document.getElementById('groupIsPublicToggle');
    const groupCreateSubmitBtn = document.getElementById('groupCreateSubmitBtn');
    let creatingPublic = false;

    const groupDetailName = document.getElementById('groupDetailName');
    const groupDetailStudyingNow = document.getElementById('groupDetailStudyingNow');
    const groupDetailGoal = document.getElementById('groupDetailGoal');
    const groupDetailCode = document.getElementById('groupDetailCode');
    const groupLeaveBtn = document.getElementById('groupLeaveBtn');

    let studyingCountIntervalId = null;

    function showView(view) {
        if (groupsViewList) groupsViewList.hidden = view !== 'list';
        if (groupsViewCreate) groupsViewCreate.hidden = view !== 'create';
        if (groupsViewDetail) groupsViewDetail.hidden = view !== 'detail';
    }

    async function refreshStudyingNow(groupId) {
        if (!groupDetailStudyingNow) return;
        const n = await Groups.fetchStudyingCount(groupId);
        groupDetailStudyingNow.textContent = n === null
            ? I18n.t('modalGroups.studyingUnknown')
            : I18n.t('modalGroups.studyingNow', { n });
    }

    function startStudyingNowPolling(groupId) {
        stopStudyingNowPolling();
        refreshStudyingNow(groupId);
        // Explicit close/leave already call stopStudyingNowPolling()
        // directly for an immediate stop, but the modal can also close via
        // its own backdrop click, Escape, or a screen change (see
        // js/app.js's Router.onChange) — none of which this file hears
        // about. Checking isOpen() here too is the safety net: within one
        // tick of any of those, polling stops on its own instead of
        // continuing to hit Firestore in the background indefinitely.
        studyingCountIntervalId = setInterval(() => {
            if (!TFS.Modal.isOpen(studyGroupsModal)) { stopStudyingNowPolling(); return; }
            refreshStudyingNow(groupId);
        }, 30000);
    }
    function stopStudyingNowPolling() {
        if (studyingCountIntervalId !== null) { clearInterval(studyingCountIntervalId); studyingCountIntervalId = null; }
    }

    function renderDetailView() {
        const s = State.get().groups;
        if (!s.currentGroupId) { showView('list'); renderListView(); return; }
        showView('detail');
        if (groupDetailName) groupDetailName.textContent = s.currentGroupName || '';
        startStudyingNowPolling(s.currentGroupId);
        // The goal/code fields need the full doc, not just the cached id+name.
        Groups.fetchGroup(s.currentGroupId).then((group) => {
            if (!group) return;
            if (groupDetailGoal) groupDetailGoal.textContent = I18n.t('modalGroups.minutesValue', { n: group.dailyGoalMinutes });
            if (groupDetailCode) groupDetailCode.textContent = group.joinCode || '—';
        });
    }

    function renderListView() {
        if (!groupsPublicList) return;
        groupsPublicList.innerHTML = '';
        Groups.fetchPublicGroups().then((groups) => {
            if (!groups || !groups.length) {
                if (groupsPublicEmpty) groupsPublicEmpty.hidden = false;
                return;
            }
            if (groupsPublicEmpty) groupsPublicEmpty.hidden = true;
            groups.forEach((g) => {
                groupsPublicList.appendChild(U.el('button', {
                    className: 'search-result-item w-full', attrs: { type: 'button' },
                    on: { click: () => { Groups.joinGroup(g); renderDetailView(); } }
                }, [
                    U.el('span', { className: 'flex items-center gap-3' }, [
                        U.el('span', { className: 'material-symbols-outlined text-primary', attrs: { 'aria-hidden': 'true' }, text: 'groups' }),
                        U.el('span', {}, [
                            U.el('h3', { attrs: { style: 'font-weight:700;font-size:0.875rem' }, text: g.name }),
                            U.el('p', { className: 'text-outline', attrs: { style: 'font-size:0.6875rem' }, text: I18n.t('modalGroups.minutesValue', { n: g.dailyGoalMinutes }) })
                        ])
                    ]),
                    U.el('span', { className: 'material-symbols-outlined text-primary', attrs: { 'aria-hidden': 'true' }, text: 'chevron_right' })
                ]));
            });
        });
    }

    function openModal() {
        const s = State.get().groups;
        if (s.currentGroupId) renderDetailView(); else { showView('list'); renderListView(); }
        TFS.Modal.open(studyGroupsModal);
    }

    if (openStudyGroupsBtn) openStudyGroupsBtn.addEventListener('click', openModal);
    if (closeStudyGroupsBtn) closeStudyGroupsBtn.addEventListener('click', () => { stopStudyingNowPolling(); TFS.Modal.close(studyGroupsModal); });

    if (groupCreateBtn) {
        groupCreateBtn.addEventListener('click', () => {
            if (!Groups.isAvailable()) { TFS.Toast.warn(I18n.t('modalGroups.unavailable')); return; }
            groupNameInput.value = '';
            groupGoalInput.value = '60';
            creatingPublic = false;
            if (groupIsPublicToggle) groupIsPublicToggle.querySelector('.switch').classList.remove('is-on');
            showView('create');
        });
    }
    if (groupsBackFromCreateBtn) groupsBackFromCreateBtn.addEventListener('click', () => showView('list'));
    if (groupIsPublicToggle) {
        groupIsPublicToggle.addEventListener('click', () => {
            creatingPublic = !creatingPublic;
            groupIsPublicToggle.querySelector('.switch').classList.toggle('is-on', creatingPublic);
        });
    }
    if (groupCreateSubmitBtn) {
        groupCreateSubmitBtn.addEventListener('click', async () => {
            const name = groupNameInput.value.trim();
            if (!name) { TFS.Toast.warn(I18n.t('modalGroups.errName')); return; }
            groupCreateSubmitBtn.disabled = true;
            const group = await Groups.createGroup({ name, dailyGoalMinutes: parseInt(groupGoalInput.value, 10), isPublic: creatingPublic });
            groupCreateSubmitBtn.disabled = false;
            if (!group) { TFS.Toast.error(I18n.t('modalGroups.errGeneric')); return; }
            renderDetailView();
        });
    }

    if (groupJoinCodeBtn) {
        groupJoinCodeBtn.addEventListener('click', async () => {
            const code = groupJoinCodeInput.value.trim();
            if (!code) return;
            if (!Groups.isAvailable()) { TFS.Toast.warn(I18n.t('modalGroups.unavailable')); return; }
            groupJoinCodeBtn.disabled = true;
            const group = await Groups.joinByCode(code);
            groupJoinCodeBtn.disabled = false;
            if (!group) { TFS.Toast.warn(I18n.t('modalGroups.errCodeNotFound')); return; }
            groupJoinCodeInput.value = '';
            renderDetailView();
        });
    }

    if (groupLeaveBtn) {
        groupLeaveBtn.addEventListener('click', async () => {
            const ok = await TFS.Modal.confirm({
                title: I18n.t('modalGroups.leaveConfirmTitle'),
                message: I18n.t('modalGroups.leaveConfirmMsg'),
                confirmText: I18n.t('modalGroups.leaveBtn'),
                cancelText: I18n.t('common.cancel'),
                danger: true
            });
            if (!ok) return;
            Groups.leaveGroup();
            stopStudyingNowPolling();
            showView('list');
            renderListView();
        });
    }

    // ---------------------------------------------------------------- Reactive heartbeat (see file header)

    let groupHeartbeatActive = false;
    function syncGroupHeartbeat() {
        if (!Groups) return;
        const s = State.get();
        const shouldRun = s.focus.mode === 'focus' && s.focus.runStartedAtMs !== null && !!s.groups.currentGroupId;
        if (shouldRun && !groupHeartbeatActive) { Groups.startHeartbeat(s.groups.currentGroupId); groupHeartbeatActive = true; }
        else if (!shouldRun && groupHeartbeatActive) { Groups.stopHeartbeat(); groupHeartbeatActive = false; }
    }
    State.subscribe(syncGroupHeartbeat);
    syncGroupHeartbeat(); // covers resuming an already-running session across a reload

})(window);
