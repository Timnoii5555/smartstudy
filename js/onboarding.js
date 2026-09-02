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
    const subjectCategoryTabs = document.getElementById('subjectCategoryTabs');
    const nextBtn1 = document.getElementById('nextBtn1');

    let selectedSubjectId = State.get().plan.subject || null;

    // ---------------------------------------------------------------- Category tabs
    // Splits the 23+ built-in subjects (plus whatever the learner has made
    // themselves) into quick-jump tabs instead of one long scroll — see
    // TFS.Data.categoryOf() for how a subject is sorted into one of these.
    const CATEGORIES = [
        { key: 'all', label: { th: 'ทั้งหมด', en: 'All' } },
        { key: 'tgat', label: { th: 'TGAT', en: 'TGAT' } },
        { key: 'tpat', label: { th: 'TPAT', en: 'TPAT' } },
        { key: 'alevel', label: { th: 'A-Level', en: 'A-Level' } },
        { key: 'custom', label: { th: 'ของฉัน', en: 'Mine' } }
    ];
    let activeCategory = 'all';

    function renderCategoryTabs() {
        subjectCategoryTabs.innerHTML = '';
        CATEGORIES.forEach(cat => {
            subjectCategoryTabs.appendChild(U.el('button', {
                className: 'subject-category-tab' + (activeCategory === cat.key ? ' is-active' : ''),
                attrs: { type: 'button', role: 'tab', 'aria-selected': activeCategory === cat.key ? 'true' : 'false' },
                text: I18n.pick(cat.label),
                on: { click: () => { activeCategory = cat.key; renderCategoryTabs(); renderSubjectGrid(); } }
            }));
        });
    }

    function visibleSubjects() {
        const all = TFS.Data.getSubjects();
        return activeCategory === 'all' ? all : all.filter(s => TFS.Data.categoryOf(s) === activeCategory);
    }

    async function confirmDeleteCustomSubject(subject) {
        const ok = await TFS.Modal.confirm({
            title: I18n.t('s1.deleteCustomTitle'),
            message: I18n.t('s1.deleteCustomMsg', { name: I18n.pick(subject.name) }),
            confirmText: I18n.t('common.delete'),
            cancelText: I18n.t('common.cancel'),
            danger: true
        });
        if (!ok) return;
        const remaining = (State.get().customSubjects || []).filter(s => s.id !== subject.id);
        State.commit({ customSubjects: remaining });
        if (selectedSubjectId === subject.id) selectedSubjectId = null;
        // Deleting the subject you're actively studying would otherwise leave
        // plan.subject pointing at nothing — send the learner back to pick again.
        if (State.get().plan.subject === subject.id) State.commit({ plan: { subject: null, readingPlan: null } });
        renderSubjectGrid();
    }

    function renderSubjectGrid() {
        subjectGrid.innerHTML = '';
        const subjects = visibleSubjects();
        const completedIds = State.get().plan.completedSubjects || [];
        subjects.forEach((subject, index) => {
            const isSelected = subject.id === selectedSubjectId;
            const isCompleted = completedIds.includes(subject.id);
            const card = U.el('button', {
                className: 'subject-card' + (isSelected ? ' is-selected' : '') + (isCompleted ? ' is-completed' : ''),
                attrs: {
                    type: 'button', role: 'radio', 'aria-checked': isSelected ? 'true' : 'false',
                    tabindex: (isSelected || (!selectedSubjectId && index === 0)) ? '0' : '-1',
                    'data-subject-id': subject.id,
                    disabled: isCompleted || undefined,
                    title: isCompleted ? I18n.t('s1.completedDisabledHint') : undefined
                },
                on: {
                    // Completed subjects are shown (so progress stays visible) but are
                    // a dead end on purpose — re-selecting one you already finished
                    // would silently start overwriting its finished reading plan.
                    click: () => { if (!isCompleted) selectSubject(subject.id); },
                    keydown: (e) => handleGridKeydown(e, subjects)
                }
            }, [
                U.el('div', { className: 'subject-card__row' }, [
                    U.el('div', { className: 'subject-card__main' }, [
                        U.el('div', { className: 'subject-card__icon' }, [
                            U.el('span', { className: 'material-symbols-outlined', attrs: { 'aria-hidden': 'true' }, text: subject.icon })
                        ]),
                        U.el('div', {}, [
                            U.el('h3', { className: 'subject-card__title' }, [
                                document.createTextNode(I18n.pick(subject.name) + ' '),
                                isCompleted ? U.el('span', { className: 'subject-card__done-tag', text: I18n.t('s1.completedTag') }) : document.createTextNode('')
                            ]),
                            U.el('p', { className: 'subject-card__desc', text: I18n.pick(subject.description) })
                        ])
                    ]),
                    subject.isCustom ? U.el('button', {
                        className: 'icon-btn icon-btn--danger', attrs: { type: 'button', 'aria-label': I18n.t('s1.deleteCustomTitle') },
                        on: { click: (e) => { e.stopPropagation(); confirmDeleteCustomSubject(subject); } }
                    }, [U.el('span', { className: 'material-symbols-outlined', attrs: { 'aria-hidden': 'true' }, text: 'delete' })]) : null,
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

        // Shown whenever "All" or "Mine" is the active tab, so a learner who
        // doesn't want any of the prepared content is never more than one tap
        // away from defining their own instead.
        if (activeCategory === 'all' || activeCategory === 'custom') {
            subjectGrid.appendChild(U.el('button', {
                className: 'subject-card subject-card--add', attrs: { type: 'button' },
                on: { click: openCustomSubjectModal }
            }, [
                U.el('div', { className: 'subject-card__main' }, [
                    U.el('div', { className: 'subject-card__icon' }, [
                        U.el('span', { className: 'material-symbols-outlined', attrs: { 'aria-hidden': 'true' }, text: 'add' })
                    ]),
                    U.el('div', {}, [
                        U.el('h3', { className: 'subject-card__title', text: I18n.t('modalCustomSubject.title') }),
                        U.el('p', { className: 'subject-card__desc', text: I18n.t('s1.addCustomDesc') })
                    ])
                ])
            ]));
        }
    }

    // ---------------------------------------------------------------- Create-my-own-subject modal

    const customSubjectModal = document.getElementById('customSubjectModal');
    const customSubjectName = document.getElementById('customSubjectName');
    const customTopicRows = document.getElementById('customTopicRows');

    function addCustomTopicRow() {
        const row = U.el('div', { className: 'flex gap-2 items-center' }, [
            U.el('input', { className: 'input custom-topic-input', attrs: { type: 'text', maxlength: '80' } }),
            U.el('button', {
                className: 'icon-btn icon-btn--danger', attrs: { type: 'button' },
                on: { click: () => row.remove() }
            }, [U.el('span', { className: 'material-symbols-outlined', attrs: { 'aria-hidden': 'true' }, text: 'close' })])
        ]);
        row.querySelector('.custom-topic-input').placeholder = I18n.t('modalCustomSubject.topicPlaceholder');
        customTopicRows.appendChild(row);
    }

    function openCustomSubjectModal() {
        customSubjectName.value = '';
        customTopicRows.innerHTML = '';
        addCustomTopicRow();
        addCustomTopicRow();
        TFS.Modal.open(customSubjectModal);
    }

    document.getElementById('addCustomTopicRowBtn').addEventListener('click', addCustomTopicRow);
    document.getElementById('closeCustomSubjectBtn').addEventListener('click', () => TFS.Modal.close(customSubjectModal));
    document.getElementById('closeCustomSubjectBtn2').addEventListener('click', () => TFS.Modal.close(customSubjectModal));
    document.getElementById('saveCustomSubjectBtn').addEventListener('click', () => {
        const name = customSubjectName.value.trim();
        if (!name) { TFS.Toast.warn(I18n.t('modalCustomSubject.errName')); return; }
        const topicNames = U.qsa('.custom-topic-input', customTopicRows).map(el => el.value.trim()).filter(Boolean);
        if (topicNames.length === 0) { TFS.Toast.warn(I18n.t('modalCustomSubject.errTopics')); return; }

        const newSubject = {
            id: 'custom:' + U.uuid(),
            code: name.slice(0, 24),
            name: { th: name, en: name },
            description: { th: 'วิชาที่กำหนดเอง', en: 'Custom subject' },
            icon: 'edit_note',
            colorToken: 'primary',
            isCustom: true,
            topics: topicNames.map(label => ({ id: 'topic:' + U.uuid(), label: { th: label, en: label }, difficulty: 2, estMinutes: 120 }))
        };
        State.commit({ customSubjects: [...(State.get().customSubjects || []), newSubject] });
        TFS.Modal.close(customSubjectModal);
        activeCategory = 'custom';
        renderCategoryTabs();
        selectSubject(newSubject.id);
    });

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
    const orderStrategyGrid = document.getElementById('orderStrategyGrid');

    const ORDER_STRATEGY_META = {
        balanced: { icon: 'shuffle', label: { th: 'อัตโนมัติ (แนะนำ)', en: 'Auto (recommended)' }, desc: { th: 'สลับบทยากง่ายให้สมดุลตลอดแผน', en: 'Interleaves hard & easy topics evenly' } },
        sequential: { icon: 'format_list_numbered', label: { th: 'เรียงตามลำดับ', en: 'In order' }, desc: { th: 'อ่านตามลำดับหัวข้อในซิลลาบัส', en: 'Follows the syllabus order as-is' } },
        easyFirst: { icon: 'trending_up', label: { th: 'ง่ายไปยาก', en: 'Easy → hard' }, desc: { th: 'สร้างความมั่นใจก่อนเจอบทยาก', en: 'Builds confidence before the hard stuff' } },
        hardFirst: { icon: 'trending_down', label: { th: 'ยากไปง่าย', en: 'Hard → easy' }, desc: { th: 'เคลียร์บทยากตอนที่ยังสดชื่นที่สุด', en: 'Tackles the toughest topics while fresh' } }
    };

    function renderOrderStrategyGrid() {
        orderStrategyGrid.innerHTML = '';
        const current = State.get().plan.orderStrategy || 'balanced';
        TFS.Planner.ORDER_STRATEGIES.forEach(key => {
            const meta = ORDER_STRATEGY_META[key];
            const isSelected = key === current;
            orderStrategyGrid.appendChild(U.el('button', {
                className: 'order-strategy-card' + (isSelected ? ' is-selected' : ''),
                attrs: { type: 'button', role: 'radio', 'aria-checked': isSelected ? 'true' : 'false' },
                on: { click: () => { State.commit({ plan: { orderStrategy: key } }); renderOrderStrategyGrid(); } }
            }, [
                U.el('span', { className: 'material-symbols-outlined order-strategy-card__icon', attrs: { 'aria-hidden': 'true' }, text: meta.icon }),
                U.el('div', {}, [
                    U.el('h4', { className: 'order-strategy-card__title', text: I18n.pick(meta.label) }),
                    U.el('p', { className: 'order-strategy-card__desc', text: I18n.pick(meta.desc) })
                ]),
                U.el('span', { className: 'material-symbols-outlined order-strategy-card__check', attrs: { 'aria-hidden': 'true' }, text: 'check_circle' })
            ]));
        });
    }

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
        renderOrderStrategyGrid();
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
        const subject = TFS.Data.getSubject(State.get().plan.subject);
        const alreadyDone = Object.keys(State.get().syllabusProgress[subject.id] || {});
        const plan = TFS.Planner.buildReadingPlan({
            subject,
            examDateISO: currentExamDateISO(),
            dailyGoalSeconds: State.get().plan.dailyGoalSeconds,
            orderStrategy: State.get().plan.orderStrategy || 'balanced',
            todayDate: new Date(),
            completedTopicIds: alreadyDone
        });
        State.commit({ plan: { readingPlan: plan } });
        TFS.Router.show('screen3');
    });

    I18n.onChange(() => {
        renderCategoryTabs();
        renderSubjectGrid();
        updateHoursDisplay(parseFloat(timeSlider.value));
        refreshDateDisplay();
        updateCalcText();
        renderOrderStrategyGrid();
    });

    TFS.Router.register('screen1', {
        onEnter: () => { TFS.Nav.hide(); renderCategoryTabs(); renderSubjectGrid(); }
    });
    TFS.Router.register('screen2', {
        onEnter: () => { TFS.Nav.hide(); initScreen2FromState(); }
    });

    renderCategoryTabs();
    renderSubjectGrid();

})(window);
