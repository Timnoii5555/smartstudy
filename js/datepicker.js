/**
 * datepicker.js
 * The exam-date calendar modal (#customDatePickerModal), shared by the
 * onboarding screen (2.1) and the Settings panel so there is exactly one
 * implementation of "pick the exam date" instead of two copies drifting apart.
 * Selecting a day immediately commits and closes, matching the rest of the
 * app's calendar interactions.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};
    const U = TFS.Utils;
    const I18n = TFS.I18n;

    const overlay = document.getElementById('customDatePickerModal');
    const monthYearEl = document.getElementById('pickerMonthYear');
    const weekdaysEl = document.getElementById('pickerWeekdays');
    const daysEl = document.getElementById('pickerCalendarDays');
    const prevBtn = document.getElementById('pickerPrevMonth');
    const nextBtn = document.getElementById('pickerNextMonth');
    const closeBtn = document.getElementById('closeDatePickerBtn');

    let viewDate = new Date();
    let currentSelectedISO = null;
    let onSelectCallback = null;

    function renderWeekdays() {
        weekdaysEl.innerHTML = '';
        I18n.weekdayShortLabels().forEach(label => {
            weekdaysEl.appendChild(U.el('span', { text: label }));
        });
    }

    function render() {
        monthYearEl.textContent = I18n.formatMonthYear(viewDate);
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = U.startOfDay(new Date());

        daysEl.innerHTML = '';
        for (let i = 0; i < firstDayOfMonth; i++) daysEl.appendChild(U.el('span'));

        for (let d = 1; d <= daysInMonth; d++) {
            const cellDate = new Date(year, month, d);
            const iso = U.formatDateISO(cellDate);
            const isPast = cellDate < today;
            const isSelected = currentSelectedISO === iso;

            const classes = ['calendar__cell'];
            if (isPast) classes.push('calendar__cell--disabled');
            else classes.push('calendar__cell--clickable');
            if (isSelected) classes.push('calendar__cell--selected');

            const btn = U.el('button', {
                className: classes.join(' '),
                attrs: {
                    type: 'button',
                    'aria-label': I18n.formatDate(cellDate),
                    'aria-selected': isSelected ? 'true' : 'false',
                    disabled: isPast || undefined
                },
                text: String(d),
                on: !isPast ? { click: () => selectDate(iso) } : undefined
            });
            daysEl.appendChild(btn);
        }
    }

    function selectDate(iso) {
        currentSelectedISO = iso;
        if (typeof onSelectCallback === 'function') onSelectCallback(iso);
        TFS.Modal.close(overlay);
    }

    prevBtn.addEventListener('click', () => { viewDate.setMonth(viewDate.getMonth() - 1); render(); });
    nextBtn.addEventListener('click', () => { viewDate.setMonth(viewDate.getMonth() + 1); render(); });
    closeBtn.addEventListener('click', () => TFS.Modal.close(overlay));
    I18n.onChange(() => { renderWeekdays(); render(); });

    /** opts: { initialISO, onSelect(iso) } */
    function open(opts = {}) {
        currentSelectedISO = opts.initialISO || null;
        onSelectCallback = opts.onSelect || null;
        viewDate = currentSelectedISO ? U.parseISODate(currentSelectedISO) : new Date();
        renderWeekdays();
        render();
        TFS.Modal.open(overlay);
    }

    TFS.DatePicker = { open };

})(window);
