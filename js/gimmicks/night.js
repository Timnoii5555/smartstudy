/**
 * js/gimmicks/night.js
 * The Night theme's gimmick: one star per completed focus round, sized by
 * how long that round was, at a fixed (not random) position from a
 * deterministic 60-point layout so the sky always fills in the same way
 * for the same star count. At the end of a week the stars on screen
 * connect into a named constellation (52 fixed names, data/
 * constellationNames.js, assigned by week-of-year so the same week of any
 * year gets the same name) and move to the "Past Skies" collection; a week
 * with fewer than 3 stars just keeps its stars without ever forming one —
 * no message either way, per the brief.
 *
 * The real moon phase (from the actual date, 8 phases, decorative only)
 * also shows here. Not yet built for this theme (see this session's
 * report): the progressive screen-dim-while-focusing effect and shooting
 * stars — both real, separate pieces of work from the star/constellation
 * mechanic this file covers.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};
    const U = TFS.Utils;
    const I18n = TFS.I18n;
    const State = TFS.State;
    const SVG_NS = 'http://www.w3.org/2000/svg';

    const MIN_STARS_FOR_CONSTELLATION = 3;

    /** 60 fixed positions (percent of the scene box), generated once from
     *  a simple deterministic spread rather than hand-placed — "fixed, not
     *  random" only requires that the same index always lands in the same
     *  spot, not that a person drew each one. */
    const STAR_POSITIONS = (function buildPositions() {
        const positions = [];
        const cols = 10, rows = 6;
        for (let i = 0; i < 60; i++) {
            const col = i % cols, row = Math.floor(i / cols);
            // A small deterministic jitter per index so the grid doesn't
            // look mechanically regular, without ever being random.
            const jitterX = ((i * 37) % 11) - 5;
            const jitterY = ((i * 53) % 9) - 4;
            positions.push({
                x: U.clamp((col + 0.5) * (100 / cols) + jitterX, 4, 96),
                y: U.clamp((row + 0.5) * (100 / rows) + jitterY, 4, 96)
            });
        }
        return positions;
    })();

    function weekKeyFor(date) {
        return U.formatDateISO(U.startOfWeekMonday(date));
    }

    function dayOfYear(date) {
        const start = new Date(date.getFullYear(), 0, 1);
        return Math.floor((date - start) / 86400000);
    }

    function constellationNameFor(weekKey) {
        const names = TFS.CONSTELLATION_NAMES || [{ th: 'ท้องฟ้า', en: 'Sky' }];
        const idx = Math.floor(dayOfYear(U.parseISODate(weekKey)) / 7) % names.length;
        return names[idx];
    }

    /** Real, actual moon phase for today — 0 new … 4 full … 7 waning
     *  crescent, from a standard synodic-month approximation. Decorative
     *  only, no explanation shown anywhere, per the brief. */
    function moonPhaseIndex(date) {
        const knownNewMoon = Date.UTC(2000, 0, 6);
        const synodicDays = 29.530588853;
        const days = (date.getTime() - knownNewMoon) / 86400000;
        const phase = ((days % synodicDays) + synodicDays) % synodicDays;
        return Math.round((phase / synodicDays) * 8) % 8;
    }

    function sizeForMinutes(minutes) {
        if (minutes >= 45) return { r: 2.6, opacity: 1 };
        if (minutes >= 25) return { r: 1.9, opacity: 0.9 };
        return { r: 1.3, opacity: 0.8 };
    }

    /** If the stars on hand belong to an earlier week than `now`, finalize
     *  them into a constellation (if there are enough) and clear the slate
     *  for the new week — checked before adding a star and before every
     *  render, so the transition happens the moment it's next relevant
     *  without needing a scheduled day/week-boundary job this static site
     *  has nowhere to run anyway. */
    function rolloverIfNeeded() {
        const sky = State.get().nightSky;
        const nowKey = weekKeyFor(new Date());
        if (sky.currentWeekKey === nowKey) return;
        const patch = { currentWeekKey: nowKey, stars: [] };
        if (sky.currentWeekKey && sky.stars.length >= MIN_STARS_FOR_CONSTELLATION) {
            const dates = sky.stars.map((s) => s.dateISO).sort();
            const entry = {
                weekKey: sky.currentWeekKey,
                name: constellationNameFor(sky.currentWeekKey),
                startISO: dates[0], endISO: dates[dates.length - 1],
                starCount: sky.stars.length,
                totalMinutes: sky.stars.reduce((a, s) => a + s.minutes, 0)
            };
            patch.weeklyLog = [...sky.weeklyLog, entry];
        }
        // A week with too few stars just carries no constellation forward
        // — its stars are dropped along with the rest of the old week's
        // slate, silently, no message either way (per the brief).
        State.commit({ nightSky: patch });
    }

    function svgEl(tag, attrs) {
        const el = document.createElementNS(SVG_NS, tag);
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        return el;
    }

    function buildMoonSvg(phaseIdx) {
        const r = 9;
        const svg = svgEl('svg', { viewBox: '-11 -11 22 22', width: '2.25rem', height: '2.25rem', 'aria-hidden': 'true' });
        svg.appendChild(svgEl('circle', { cx: 0, cy: 0, r, fill: '#3A3E45' }));
        const t = phaseIdx / 8;
        const k = (1 - Math.cos(2 * Math.PI * t)) / 2; // 0 new .. 1 full
        if (k > 0.03) {
            const waxing = t < 0.5;
            const offset = r * 2 * (1 - k) * (waxing ? 1 : -1);
            const clipId = 'moonclip' + Math.random().toString(36).slice(2, 9);
            const defs = document.createElementNS(SVG_NS, 'defs');
            const clip = document.createElementNS(SVG_NS, 'clipPath');
            clip.setAttribute('id', clipId);
            clip.appendChild(svgEl('circle', { cx: 0, cy: 0, r }));
            defs.appendChild(clip);
            svg.appendChild(defs);
            svg.appendChild(svgEl('circle', { cx: offset, cy: 0, r, fill: '#EDEAE0', 'clip-path': `url(#${clipId})` }));
        }
        return svg;
    }

    function buildSkySvg(stars, { forConstellation } = {}) {
        const svg = svgEl('svg', { viewBox: '0 0 100 60', width: '100%', height: '100%', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
        svg.appendChild(svgEl('rect', { x: 0, y: 0, width: 100, height: 60, fill: 'var(--color-surface-lowest)' }));

        const points = stars.map((s, i) => STAR_POSITIONS[i % STAR_POSITIONS.length]);
        if (forConstellation && points.length >= 2) {
            const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * 0.6 + 20} ${p.y * 0.36 + 6}`).join(' ');
            svg.appendChild(svgEl('path', { d, stroke: 'var(--color-primary)', 'stroke-width': 0.3, opacity: 0.4, fill: 'none' }));
        }
        stars.forEach((star, i) => {
            const p = points[i];
            const sz = sizeForMinutes(star.minutes);
            const isToday = star.dateISO === U.formatDateISO(new Date());
            svg.appendChild(svgEl('circle', {
                cx: forConstellation ? p.x * 0.6 + 20 : p.x, cy: forConstellation ? p.y * 0.36 + 6 : p.y * 0.6,
                r: sz.r, fill: '#F4EFD8', opacity: isToday ? Math.min(1, sz.opacity + 0.15) : sz.opacity
            }));
        });

        return svg;
    }

    // ---------------------------------------------------------------- Gimmick hooks

    function onSessionComplete(session) {
        rolloverIfNeeded();
        const minutes = (session && session.minutes) || 0;
        if (minutes < 1) return;
        const sky = State.get().nightSky;
        const star = { dateISO: (session && session.dateISO) || U.formatDateISO(new Date()), minutes };
        State.commit({ nightSky: { stars: [...sky.stars, star], currentWeekKey: sky.currentWeekKey || weekKeyFor(new Date()) } });
    }

    function renderFocusScene(container) {
        if (!container) return;
        rolloverIfNeeded();
        const sky = State.get().nightSky;
        const wrap = document.createElement('div');
        wrap.className = 'night-scene';
        const svgWrap = document.createElement('div');
        svgWrap.className = 'night-scene__sky';
        svgWrap.appendChild(buildSkySvg(sky.stars));
        wrap.appendChild(svgWrap);
        const moonWrap = document.createElement('div');
        moonWrap.className = 'night-scene__moon';
        moonWrap.appendChild(buildMoonSvg(moonPhaseIndex(new Date())));
        wrap.appendChild(moonWrap);
        const label = document.createElement('p');
        label.className = 'night-scene__label';
        label.textContent = I18n.t('nightSky.starsThisWeek', { n: sky.stars.length });
        wrap.appendChild(label);
        container.appendChild(wrap);
    }

    function renderCollection(container) {
        if (!container) return;
        rolloverIfNeeded();
        const log = State.get().nightSky.weeklyLog;
        if (!log.length) {
            const empty = document.createElement('p');
            empty.className = 'text-outline';
            empty.style.fontSize = '0.8125rem';
            empty.textContent = I18n.t('nightSky.collectionEmpty');
            container.appendChild(empty);
            return;
        }
        [...log].reverse().forEach((entry) => {
            const card = document.createElement('div');
            card.className = 'night-collection__card';
            const svgWrap = document.createElement('div');
            svgWrap.className = 'night-collection__svg-wrap';
            svgWrap.appendChild(buildSkySvg(
                Array.from({ length: entry.starCount }, () => ({ dateISO: entry.startISO, minutes: 25 })),
                { forConstellation: true }
            ));
            card.appendChild(svgWrap);
            const info = document.createElement('div');
            info.className = 'night-collection__info';
            const name = document.createElement('p');
            name.className = 'night-collection__name';
            name.textContent = I18n.pick(entry.name);
            info.appendChild(name);
            const meta = document.createElement('p');
            meta.className = 'night-collection__meta';
            meta.textContent = `${I18n.formatDate(U.parseISODate(entry.startISO))} – ${I18n.formatDate(U.parseISODate(entry.endISO))} · ${I18n.t('nightSky.starCount', { n: entry.starCount })} · ${U.formatSecondsToHHMM(entry.totalMinutes * 60)}`;
            info.appendChild(meta);
            card.appendChild(info);
            container.appendChild(card);
        });
    }

    TFS.Themes && TFS.Themes.registerGimmick('night', {
        onSessionStart() {}, onSessionComplete, onTaskComplete() {}, onDayRollover() { rolloverIfNeeded(); }, onWeekRollover() { rolloverIfNeeded(); },
        renderFocusScene, renderCollection
    });

})(window);
