/**
 * wheelpicker.js
 * The iOS-style scroll-snap wheel picker, shared by the daily-goal timer
 * picker (screen 6) and the class start/end time picker (screen 4's add
 * session modal). Extracted once so both stop duplicating the same math.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};

    /** Populate a wheel element (which already contains two spacer divs — one
     *  at each end, see index.html) with items 0..max, inserted before the
     *  trailing spacer so the first/last real item can still scroll to center. */
    function createItems(wheelEl, max, padChar) {
        const trailingSpacer = wheelEl.lastElementChild;
        for (let i = 0; i <= max; i++) {
            const item = document.createElement('div');
            item.className = 'wheel-item';
            item.dataset.val = i;
            item.textContent = padChar ? String(i).padStart(2, '0') : String(i);
            wheelEl.insertBefore(item, trailingSpacer);
        }
    }

    function updateSelection(wheelEl) {
        const center = wheelEl.scrollTop + wheelEl.clientHeight / 2;
        wheelEl.querySelectorAll('.wheel-item').forEach(item => {
            const itemCenter = item.offsetTop + item.clientHeight / 2;
            item.classList.toggle('is-selected', Math.abs(center - itemCenter) < 20);
        });
    }

    function getValue(wheelEl) {
        const selected = wheelEl.querySelector('.wheel-item.is-selected');
        return selected ? parseInt(selected.dataset.val, 10) : 0;
    }

    function setValue(wheelEl, val) {
        const target = Array.from(wheelEl.querySelectorAll('.wheel-item')).find(i => parseInt(i.dataset.val, 10) === val);
        if (target) wheelEl.scrollTop = target.offsetTop - (wheelEl.clientHeight / 2) + (target.clientHeight / 2);
        updateSelection(wheelEl);
    }

    function attachScrollSync(wheelEl) {
        wheelEl.addEventListener('scroll', () => updateSelection(wheelEl));
    }

    TFS.WheelPicker = { createItems, updateSelection, getValue, setValue, attachScrollSync };

})(window);
