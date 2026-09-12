/**
 * garden.js
 * The dashboard's "focus garden" — a small illustrated plant that grows,
 * continuously and smoothly, with the learner's own lifetime focus hours.
 * This is the answer to "the app still feels flat": everything else on
 * this screen is numbers and progress bars; this is the one thing that's
 * alive and worth glancing at even on a day with nothing due.
 *
 * Deliberately in the same spirit as the streak/readiness score/recap
 * card rather than a break from it: it visualizes data that's already
 * tracked (state.focus.totalSecondsByDate), it never resets or punishes a
 * quiet day (it can only ever grow, never wilt), and there is nothing
 * here to compare against another learner's garden — it's private, it's
 * just a nicer way to look at "how much have I actually put into this."
 * That last point is also why it's a plain growth curve rather than an
 * unlock/reward system with discrete milestones to "earn" — this app's
 * rules explicitly rule out badge/points-style extrinsic rewards, and a
 * garden that only ever fills in gradually, tied to a real number, reads
 * as a mirror of effort rather than a game layer bolted on top of one.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};
    const U = TFS.Utils;
    const I18n = TFS.I18n;
    const State = TFS.State;

    const SVG_NS = 'http://www.w3.org/2000/svg';

    // Canopy leaves fill in one at a time as growth increases, each fully
    // "open" by (threshold + 0.16) — deterministic per slot so the same
    // growth value always draws the same garden, but staggered so it reads
    // as filling in gradually rather than popping in all at once.
    const LEAF_SLOTS = [
        { x: 0, y: -46, threshold: 0.05, r: 22, color: '#6fae3c' },
        { x: -26, y: -34, threshold: 0.14, r: 19, color: '#7dbb47' },
        { x: 26, y: -34, threshold: 0.14, r: 19, color: '#7dbb47' },
        { x: -40, y: -12, threshold: 0.24, r: 18, color: '#8bc34a' },
        { x: 40, y: -12, threshold: 0.24, r: 18, color: '#8bc34a' },
        { x: -18, y: -58, threshold: 0.34, r: 17, color: '#9ccc52' },
        { x: 18, y: -58, threshold: 0.34, r: 17, color: '#9ccc52' },
        { x: -46, y: 6, threshold: 0.46, r: 15, color: '#8bc34a' },
        { x: 46, y: 6, threshold: 0.46, r: 15, color: '#8bc34a' },
        { x: 0, y: -78, threshold: 0.6, r: 16, color: '#a5d65c' },
        { x: -30, y: -66, threshold: 0.72, r: 13, color: '#b2df6e' },
        { x: 30, y: -66, threshold: 0.72, r: 13, color: '#b2df6e' }
    ];

    // Small pink accents that only bloom once the tree is nearly fully grown.
    const FLOWER_SLOTS = [
        { x: -20, y: -50, threshold: 0.82 },
        { x: 24, y: -60, threshold: 0.88 },
        { x: -4, y: -70, threshold: 0.94 }
    ];

    const HOURS_FOR_FULL_GROWTH = 80;

    function lifetimeHours() {
        const totals = State.get().focus.totalSecondsByDate;
        const totalSeconds = Object.values(totals).reduce((a, b) => a + b, 0);
        return totalSeconds / 3600;
    }

    /** A satisfying growth curve: fast progress early (so a first study
     *  session already visibly plants something), slowing as it approaches
     *  full bloom rather than needing an unrealistic number of hours. */
    function growthFor(hours) {
        return U.clamp(Math.sqrt(Math.max(0, hours) / HOURS_FOR_FULL_GROWTH), 0, 1);
    }

    function lerp(t, threshold, span) {
        return U.clamp((t - threshold) / span, 0, 1);
    }

    function svgEl(tag, attrs) {
        const el = document.createElementNS(SVG_NS, tag);
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        return el;
    }

    // Built once and reused across renders (rather than torn down and
    // rebuilt each time) specifically so the CSS transitions in
    // styles/components.css have an existing element to animate FROM —
    // recreating fresh circles every render would always paint them
    // straight at their final size with nothing to visibly grow.
    let built = null;

    function buildTreeSvg() {
        const svg = svgEl('svg', { viewBox: '-90 -110 180 156', width: '100%', height: '100%', 'aria-hidden': 'true' });
        svg.appendChild(svgEl('ellipse', { cx: 0, cy: 36, rx: 62, ry: 8, fill: 'var(--color-surface-high)' }));

        const trunk = svgEl('rect', { x: -2.5, y: 34, width: 5, height: 0, rx: 2.5, fill: '#8a6640' });
        svg.appendChild(trunk);

        const leafCircles = LEAF_SLOTS.map((leaf) => {
            const c = svgEl('circle', { cx: leaf.x, cy: 36, r: 0, fill: leaf.color, opacity: 0 });
            svg.appendChild(c);
            return c;
        });

        const flowerCircles = FLOWER_SLOTS.map((flower) => {
            const c = svgEl('circle', { cx: flower.x, cy: 36, r: 0, fill: '#ff8fab', opacity: 0 });
            svg.appendChild(c);
            return c;
        });

        return { svg, trunk, leafCircles, flowerCircles };
    }

    function applyGrowth(growth) {
        const trunkH = 18 + growth * 58;
        const trunkW = 5 + growth * 5;
        built.trunk.setAttribute('x', -trunkW / 2);
        built.trunk.setAttribute('y', 36 - trunkH);
        built.trunk.setAttribute('width', trunkW);
        built.trunk.setAttribute('height', trunkH);
        built.trunk.setAttribute('rx', trunkW / 2);

        LEAF_SLOTS.forEach((leaf, i) => {
            const t = lerp(growth, leaf.threshold, 0.16);
            const cy = 36 - trunkH * 0.55 + leaf.y * 0.55;
            const circle = built.leafCircles[i];
            circle.setAttribute('cx', leaf.x * (0.5 + t * 0.5));
            circle.setAttribute('cy', cy);
            circle.setAttribute('r', leaf.r * t);
            circle.setAttribute('opacity', t > 0 ? 0.55 + t * 0.45 : 0);
        });

        FLOWER_SLOTS.forEach((flower, i) => {
            const t = lerp(growth, flower.threshold, 0.1);
            const cy = 36 - trunkH * 0.55 + flower.y * 0.55;
            const circle = built.flowerCircles[i];
            circle.setAttribute('cx', flower.x);
            circle.setAttribute('cy', cy);
            circle.setAttribute('r', 4.5 * t);
            circle.setAttribute('opacity', t);
        });
    }

    function stageLabelKey(growth) {
        if (growth < 0.08) return 'garden.stageSeed';
        if (growth < 0.35) return 'garden.stageSprout';
        if (growth < 0.7) return 'garden.stageGrowing';
        if (growth < 0.98) return 'garden.stageBlooming';
        return 'garden.stageFull';
    }

    const gardenCard = document.getElementById('gardenCard');
    const gardenSvgWrap = document.getElementById('gardenSvgWrap');
    const gardenStageLabel = document.getElementById('gardenStageLabel');
    const gardenHoursLabel = document.getElementById('gardenHoursLabel');

    function render() {
        if (!gardenCard) return;
        if (!built) {
            built = buildTreeSvg();
            gardenSvgWrap.appendChild(built.svg);
        }

        const hours = lifetimeHours();
        const growth = growthFor(hours);
        applyGrowth(growth);

        gardenStageLabel.textContent = I18n.t(stageLabelKey(growth));
        gardenHoursLabel.textContent = I18n.t('garden.hoursCaption', { hrs: U.formatSecondsToHHMM(hours * 3600) });
    }

    // No independent State/I18n subscription here — js/dashboard.js already
    // re-renders this whole screen (including calling render() below) on
    // every relevant state change and language switch while screen3 is
    // active, the same way it drives js/streak.js's reconcile().
    TFS.Garden = { render };

})(window);
