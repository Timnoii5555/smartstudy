/**
 * onboarding.js
 * Screen 1 (subject picker) and Screen 2 (exam date + daily hours). Both
 * write straight into the central state store, so everything picked here
 * survives a refresh (bug 1.1) and is what Settings edits later on.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};
    const U = TFS.Utils;
    const I18n = TFS.I18n;
    const State = TFS.State;

    const subjectGrid = document.getElementById('subjectGrid');
    const nextBtn1 = document.getElementById('nextBtn1');

    let selectedSubjectId = State.get().plan.subject || null;

    function renderSubjectGrid() {
        subjectGrid.innerHTML = '';
        const subjects = TFS.Data.getSubjects();
        subjects.forEach((subject, index) => {
            const isSelected = subject.id === selectedSubjectId;
            const card = U.el('button', {
                className: 'subject-card' + (isSelected ? ' is-selected' : ''),
                attrs: {
                    type: 'button', role: 'radio', 'aria-checked': isSelected ? 'true' : 'false',
                    tabindex: (isSelected || (!selectedSubjectId && index === 0)) ? '0' : '-1',
                    'data-subject-id': subject.id
                },
                on: {
                    click: () => selectSubject(subject.id),
                    keydown: (e) => handleGridKeydown(e, subjects)
                }
            }, [
                U.el('div', { className: 'subject-card__row' }, [
                    U.el('div', { className: 'subject-card__main' }, [
                        U.el('div', { className: 'subject-card__icon' }, [
                            U.el('span', { className: 'material-symbols-outlined', attrs: { 'aria-hidden': 'true' }, text: subject.icon })
                        ]),
                        U.el('div', {}, [
                            U.el('h3', { className: 'subject-card__title', text: I18n.pick(subject.name) }),
                            U.el('p', { className: 'subject-card__desc', text: I18n.pick(subject.description) })
                        ])
                    ]),
                    U.el('div', { className: 'subject-card__check' }, [
                        U.el('span', { className: 'material-symbols-outlined', attrs: { 'aria-hidden': 'true' }, text: 'check' })
                    ])
                ]),
                U.el('div', { className: 'subject-card__accordion' }, [
                    U.el('p', {}, [
                        U.el('span', { className: 'material-symbols-outlined', attrs: { 'aria-hidden': 'true', style: 'font-size:16px' }, text: 'menu_book' }),
                        document.createTextNode(' ' + I18n.t('s1.topicsHeading'))
                    ]),
                    U.el('ul', {}, subject.topics.map(topic => U.el('li', { text: I18n.pick(topic.label) })))
                ])
            ]);
            subjectGrid.appendChild(card);
        });
    }

    function selectSubject(id) {
        selectedSubjectId = id;
        renderSubjectGrid();
        // Focus follows selection so keyboard users stay oriented.
        const btn = subjectGrid.querySelector(`[data-subject-id="${id}"]`);
        if (btn) btn.focus();
    }

    // Arrow/Home/End roving navigation for the radiogroup. Enter/Space are left
    // alone deliberately — these cards are real <button> elements, so the browser
    // already turns those keys into a native click that `on.click` handles;
    // hijacking them here too would risk selectSubject() firing twice.
    function handleGridKeydown(e, subjects) {
        const ids = subjects.map(s => s.id);
        const currentId = e.currentTarget.getAttribute('data-subject-id');
        let idx = ids.indexOf(currentId);
        if (['ArrowDown', 'ArrowRight'].includes(e.key)) idx = (idx + 1) % ids.length;
        else if (['ArrowUp', 'ArrowLeft'].includes(e.key)) idx = (idx - 1 + ids.length) % ids.length;
        else if (e.key === 'Home') idx = 0;
        else if (e.key === 'End') idx = ids.length - 1;
        else return;
        e.preventDefault();
        selectSubject(ids[idx]);
    }

    nextBtn1.addEventListener('click', () => {
        if (!selectedSubjectId) {
            TFS.Toast.warn(I18n.t('s1.errSelectSubject'));
            return;
        }
        State.commit({ plan: { subject: selectedSubjectId } });
        TFS.Router.show('screen2');
    });

    // ---------------------------------------------------------------- Screen 2

    const timeSlider = document.getElementById('timeSlider');
    const timeDisplay = document.getElementById('timeDisplay');
    const calcText = document.getElementById('calculationText');
    const displayDateEl = document.getElementById('displayDate');
    const openDatePickerBtn = document.getElementById('openDatePickerBtn');
    const generateBtn = document.getElementById('generateBtn');

    function currentExamDateISO() { return State.get().plan.examDateISO; }

    function updateHoursDisplay(hrs) {
        timeDisplay.textContent = I18n.formatNumber(hrs, { maximumFractionDigits: 1 });
        timeSlider.setAttribute('aria-valuetext', `${hrs} ${I18n.t('common.hours')}`);
    }

    function updateCalcText() {
        const hrs = parseFloat(timeSlider.value);
        const examISO = currentExamDateISO();
        if (!examISO) { calcText.textContent = I18n.t('s2.calcDefault'); return; }

        const nowZero = U.startOfDay(new Date());
        const examZero = U.parseISODate(examISO);
        const diffDays = Math.ceil((examZero - nowZero) / 86400000);

        if (diffDays < 0) calcText.textContent = I18n.t('s2.calcPast');
        else if (diffDays === 0) calcText.textContent = I18n.t('s2.calcToday', { hrs });
        else calcText.textContent = I18n.t('s2.calcDaysLeft', { days: diffDays, total: I18n.formatNumber(hrs * diffDays, { maximumFractionDigits: 1 }) });
    }

    function refreshDateDisplay() {
        const iso = currentExamDateISO();
        displayDateEl.textContent = iso ? I18n.formatDate(U.parseISODate(iso)) : I18n.t('s2.examDatePlaceholder');
    }

    function initScreen2FromState() {
        const hrs = State.get().plan.dailyGoalSeconds / 3600;
        timeSlider.value = hrs;
        updateHoursDisplay(hrs);
        refreshDateDisplay();
        updateCalcText();
    }

    timeSlider.addEventListener('input', () => updateHoursDisplay(parseFloat(timeSlider.value)));
    timeSlider.addEventListener('input', updateCalcText);
    timeSlider.addEventListener('change', () => {
        const hrs = parseFloat(timeSlider.value);
        State.commit({ plan: { dailyGoalSeconds: Math.round(hrs * 3600) } });
    });

    openDatePickerBtn.addEventListener('click', () => {
        TFS.DatePicker.open({
            initialISO: currentExamDateISO(),
            onSelect: (iso) => {
                State.commit({ plan: { examDateISO: iso } });
                refreshDateDisplay();
                updateCalcText();
            }
        });
    });

    generateBtn.addEventListener('click', () => {
        if (!currentExamDateISO()) {
            TFS.Toast.warn(I18n.t('s2.errSelectDate'));
            return;
        }
        TFS.Router.show('screen3');
    });

    I18n.onChange(() => {
        renderSubjectGrid();
        updateHoursDisplay(parseFloat(timeSlider.value));
        refreshDateDisplay();
        updateCalcText();
    });

    TFS.Router.register('screen1', {
        onEnter: () => { TFS.Nav.hide(); renderSubjectGrid(); }
    });
    TFS.Router.register('screen2', {
        onEnter: () => { TFS.Nav.hide(); initScreen2FromState(); }
    });

    renderSubjectGrid();

})(window);
