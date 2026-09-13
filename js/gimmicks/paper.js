/**
 * js/gimmicks/paper.js
 * The Paper theme's gimmick: a stylized notebook page, not a copy of the
 * real task list (task list stays plain and identical across all 4
 * themes, per the phase brief's own placement rule) — so a real checklist
 * tick (js/dashboard.js's toggleTopic(), via TFS.Themes.notifyTaskComplete)
 * writes the topic's title onto *today's page* here, capped at 6 lines,
 * and every page renders each of its lines with a pen strikethrough.
 *
 * Three more decorations layer onto that same page: a coffee stain once
 * that day's real focus time (state.focus.totalSecondsByDate, the same
 * record js/garden.js and js/streak.js already read — nothing new tracked
 * for it) crosses 60 minutes; the current streak (state.streak.current,
 * likewise reused rather than re-derived) drawn as tally marks; and,
 * once a page is no longer today's, a page-wear effect that deepens with
 * age. 12 doodles unlock at lifetime-focus-hours milestones and, once
 * earned, stay stamped in the corner of every page from then on.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};
    const U = TFS.Utils;
    const I18n = TFS.I18n;
    const State = TFS.State;
    const SVG_NS = 'http://www.w3.org/2000/svg';

    const MAX_TASKS_PER_PAGE = 6;
    const MAX_PAGES_KEPT = 30;
    const COFFEE_STAIN_MINUTES = 60;

    // Lifetime-focus-hours milestones, easiest first — once crossed, a
    // doodle is kept forever (see checkDoodleUnlocks()).
    const DOODLES = [
        { id: 'star', hours: 1 }, { id: 'flower', hours: 3 }, { id: 'moon', hours: 5 },
        { id: 'cup', hours: 10 }, { id: 'cloud', hours: 15 }, { id: 'heart', hours: 20 },
        { id: 'umbrella', hours: 30 }, { id: 'book', hours: 45 }, { id: 'key', hours: 60 },
        { id: 'feather', hours: 80 }, { id: 'bell', hours: 100 }, { id: 'paw', hours: 150 }
    ];

    function svgEl(tag, attrs) {
        const el = document.createElementNS(SVG_NS, tag);
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        return el;
    }

    function todayISO() { return U.formatDateISO(new Date()); }

    function lifetimeHours() {
        const totals = State.get().focus.totalSecondsByDate;
        return Object.values(totals).reduce((a, b) => a + b, 0) / 3600;
    }

    function minutesFor(dateISO) {
        const totals = State.get().focus.totalSecondsByDate;
        return Math.round((totals[dateISO] || 0) / 60);
    }

    function wearLevelForDate(dateISO) {
        const daysAgo = Math.round((U.startOfDay(new Date()) - U.parseISODate(dateISO)) / 86400000);
        if (daysAgo >= 21) return 3;
        if (daysAgo >= 10) return 2;
        if (daysAgo >= 3) return 1;
        return 0;
    }

    function pruneOldPages(pages) {
        const cutoff = U.formatDateISO(U.addDays(new Date(), -MAX_PAGES_KEPT));
        const out = {};
        Object.keys(pages).forEach((dateISO) => { if (dateISO >= cutoff) out[dateISO] = pages[dateISO]; });
        return out;
    }

    function checkDoodleUnlocks() {
        const hours = lifetimeHours();
        const unlocked = State.get().paperNotebook.unlockedDoodles;
        const earned = DOODLES.filter((d) => hours >= d.hours && !unlocked.includes(d.id)).map((d) => d.id);
        if (earned.length) State.commit({ paperNotebook: { unlockedDoodles: [...unlocked, ...earned] } });
    }

    // ---------------------------------------------------------------- Doodle glyphs
    // Simple single-stroke shapes (numeric primitives, not hand-typed
    // bezier art) in a fixed 0-24 viewBox — meant to read as margin
    // doodles, not polished icons.

    function buildGlyph(id) {
        const g = svgEl('g', {});
        switch (id) {
            case 'star': {
                const pts = [];
                for (let i = 0; i < 10; i++) {
                    const r = i % 2 === 0 ? 8 : 3.5;
                    const ang = -Math.PI / 2 + i * Math.PI / 5;
                    pts.push(`${(12 + r * Math.cos(ang)).toFixed(1)},${(12 + r * Math.sin(ang)).toFixed(1)}`);
                }
                g.appendChild(svgEl('polygon', { points: pts.join(' ') }));
                break;
            }
            case 'flower': {
                g.appendChild(svgEl('circle', { cx: 12, cy: 12, r: 2 }));
                for (let i = 0; i < 5; i++) {
                    const ang = -Math.PI / 2 + i * (2 * Math.PI / 5);
                    g.appendChild(svgEl('circle', { cx: (12 + 6 * Math.cos(ang)).toFixed(1), cy: (12 + 6 * Math.sin(ang)).toFixed(1), r: 3 }));
                }
                break;
            }
            case 'moon':
                g.appendChild(svgEl('path', { d: 'M15 5 A8 8 0 1 0 15 19 A6 6 0 1 1 15 5 Z' }));
                break;
            case 'cup':
                g.appendChild(svgEl('path', { d: 'M6 9 H16 V15 A5 5 0 0 1 6 15 Z' }));
                g.appendChild(svgEl('path', { d: 'M16 10 H18 A2.5 2.5 0 0 1 18 15 H16' }));
                g.appendChild(svgEl('line', { x1: 5, y1: 18, x2: 18, y2: 18 }));
                break;
            case 'cloud':
                g.appendChild(svgEl('circle', { cx: 9, cy: 13, r: 3.5 }));
                g.appendChild(svgEl('circle', { cx: 13, cy: 11, r: 4.5 }));
                g.appendChild(svgEl('circle', { cx: 17, cy: 13.5, r: 3 }));
                g.appendChild(svgEl('line', { x1: 6, y1: 16.5, x2: 20, y2: 16.5 }));
                break;
            case 'heart':
                g.appendChild(svgEl('path', { d: 'M12 19 C4 13 4 7 8.5 6 C10.5 5.5 12 7 12 9 C12 7 13.5 5.5 15.5 6 C20 7 20 13 12 19 Z' }));
                break;
            case 'umbrella':
                g.appendChild(svgEl('path', { d: 'M4 12 A8 8 0 0 1 20 12' }));
                g.appendChild(svgEl('line', { x1: 12, y1: 12, x2: 12, y2: 18 }));
                g.appendChild(svgEl('path', { d: 'M12 18 a2 2 0 0 0 4 0' }));
                break;
            case 'book':
                g.appendChild(svgEl('path', { d: 'M12 7 C9 5.5 6 5.5 4 6.5 V17 C6 16 9 16 12 17.5 C15 16 18 16 20 17 V6.5 C18 5.5 15 5.5 12 7 Z' }));
                g.appendChild(svgEl('line', { x1: 12, y1: 7, x2: 12, y2: 17.5 }));
                break;
            case 'key':
                g.appendChild(svgEl('circle', { cx: 8, cy: 8, r: 3.5 }));
                g.appendChild(svgEl('line', { x1: 10.5, y1: 10.5, x2: 19, y2: 19 }));
                g.appendChild(svgEl('line', { x1: 16, y1: 16, x2: 18, y2: 14 }));
                g.appendChild(svgEl('line', { x1: 18, y1: 18, x2: 20, y2: 16 }));
                break;
            case 'feather':
                g.appendChild(svgEl('path', { d: 'M18 5 C10 6 6 12 5 20 C13 19 19 15 19 6 Z' }));
                g.appendChild(svgEl('line', { x1: 18, y1: 5, x2: 6, y2: 19 }));
                break;
            case 'bell':
                g.appendChild(svgEl('path', { d: 'M7 15 C7 9 9 6 12 6 C15 6 17 9 17 15 L19 17 H5 Z' }));
                g.appendChild(svgEl('line', { x1: 10, y1: 18.5, x2: 14, y2: 18.5 }));
                g.appendChild(svgEl('circle', { cx: 12, cy: 20, r: 1 }));
                break;
            case 'paw':
                g.appendChild(svgEl('ellipse', { cx: 12, cy: 16, rx: 4.5, ry: 3.5 }));
                g.appendChild(svgEl('circle', { cx: 6.5, cy: 9.5, r: 2 }));
                g.appendChild(svgEl('circle', { cx: 10.5, cy: 6.5, r: 2 }));
                g.appendChild(svgEl('circle', { cx: 14.5, cy: 6.5, r: 2 }));
                g.appendChild(svgEl('circle', { cx: 18, cy: 9.5, r: 2 }));
                break;
            default:
                g.appendChild(svgEl('circle', { cx: 12, cy: 12, r: 6 }));
        }
        return g;
    }

    function buildDoodleSvg(id, locked) {
        const svg = svgEl('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' });
        const g = buildGlyph(id);
        g.setAttribute('fill', 'none');
        g.setAttribute('stroke', locked ? 'var(--color-outline)' : 'var(--color-primary)');
        g.setAttribute('stroke-width', '1.5');
        g.setAttribute('stroke-linecap', 'round');
        g.setAttribute('stroke-linejoin', 'round');
        if (locked) g.setAttribute('opacity', '0.3');
        svg.appendChild(g);
        return svg;
    }

    // ---------------------------------------------------------------- Page decorations

    function buildTallyGroup(n) {
        const svg = svgEl('svg', { viewBox: '0 0 24 20', class: 'paper-tally__group', 'aria-hidden': 'true' });
        for (let i = 0; i < Math.min(n, 4); i++) {
            const x = 3 + i * 5;
            svg.appendChild(svgEl('line', { x1: x, y1: 2, x2: x, y2: 18 }));
        }
        if (n === 5) svg.appendChild(svgEl('line', { x1: 1, y1: 18, x2: 21, y2: 2 }));
        return svg;
    }

    function buildTally(count) {
        const wrap = document.createElement('div');
        wrap.className = 'paper-tally';
        const groups = Math.floor(count / 5);
        const remainder = count % 5;
        for (let i = 0; i < groups; i++) wrap.appendChild(buildTallyGroup(5));
        if (remainder > 0) wrap.appendChild(buildTallyGroup(remainder));
        return wrap;
    }

    function buildCoffeeStain() {
        const svg = svgEl('svg', { viewBox: '0 0 40 40', class: 'paper-page__stain', 'aria-hidden': 'true' });
        svg.appendChild(svgEl('circle', { cx: 20, cy: 20, r: 16, fill: 'none', stroke: '#8A5A34', 'stroke-width': 2, opacity: 0.3 }));
        svg.appendChild(svgEl('circle', { cx: 20, cy: 20, r: 11, fill: 'none', stroke: '#8A5A34', 'stroke-width': 1.5, opacity: 0.28 }));
        return svg;
    }

    /** One notebook page: header date, coffee stain if that day earned
     *  one, each stored task line struck through, and (today only,
     *  everywhere the page shows) the streak tally. `compact` drops the
     *  tally and shrinks the page for the smaller summary/collection
     *  slots. */
    function buildPage(dateISO, tasks, { compact, showTally } = {}) {
        const page = document.createElement('div');
        page.className = 'paper-page' + (compact ? ' paper-page--compact' : '') + ' paper-page--wear-' + wearLevelForDate(dateISO);

        if (minutesFor(dateISO) >= COFFEE_STAIN_MINUTES) page.appendChild(buildCoffeeStain());

        const doodles = State.get().paperNotebook.unlockedDoodles;
        if (doodles.length) {
            const corner = document.createElement('div');
            corner.className = 'paper-page__doodle';
            corner.appendChild(buildDoodleSvg(doodles[doodles.length - 1], false));
            page.appendChild(corner);
        }

        const header = document.createElement('p');
        header.className = 'paper-page__date';
        header.textContent = I18n.formatDate(U.parseISODate(dateISO), { month: 'short', day: 'numeric' });
        page.appendChild(header);

        if (tasks.length) {
            tasks.forEach((title) => {
                const line = document.createElement('p');
                line.className = 'paper-page__line';
                line.textContent = title;
                page.appendChild(line);
            });
        } else {
            const empty = document.createElement('p');
            empty.className = 'paper-page__empty';
            empty.textContent = I18n.t('paperNotebook.noTasksToday');
            page.appendChild(empty);
        }

        if (showTally) {
            const streak = State.get().streak.current || 0;
            if (streak > 0) page.appendChild(buildTally(streak));
        }

        return page;
    }

    // ---------------------------------------------------------------- Gimmick hooks

    function onTaskComplete(task) {
        const dateISO = (task && task.dateISO) || todayISO();
        const title = (task && task.title) || I18n.t('paperNotebook.taskFallback');
        const state = State.get().paperNotebook;
        const pruned = pruneOldPages(state.pages);
        const existing = pruned[dateISO] || [];
        const updated = existing.length >= MAX_TASKS_PER_PAGE ? existing : [...existing, title];
        State.commit({ paperNotebook: { pages: { ...pruned, [dateISO]: updated } } });
    }

    function onSessionComplete() {
        checkDoodleUnlocks();
    }

    function renderFocusScene(container) {
        if (!container) return;
        const pages = State.get().paperNotebook.pages;
        container.appendChild(buildPage(todayISO(), pages[todayISO()] || [], { showTally: true }));
    }

    function renderSummary(container) {
        if (!container) return;
        const pages = State.get().paperNotebook.pages;
        container.appendChild(buildPage(todayISO(), pages[todayISO()] || [], { compact: true, showTally: true }));
    }

    function renderCollection(container) {
        if (!container) return;

        const doodleSection = document.createElement('div');
        doodleSection.className = 'paper-collection__section';
        const doodleTitle = document.createElement('p');
        doodleTitle.className = 'settings-section__title';
        doodleTitle.textContent = I18n.t('paperNotebook.doodlesSection');
        doodleSection.appendChild(doodleTitle);
        const grid = document.createElement('div');
        grid.className = 'paper-collection__doodle-grid';
        const unlocked = State.get().paperNotebook.unlockedDoodles;
        DOODLES.forEach((d) => {
            const cell = document.createElement('div');
            cell.className = 'paper-collection__doodle';
            cell.appendChild(buildDoodleSvg(d.id, !unlocked.includes(d.id)));
            grid.appendChild(cell);
        });
        doodleSection.appendChild(grid);
        container.appendChild(doodleSection);

        const pagesSection = document.createElement('div');
        pagesSection.className = 'paper-collection__section';
        const pagesTitle = document.createElement('p');
        pagesTitle.className = 'settings-section__title';
        pagesTitle.textContent = I18n.t('paperNotebook.pagesSection');
        pagesSection.appendChild(pagesTitle);

        const pages = State.get().paperNotebook.pages;
        const dates = Object.keys(pages).sort().reverse();
        if (!dates.length) {
            const empty = document.createElement('p');
            empty.className = 'text-outline';
            empty.style.fontSize = '0.8125rem';
            empty.textContent = I18n.t('paperNotebook.pagesEmpty');
            pagesSection.appendChild(empty);
        } else {
            dates.forEach((dateISO) => pagesSection.appendChild(buildPage(dateISO, pages[dateISO], { compact: true })));
        }
        container.appendChild(pagesSection);
    }

    TFS.Themes && TFS.Themes.registerGimmick('paper', {
        onSessionStart() {}, onSessionComplete, onTaskComplete, onDayRollover() {}, onWeekRollover() {},
        renderFocusScene, renderSummary, renderCollection
    });

})(window);
