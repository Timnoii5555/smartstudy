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

    /** `opts.smooth` animates the roll to the target value (the little "spin"
     *  feel wheel pickers are expected to have) instead of jumping instantly —
     *  used by attachWheelStep below. Instant (the default) is still right for
     *  the initial value set when a modal first opens. */
    function setValue(wheelEl, val, opts = {}) {
        const target = Array.from(wheelEl.querySelectorAll('.wheel-item')).find(i => parseInt(i.dataset.val, 10) === val);
        if (target) {
            const top = target.offsetTop - (wheelEl.clientHeight / 2) + (target.clientHeight / 2);
            if (opts.smooth) wheelEl.scrollTo({ top, behavior: 'smooth' });
            else wheelEl.scrollTop = top;
        }
        // Tracked separately from the DOM so attachWheelStep always knows the
        // *intended* value even mid-animation, rather than reading whatever
        // `.is-selected` happens to be at the halfway point of a smooth scroll.
        wheelEl._wheelTargetValue = val;
        updateSelection(wheelEl);
    }

    function attachScrollSync(wheelEl) {
        wheelEl.addEventListener('scroll', () => updateSelection(wheelEl));
    }

    /**
     * A raw `wheel` event over a tall list with small items translates a single
     * mouse-wheel notch (deltaY often 100-120px) into several items at once —
     * on a 40px-tall `.wheel-item` that flies past 2-3 values per notch, making
     * it impossible to stop on the exact hour/minute you want. This normalizes
     * every wheel gesture (mouse notch or trackpad) to move exactly one step —
     * animated smoothly (the classic "spin to the next value" feel) — with a
     * cooldown roughly matching that animation so a single big-delta notch
     * can't double-fire or race the in-flight scroll.
     */
    function attachWheelStep(wheelEl, max) {
        let cooldown = false;
        wheelEl.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (cooldown) return;
            cooldown = true;
            const dir = e.deltaY > 0 ? 1 : -1;
            const current = (typeof wheelEl._wheelTargetValue === 'number') ? wheelEl._wheelTargetValue : getValue(wheelEl);
            const next = Math.min(max, Math.max(0, current + dir));
            setValue(wheelEl, next, { smooth: true });
            setTimeout(() => { cooldown = false; }, 220);
        }, { passive: false });
    }

    TFS.WheelPicker = { createItems, updateSelection, getValue, setValue, attachScrollSync, attachWheelStep };

})(window);
