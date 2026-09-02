/**
 * schedule.js
 * Screen 4: weekly schedule. This is the rewrite for bug 1.3 — every session
 * is stored against a full ISO date, the grid renders an explicit "viewed
 * week" instead of always showing the real-world current week, and the mini
 * calendar and the week grid stay in sync in both directions (clicking a
 * mini-calendar day jumps the grid to that week; moving the grid's week
 * updates which month the mini calendar shows and highlights that week).
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};
    const U = TFS.Utils;
    const I18n = TFS.I18n;
    const State = TFS.State;
    const WP = TFS.WheelPicker;

    const COLOR_KEYS = ['blue', 'orange', 'green', 'purple', 'pink', 'red', 'teal'];
    const COLOR_META = {
        blue: { bg: '#e6f2ff', border: '#0058bc' }, orange: { bg: '#fff3e6', border: '#f97316' },
        green: { bg: '#ecfdf3', border: '#22c55e' }, purple: { bg: '#f5f0ff', border: '#a855f7' },
        pink: { bg: '#fef1f6', border: '#ec4899' }, red: { bg: '#fef2f2', border: '#ef4444' },
        teal: { bg: '#effcfa', border: '#14b8a6' }
    };

    let viewedWeekStart = U.startOfWeekMonday(new Date());
    let miniCalMonth = new Date(viewedWeekStart.getFullYear(), viewedWeekStart.getMonth(), 1);

    // ---- DOM refs -----------------------------------------------------------
    const miniMonthYear = document.getElementById('miniMonthYear');
    const miniCalendarWeekdays = document.getElementById('miniCalendarWeekdays');
    const miniCalendarDays = document.getElementById('miniCalendarDays');
    const examDateIndicator = document.getElementById('examDateIndicator');
    const examDateTextDisplay = document.getElementById('examDateTextDisplay');
    const weekRangeLabel = document.getElementById('weekRangeLabel');
    const scheduleDateHeaders = document.getElementById('scheduleDateHeaders');
    const scheduleHourLines = document.getElementById('scheduleHourLines');
    const scheduleHourLabels = document.getElementById('scheduleHourLabels');
    const scheduleGridContainer = document.getElementById('scheduleGridContainer');
    const scheduleTodoList = document.getElementById('scheduleTodoList');

    function isActive() { return TFS.Router.current() === 'screen4'; }

    function currentSubject() {
        const id = State.get().plan.subject;
        return id ? TFS.Data.getSubject(id) : null;
    }

    function topicLabelFor(session) {
        const subject = TFS.Data.getSubject(session.subjectId);
        const topic = subject && subject.topics.find(t => t.id === session.topicId);
        return topic ? I18n.pick(topic.label) : session.topicId;
    }

    // ---------------------------------------------------------------- Setting the viewed week

    function setViewedWeek(newStart) {
        viewedWeekStart = U.startOfWeekMonday(newStart);
        miniCalMonth = new Date(viewedWeekStart.getFullYear(), viewedWeekStart.getMonth(), 1);
        renderAll();
    }

    // ---------------------------------------------------------------- Mini calendar

    function renderMiniCalendarWeekdays() {
        miniCalendarWeekdays.innerHTML = '';
        I18n.weekdayShortLabels().forEach(label => miniCalendarWeekdays.appendChild(U.el('span', { text: label })));
    }

    function renderMiniCalendar() {
        miniMonthYear.textContent = I18n.formatMonthYear(miniCalMonth);
        miniCalendarDays.innerHTML = '';

        const year = miniCalMonth.getFullYear();
        const month = miniCalMonth.getMonth();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const today = U.startOfDay(new Date());
        const examISO = State.get().plan.examDateISO;
        const examZero = examISO ? U.parseISODate(examISO) : null;
        const weekEnd = U.addDays(viewedWeekStart, 6);

        for (let i = 0; i < firstDayOfMonth; i++) miniCalendarDays.appendChild(U.el('span', { className: 'calendar__cell calendar__cell--muted' }));

        for (let d = 1; d <= daysInMonth; d++) {
            const cellDate = new Date(year, month, d);
            const isToday = U.isSameDate(cellDate, today);
            const isExam = examZero && U.isSameDate(cellDate, examZero);
            const isCountdown = examZero && cellDate > today && cellDate < examZero;
            const isInWeek = cellDate >= viewedWeekStart && cellDate <= weekEnd;

            const classes = ['calendar__cell', 'calendar__cell--clickable'];
            if (isExam) classes.push('calendar__cell--exam');
            else if (isToday) classes.push('calendar__cell--today');
            else if (isCountdown) classes.push('calendar__cell--countdown');
            if (isInWeek) classes.push('calendar__cell--in-week');

            const cell = U.el('button', {
                className: classes.join(' '),
                attrs: { type: 'button', 'aria-label': I18n.formatDate(cellDate), 'aria-current': isToday ? 'date' : undefined },
                text: String(d),
                on: { click: () => setViewedWeek(cellDate) }
            }, isExam ? [U.el('span', { className: 'calendar__pulse' }, [U.el('span', { className: 'calendar__pulse-ping' }), U.el('span', { className: 'calendar__pulse-dot' })])] : []);
            miniCalendarDays.appendChild(cell);
        }

        const totalCells = firstDayOfMonth + daysInMonth;
        const trailing = (Math.ceil(totalCells / 7) * 7) - totalCells;
        for (let i = 0; i < trailing; i++) miniCalendarDays.appendChild(U.el('span', { className: 'calendar__cell calendar__cell--muted' }));

        if (examISO) {
            examDateIndicator.hidden = false;
            const diffDays = Math.ceil((examZero - today) / 86400000);
            let countdown = '';
            if (diffDays > 0) countdown = ` (+${diffDays})`;
            else if (diffDays === 0) countdown = ` (${I18n.t('common.today')})`;
            examDateTextDisplay.textContent = I18n.formatDate(examZero) + countdown;
        } else {
            examDateIndicator.hidden = true;
        }
    }

    document.getElementById('prevMonthBtn').addEventListener('click', () => { miniCalMonth.setMonth(miniCalMonth.getMonth() - 1); renderMiniCalendar(); });
    document.getElementById('nextMonthBtn').addEventListener('click', () => { miniCalMonth.setMonth(miniCalMonth.getMonth() + 1); renderMiniCalendar(); });

    // ---------------------------------------------------------------- Week grid

    function renderWeekRangeLabel() {
        const isCurrentWeek = U.isSameDate(viewedWeekStart, U.startOfWeekMonday(new Date()));
        weekRangeLabel.textContent = isCurrentWeek
            ? I18n.t('s4.thisWeek')
            : I18n.t('s4.weekOf', {
                start: I18n.formatDate(viewedWeekStart, { day: 'numeric', month: 'short' }),
                end: I18n.formatDate(U.addDays(viewedWeekStart, 6), { day: 'numeric', month: 'short', year: 'numeric' })
            });
    }

    function renderWeekHeaders() {
        scheduleDateHeaders.innerHTML = '';
        scheduleDateHeaders.appendChild(U.el('div', { className: 'schedule-day-headers__time', text: I18n.t('s4.timeColumn') }));
        const today = new Date();
        const weekdayLabels = I18n.weekdayShortLabels();
        for (let i = 0; i < 7; i++) {
            const d = U.addDays(viewedWeekStart, i);
            const isToday = U.isSameDate(d, today);
            scheduleDateHeaders.appendChild(U.el('div', { className: 'schedule-day-headers__day' + (isToday ? ' is-today' : '') }, [
                U.el('p', { text: weekdayLabels[i] }),
                U.el('p', { text: String(d.getDate()) })
            ]));
        }
    }

    function renderStaticHourGrid() {
        if (scheduleHourLines.childElementCount) return; // static, render once
        for (let i = 0; i < 24; i++) scheduleHourLines.appendChild(U.el('div'));
        for (let h = 0; h < 24; h++) scheduleHourLabels.appendChild(U.el('span', { text: `${U.pad2(h)}:00` }));
    }

    function renderSessionBlocks() {
        scheduleGridContainer.innerHTML = '';
        const weekEnd = U.addDays(viewedWeekStart, 6);
        const sessions = State.get().schedule.sessions.filter(s => {
            const d = U.parseISODate(s.dateISO);
            return d >= viewedWeekStart && d <= weekEnd;
        });

        sessions.forEach(session => {
            const dayIndex = Math.round((U.parseISODate(session.dateISO) - viewedWeekStart) / 86400000);
            const topPct = (session.startMin / 1440) * 100;
            const heightPct = ((session.endMin - session.startMin) / 1440) * 100;
            const leftPct = dayIndex * (100 / 7);
            const widthPct = (100 / 7) - 1;

            const block = U.el('div', {
                className: `schedule-block schedule-block--${session.color}`,
                attrs: { style: `top:${topPct}%;left:${leftPct}%;width:${widthPct}%;height:${heightPct}%`, role: 'button', tabindex: '0', 'data-session-id': session.id },
                on: {
                    click: () => confirmDeleteSession(session.id),
                    keydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); confirmDeleteSession(session.id); } }
                }
            }, [
                U.el('p', { className: 'schedule-block__title', text: topicLabelFor(session) }),
                U.el('p', { className: 'schedule-block__time', text: `${U.minutesToTimeStr(session.startMin)} - ${U.minutesToTimeStr(session.endMin)}` })
            ]);
            scheduleGridContainer.appendChild(block);
        });
    }

    function renderTodoListForToday() {
        scheduleTodoList.innerHTML = '';
        const todayISO = U.formatDateISO(new Date());
        const sessions = State.get().schedule.sessions
            .filter(s => s.dateISO === todayISO)
            .sort((a, b) => a.startMin - b.startMin);

        if (sessions.length === 0) {
            scheduleTodoList.appendChild(U.el('p', { className: 'text-outline text-center', attrs: { id: 'emptyTodoMsg', style: 'font-size:0.875rem;padding:1rem 0' }, text: I18n.t('s4.todoEmpty') }));
            return;
        }

        sessions.forEach(session => {
            const item = U.el('button', {
                className: 'task-item task-item--bordered' + (session.completed ? ' is-done' : ''),
                attrs: { type: 'button', 'aria-pressed': session.completed ? 'true' : 'false' },
                on: { click: () => toggleSessionCompleted(session.id) }
            }, [
                U.el('span', { className: 'checkbox-box' }, session.completed ? [U.el('span', { className: 'material-symbols-outlined', attrs: { 'aria-hidden': 'true' }, text: 'check' })] : []),
                U.el('div', { className: 'flex-1' }, [
                    U.el('h4', { className: 'task-text', text: topicLabelFor(session) }),
                    U.el('p', { className: 'task-meta' }, [
                        U.el('span', { className: 'material-symbols-outlined', attrs: { style: 'font-size:14px' }, text: 'schedule' }),
                        document.createTextNode(`${U.minutesToTimeStr(session.startMin)} - ${U.minutesToTimeStr(session.endMin)}`)
                    ])
                ])
            ]);
            scheduleTodoList.appendChild(item);
        });
    }

    function toggleSessionCompleted(id) {
        const sessions = State.get().schedule.sessions.map(s => s.id === id ? { ...s, completed: !s.completed } : s);
        State.commit({ schedule: { sessions } });
    }

    function renderAll() {
        renderMiniCalendarWeekdays();
        renderMiniCalendar();
        renderWeekRangeLabel();
        renderWeekHeaders();
        renderStaticHourGrid();
        renderSessionBlocks();
        renderTodoListForToday();
    }

    // ---------------------------------------------------------------- Week nav buttons

    document.getElementById('weekPrevBtn').addEventListener('click', () => setViewedWeek(U.addDays(viewedWeekStart, -7)));
    document.getElementById('weekNextBtn').addEventListener('click', () => setViewedWeek(U.addDays(viewedWeekStart, 7)));
    document.getElementById('weekTodayBtn').addEventListener('click', () => setViewedWeek(new Date()));

    // ---------------------------------------------------------------- Add-session modal

    const addClassModal = document.getElementById('addClassModal');
    const modalTopic = document.getElementById('modalTopic');
    const colorSwatchGroup = document.getElementById('colorSwatchGroup');
    const modalDate = document.getElementById('modalDate');
    const modalStart = document.getElementById('modalStart');
    const modalEnd = document.getElementById('modalEnd');
    const displayStartTime = document.getElementById('displayStartTime');
    const displayEndTime = document.getElementById('displayEndTime');
    let selectedColor = 'blue';

    function renderColorSwatches() {
        colorSwatchGroup.innerHTML = '';
        COLOR_KEYS.forEach((key, i) => {
            const meta = COLOR_META[key];
            const label = U.el('label', { className: 'color-swatch' }, [
                U.el('input', { attrs: { type: 'radio', name: 'blockColor', value: key, checked: key === selectedColor || undefined } }),
                U.el('span', { className: 'color-swatch__dot', attrs: { style: `background:${meta.bg};border-color:${meta.border};color:${meta.border}` } })
            ]);
            label.querySelector('input').addEventListener('change', () => { selectedColor = key; });
            colorSwatchGroup.appendChild(label);
        });
    }

    document.getElementById('openModalBtn').addEventListener('click', () => {
        const subject = currentSubject();
        if (!subject) { TFS.Toast.warn(I18n.t('s1.errSelectSubject')); return; }

        modalTopic.innerHTML = '';
        subject.topics.forEach(t => modalTopic.appendChild(U.el('option', { attrs: { value: t.id }, text: I18n.pick(t.label) })));

        selectedColor = 'blue';
        renderColorSwatches();

        const today = U.startOfDay(new Date());
        const weekEnd = U.addDays(viewedWeekStart, 6);
        const defaultDate = (today >= viewedWeekStart && today <= weekEnd) ? today : viewedWeekStart;
        modalDate.value = U.formatDateISO(defaultDate);

        modalStart.value = '09:00'; displayStartTime.textContent = '09:00';
        modalEnd.value = '11:00'; displayEndTime.textContent = '11:00';

        TFS.Modal.open(addClassModal);
    });

    document.getElementById('closeModalBtn').addEventListener('click', () => TFS.Modal.close(addClassModal));

    document.getElementById('saveClassBtn').addEventListener('click', () => {
        const subject = currentSubject();
        const topicId = modalTopic.value;
        const dateISO = modalDate.value;
        const startMin = U.timeStrToMinutes(modalStart.value);
        const endMin = U.timeStrToMinutes(modalEnd.value);

        if (!dateISO) { TFS.Toast.error(I18n.t('modalAddClass.errDateRequired')); return; }
        if (startMin >= endMin) { TFS.Toast.error(I18n.t('modalAddClass.errTimeOrder')); return; }
        if (startMin < 0 || endMin > 24 * 60) { TFS.Toast.error(I18n.t('modalAddClass.errTimeRange')); return; }

        const existing = State.get().schedule.sessions;
        const overlaps = existing.some(s => s.dateISO === dateISO && startMin < s.endMin && s.startMin < endMin);
        if (overlaps) { TFS.Toast.error(I18n.t('modalAddClass.errOverlap')); return; }

        const newSession = {
            id: U.uuid(), dateISO, startMin, endMin, topicId, subjectId: subject.id, color: selectedColor, completed: false
        };
        State.commit({ schedule: { sessions: [...existing, newSession] } });
        TFS.Modal.close(addClassModal);
        setViewedWeek(U.parseISODate(dateISO)); // jump so the new session is immediately visible
        TFS.Toast.success(I18n.t('modalAddClass.saved'));
    });

    // ---- Start/end time pickers (shared iOS wheel picker) --------------------

    const iosTimePickerModal = document.getElementById('iosTimePickerModal');
    const wheelHoursClass = document.getElementById('wheelHoursClass');
    const wheelMinutesClass = document.getElementById('wheelMinutesClass');
    let activeTimeTarget = '';
    let wheelsBuilt = false;

    function ensureTimeWheelsBuilt() {
        if (wheelsBuilt) return;
        WP.createItems(wheelHoursClass, 23, true);
        WP.createItems(wheelMinutesClass, 59, true);
        WP.attachScrollSync(wheelHoursClass);
        WP.attachScrollSync(wheelMinutesClass);
        WP.attachWheelStep(wheelHoursClass, 23);
        WP.attachWheelStep(wheelMinutesClass, 59);
        wheelsBuilt = true;
    }

    function openIosTimePicker(target) {
        ensureTimeWheelsBuilt();
        activeTimeTarget = target;
        const currentVal = (target === 'start' ? modalStart : modalEnd).value;
        const [h, m] = currentVal.split(':').map(Number);
        TFS.Modal.open(iosTimePickerModal, {
            onOpen: () => { WP.setValue(wheelHoursClass, h); WP.setValue(wheelMinutesClass, m); }
        });
    }

    document.getElementById('btnOpenStartTime').addEventListener('click', () => openIosTimePicker('start'));
    document.getElementById('btnOpenEndTime').addEventListener('click', () => openIosTimePicker('end'));
    document.getElementById('cancelIosTime').addEventListener('click', () => TFS.Modal.close(iosTimePickerModal));
    document.getElementById('confirmIosTime').addEventListener('click', () => {
        const finalTime = `${U.pad2(WP.getValue(wheelHoursClass))}:${U.pad2(WP.getValue(wheelMinutesClass))}`;
        if (activeTimeTarget === 'start') { modalStart.value = finalTime; displayStartTime.textContent = finalTime; }
        else { modalEnd.value = finalTime; displayEndTime.textContent = finalTime; }
        TFS.Modal.close(iosTimePickerModal);
    });

    // ---------------------------------------------------------------- Delete session modal

    const customDeleteModal = document.getElementById('customDeleteModal');
    const deleteTargetName = document.getElementById('deleteTargetName');
    let sessionIdPendingDelete = null;

    function confirmDeleteSession(id) {
        const session = State.get().schedule.sessions.find(s => s.id === id);
        if (!session) return;
        sessionIdPendingDelete = id;
        deleteTargetName.textContent = topicLabelFor(session);
        TFS.Modal.open(customDeleteModal);
    }

    document.getElementById('cancelDeleteBtn').addEventListener('click', () => { sessionIdPendingDelete = null; TFS.Modal.close(customDeleteModal); });
    document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
        if (sessionIdPendingDelete) {
            const sessions = State.get().schedule.sessions.filter(s => s.id !== sessionIdPendingDelete);
            State.commit({ schedule: { sessions } });
            sessionIdPendingDelete = null;
        }
        TFS.Modal.close(customDeleteModal);
    });

    // ---------------------------------------------------------------- Search

    const openScheduleSearchBtn = document.getElementById('openScheduleSearchBtn');
    const scheduleSearchPanel = document.getElementById('scheduleSearchPanel');
    const scheduleSearchInput = document.getElementById('scheduleSearchInput');
    const scheduleSearchResults = document.getElementById('scheduleSearchResults');

    openScheduleSearchBtn.addEventListener('click', () => {
        const willOpen = scheduleSearchPanel.hidden;
        scheduleSearchPanel.hidden = !willOpen;
        openScheduleSearchBtn.setAttribute('aria-expanded', String(willOpen));
        if (willOpen) { scheduleSearchInput.focus(); } else { scheduleSearchInput.value = ''; renderSearchResults(''); }
    });

    scheduleSearchInput.addEventListener('input', () => renderSearchResults(scheduleSearchInput.value.trim()));
    scheduleSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { scheduleSearchPanel.hidden = true; openScheduleSearchBtn.setAttribute('aria-expanded', 'false'); openScheduleSearchBtn.focus(); }
    });

    function renderSearchResults(query) {
        scheduleSearchResults.innerHTML = '';
        if (!query) return;
        const q = query.toLocaleLowerCase(I18n.localeTag());

        const matchingSessions = State.get().schedule.sessions
            .filter(s => topicLabelFor(s).toLocaleLowerCase(I18n.localeTag()).includes(q))
            .sort((a, b) => a.dateISO.localeCompare(b.dateISO) || a.startMin - b.startMin);

        const subject = currentSubject();
        const matchingTopics = subject ? subject.topics.filter(t => I18n.pick(t.label).toLocaleLowerCase(I18n.localeTag()).includes(q)) : [];

        if (matchingSessions.length === 0 && matchingTopics.length === 0) {
            scheduleSearchResults.appendChild(U.el('p', { className: 'search-empty', text: I18n.t('common.noResults') }));
            return;
        }

        if (matchingSessions.length > 0) {
            scheduleSearchResults.appendChild(U.el('p', { className: 'search-results__group-title', text: I18n.t('s4.searchSessionsHeading') }));
            matchingSessions.forEach(session => {
                scheduleSearchResults.appendChild(U.el('div', {
                    className: 'search-result-item', attrs: { role: 'button', tabindex: '0' },
                    on: { click: () => jumpToSession(session), keydown: (e) => { if (e.key === 'Enter') jumpToSession(session); } }
                }, [
                    U.el('span', { text: topicLabelFor(session) }),
                    U.el('span', { className: 'text-outline', attrs: { style: 'font-size:0.75rem' }, text: `${I18n.formatDate(U.parseISODate(session.dateISO), { day: 'numeric', month: 'short' })} · ${U.minutesToTimeStr(session.startMin)}` })
                ]));
            });
        }

        if (matchingTopics.length > 0) {
            scheduleSearchResults.appendChild(U.el('p', { className: 'search-results__group-title', attrs: { style: 'margin-top:0.75rem' }, text: I18n.t('s4.searchTopicsHeading') }));
            matchingTopics.forEach(topic => {
                const done = !!(State.get().syllabusProgress[subject.id] || {})[topic.id];
                scheduleSearchResults.appendChild(U.el('div', { className: 'search-result-item' }, [
                    U.el('span', { text: I18n.pick(topic.label) }),
                    U.el('span', { className: 'material-symbols-outlined', attrs: { style: `color:${done ? 'var(--color-success)' : 'var(--color-outline)'}` }, text: done ? 'check_circle' : 'radio_button_unchecked' })
                ]));
            });
        }
    }

    function jumpToSession(session) {
        scheduleSearchPanel.hidden = true;
        openScheduleSearchBtn.setAttribute('aria-expanded', 'false');
        setViewedWeek(U.parseISODate(session.dateISO));
        requestAnimationFrame(() => {
            const block = scheduleGridContainer.querySelector(`[data-session-id="${session.id}"]`);
            if (block) { block.style.outline = '3px solid var(--color-primary)'; setTimeout(() => { block.style.outline = ''; }, 1500); }
        });
    }

    // ---------------------------------------------------------------- Wiring

    I18n.onChange(() => { if (isActive()) renderAll(); });
    State.subscribe(() => { if (isActive()) renderAll(); });

    TFS.Router.register('screen4', {
        onEnter: () => { TFS.Nav.show(); TFS.Nav.setActive('sched'); renderAll(); }
    });

})(window);
