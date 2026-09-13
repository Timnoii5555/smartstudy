/**
 * js/gimmicks/mint.js
 * The Mint theme's gimmick: a potted plant per subject, growing through 6
 * stages by completed focus rounds, one of 10 species chosen deterministic-
 * ally per subject (a hash of the subject id — its display name can change
 * with the language switch, but the id never does, so hashing that instead
 * of the name is what actually keeps "the same subject always gets the
 * same plant" true across a language toggle). Wilts (never dies) after 7
 * days unstudied, drops leaves after 14, recovers in one session — see
 * FUTURE_IDEAS.md-style reasoning inline below for why nothing here is a
 * stored flag.
 *
 * State lives in state.mintGarden.plantsBySubject (js/storage.js) — a
 * dedicated namespace per the phase's "every theme always collects, even
 * unused" rule, entirely separate from js/garden.js's own lifetime-hours
 * dashboard tree (a different, older, intentionally-non-wilting feature
 * that predates this phase and isn't part of it).
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};
    const U = TFS.Utils;
    const I18n = TFS.I18n;
    const State = TFS.State;
    const SVG_NS = 'http://www.w3.org/2000/svg';

    const STAGE_THRESHOLDS = [0, 2, 5, 10, 18, 30]; // rounds needed to REACH stage index (0-5)
    const WILT_AFTER_DAYS = 7;
    const LEAF_DROP_AFTER_DAYS = 14;

    // 10 species — leafShape picks which primitive-drawing helper below
    // renders its foliage; flower (if set) is drawn only at the final
    // stage. Colors are literal because a plant reads as itself regardless
    // of which of the 4 color themes happens to be active, same reasoning
    // js/focus.js's boarding pass already documented for its own fixed
    // dark card.
    const SPECIES = [
        { id: 'monstera', leafShape: 'oval', leaf: '#2F6B45', trunk: '#5B7A4A', flower: null },
        { id: 'cactus', leafShape: 'spike', leaf: '#4F9B7E', trunk: '#3F7A57', flower: '#F4E8C1' },
        { id: 'fern', leafShape: 'blade', leaf: '#3E8B4E', trunk: '#6B8A5A', flower: null },
        { id: 'bonsai', leafShape: 'round', leaf: '#5A8F5E', trunk: '#7A5A3A', flower: null },
        { id: 'sunflower', leafShape: 'oval', leaf: '#4F9B5E', trunk: '#6B8A4A', flower: '#E8B93D' },
        { id: 'lavender', leafShape: 'blade', leaf: '#7A8F6E', trunk: '#6B7A5A', flower: '#9B7EC9' },
        { id: 'bamboo', leafShape: 'blade', leaf: '#6BAF6E', trunk: '#8FBF6E', flower: null, segmented: true },
        { id: 'rose', leafShape: 'oval', leaf: '#3E7B4E', trunk: '#5A7A4A', flower: '#C94F5A' },
        { id: 'strawberry', leafShape: 'round', leaf: '#4E9B5A', trunk: '#6B8A5A', flower: '#D94F4A' },
        { id: 'aloe', leafShape: 'spike', leaf: '#6BAF8E', trunk: '#5A8F6E', flower: null }
    ];

    const SPECIES_NAMES = {
        monstera: { th: 'มอนสเตอรา', en: 'Monstera' },
        cactus: { th: 'กระบองเพชร', en: 'Cactus' },
        fern: { th: 'เฟิร์น', en: 'Fern' },
        bonsai: { th: 'บอนไซ', en: 'Bonsai' },
        sunflower: { th: 'ทานตะวัน', en: 'Sunflower' },
        lavender: { th: 'ลาเวนเดอร์', en: 'Lavender' },
        bamboo: { th: 'ไผ่', en: 'Bamboo' },
        rose: { th: 'กุหลาบ', en: 'Rose' },
        strawberry: { th: 'สตรอว์เบอร์รี', en: 'Strawberry' },
        aloe: { th: 'ว่านหางจระเข้', en: 'Aloe vera' }
    };

    /** A tiny, stable string hash (djb2) — deterministic across reloads and
     *  languages since it only ever hashes the subject id. */
    function hashString(s) {
        let h = 5381;
        for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
        return Math.abs(h);
    }

    function speciesForSubject(subjectId) {
        return SPECIES[hashString(String(subjectId)) % SPECIES.length];
    }

    function stageFor(rounds) {
        let stage = 0;
        for (let i = STAGE_THRESHOLDS.length - 1; i >= 0; i--) {
            if (rounds >= STAGE_THRESHOLDS[i]) { stage = i; break; }
        }
        return stage;
    }

    /** 0 = healthy, 1 = wilted (leaves droop, 25% paler), 2 = leaves
     *  dropped (partially) — computed fresh every render from the plain
     *  last-studied date rather than stored, so it can never go stale and
     *  a missed check-in can never leave a plant wilted forever by
     *  mistake. */
    function wiltLevelFor(lastStudiedISO) {
        if (!lastStudiedISO) return 0;
        const days = Math.floor((Date.now() - U.parseISODate(lastStudiedISO).getTime()) / 86400000);
        if (days >= LEAF_DROP_AFTER_DAYS) return 2;
        if (days >= WILT_AFTER_DAYS) return 1;
        return 0;
    }

    function svgEl(tag, attrs) {
        const el = document.createElementNS(SVG_NS, tag);
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        return el;
    }

    /** Builds one static plant illustration (no in-place growth animation
     *  like js/garden.js's tree — a plant here changes rarely enough,
     *  session to session, that a plain 600ms cross-fade between two
     *  static renders reads just as well as continuous morphing and is
     *  far simpler to keep correct across 10 species x 6 stages). */
    function buildPlantSvg(species, stage, wiltLevel) {
        const svg = svgEl('svg', { viewBox: '-60 -100 120 120', width: '100%', height: '100%', 'aria-hidden': 'true' });
        const potColor = 'var(--color-outline-variant)';
        svg.appendChild(svgEl('path', { d: 'M -22 8 L 22 8 L 17 32 L -17 32 Z', fill: potColor }));
        svg.appendChild(svgEl('ellipse', { cx: 0, cy: 8, rx: 22, ry: 5, fill: potColor, opacity: 0.85 }));

        if (stage === 0) {
            // A bare seed mound — no foliage yet.
            svg.appendChild(svgEl('ellipse', { cx: 0, cy: 4, rx: 6, ry: 3, fill: '#7A5A3A' }));
            return svg;
        }

        const droop = wiltLevel > 0 ? 14 : 0; // leaves angle down when wilted
        const paleOpacity = wiltLevel > 0 ? 0.6 : 1;
        const leafCount = Math.min(2 + stage * 2, 12);
        const height = 14 + stage * 12;
        const leafColor = species.leaf;
        const trunkColor = species.trunk;

        // Trunk/stem — segmented rings for bamboo, a plain tapered stalk otherwise.
        if (species.segmented && stage >= 2) {
            for (let s = 0; s < Math.min(stage, 4); s++) {
                const y0 = 6 - (height * (s + 1)) / 4;
                svg.appendChild(svgEl('rect', { x: -3, y: y0, width: 6, height: height / 4 + 2, rx: 2, fill: trunkColor }));
                svg.appendChild(svgEl('rect', { x: -4, y: y0, width: 8, height: 2, rx: 1, fill: 'var(--color-outline)', opacity: 0.35 }));
            }
        } else if (stage >= 2) {
            svg.appendChild(svgEl('path', {
                d: `M -3 6 Q ${stage >= 4 ? 6 : 0} ${6 - height * 0.5} 0 ${6 - height}`,
                stroke: trunkColor, 'stroke-width': 3 + stage * 0.4, fill: 'none', 'stroke-linecap': 'round'
            }));
        }

        // Leaves, fanned evenly around the top third of the stem/trunk,
        // dropped one at a time (from the bottom) once wiltLevel is 2.
        const dropped = wiltLevel === 2 ? Math.ceil(leafCount * 0.4) : 0;
        for (let i = 0; i < leafCount; i++) {
            const isDropped = i < dropped;
            const angle = (i / leafCount) * 360 + hashString(species.id + i) % 20;
            const rad = (angle * Math.PI) / 180;
            const spread = 8 + stage * 3;
            const baseY = isDropped ? 30 : 6 - height * (0.35 + (i % 3) * 0.12);
            const cx = Math.cos(rad) * spread * (isDropped ? 1.6 : 1);
            const cy = baseY + Math.sin(rad) * 3 + (isDropped ? 0 : droop * 0.3);
            const size = (5 + stage * 1.6) * (isDropped ? 0.7 : 1);
            const opacity = (isDropped ? 0.5 : 1) * paleOpacity;
            svg.appendChild(buildLeaf(species.leafShape, cx, cy, size, leafColor, opacity, isDropped));
        }

        // Flower only at the final stage, and only for species that have one.
        if (stage >= 5 && species.flower) {
            const fy = 6 - height - 4;
            if (species.id === 'sunflower') {
                svg.appendChild(svgEl('circle', { cx: 0, cy: fy, r: 10, fill: species.flower }));
                svg.appendChild(svgEl('circle', { cx: 0, cy: fy, r: 4, fill: '#7A5A2A' }));
            } else if (species.id === 'cactus') {
                svg.appendChild(svgEl('circle', { cx: 0, cy: fy, r: 4, fill: species.flower }));
            } else if (species.id === 'strawberry') {
                svg.appendChild(svgEl('circle', { cx: -6, cy: fy + 4, r: 3, fill: species.flower }));
                svg.appendChild(svgEl('circle', { cx: 6, cy: fy + 2, r: 3, fill: species.flower }));
            } else if (species.id === 'lavender') {
                [-8, 0, 8].forEach((dx) => svg.appendChild(svgEl('ellipse', { cx: dx, cy: fy + Math.abs(dx) * 0.3, rx: 3, ry: 7, fill: species.flower })));
            } else {
                svg.appendChild(svgEl('circle', { cx: 0, cy: fy, r: 6, fill: species.flower }));
            }
        }

        return svg;
    }

    function buildLeaf(shape, cx, cy, size, color, opacity, isDropped) {
        const rot = isDropped ? 90 : 0;
        let el;
        if (shape === 'round') {
            el = svgEl('circle', { cx, cy, r: size, fill: color });
        } else if (shape === 'spike') {
            el = svgEl('path', { d: `M ${cx} ${cy + size} L ${cx - size * 0.35} ${cy - size} L ${cx + size * 0.35} ${cy - size} Z`, fill: color, transform: `rotate(${rot} ${cx} ${cy})` });
        } else if (shape === 'blade') {
            el = svgEl('path', { d: `M ${cx} ${cy + size} Q ${cx + size * 0.6} ${cy} ${cx} ${cy - size} Q ${cx - size * 0.6} ${cy} ${cx} ${cy + size} Z`, fill: color, transform: `rotate(${rot} ${cx} ${cy})` });
        } else {
            el = svgEl('ellipse', { cx, cy, rx: size * 0.7, ry: size, fill: color, transform: `rotate(${rot} ${cx} ${cy})` });
        }
        el.setAttribute('opacity', opacity);
        return el;
    }

    function stageLabelKey(stage) {
        return ['mintGarden.stageSeed', 'mintGarden.stageSprout', 'mintGarden.stageStem', 'mintGarden.stageBranching', 'mintGarden.stageFull', 'mintGarden.stageBloom'][stage];
    }

    /** The subject actually being studied this session, if any — screen6's
     *  scene falls back to the overall daily total (no single subject) so
     *  it's never simply blank before onboarding assigns one. */
    function currentSubjectId() {
        return State.get().plan.subject || null;
    }

    function plantData(subjectId) {
        return State.get().mintGarden.plantsBySubject[subjectId] || { rounds: 0, lastStudiedISO: null };
    }

    // ---------------------------------------------------------------- Gimmick hooks

    function onSessionComplete(session) {
        const subjectId = session && session.subject;
        if (!subjectId) return; // no subject chosen yet — nothing to grow
        const garden = State.get().mintGarden.plantsBySubject;
        const existing = garden[subjectId] || { rounds: 0, lastStudiedISO: null };
        const updated = { ...garden, [subjectId]: { rounds: existing.rounds + 1, lastStudiedISO: session.dateISO || U.formatDateISO(new Date()) } };
        State.commit({ mintGarden: { plantsBySubject: updated } });
    }

    function renderFocusScene(container) {
        if (!container) return;
        container.innerHTML = '';
        const subjectId = currentSubjectId();
        const wrap = document.createElement('div');
        wrap.className = 'mint-scene';
        if (!subjectId) {
            wrap.appendChild(Object.assign(document.createElement('p'), { className: 'mint-scene__empty', textContent: I18n.t('mintGarden.noSubject') }));
            container.appendChild(wrap);
            return;
        }
        const species = speciesForSubject(subjectId);
        const data = plantData(subjectId);
        const stage = stageFor(data.rounds);
        const wilt = wiltLevelFor(data.lastStudiedISO);

        const svgWrap = document.createElement('div');
        svgWrap.className = 'mint-scene__svg-wrap';
        svgWrap.appendChild(buildPlantSvg(species, stage, wilt));
        wrap.appendChild(svgWrap);

        const label = document.createElement('p');
        label.className = 'mint-scene__label';
        label.textContent = I18n.t(stageLabelKey(stage));
        wrap.appendChild(label);

        container.appendChild(wrap);
    }

    function renderCollection(container) {
        if (!container) return;
        container.innerHTML = '';
        const state = State.get();
        const growingId = state.plan.subject;
        const completedIds = state.plan.completedSubjects || [];
        const subjects = (TFS.Data && TFS.Data.getSubjects) ? TFS.Data.getSubjects() : [];
        const subjectName = (id) => {
            const found = subjects.find((s) => s.id === id);
            return found ? I18n.pick(found.name) : id;
        };

        const section = (titleKey, ids, isShelf) => {
            const box = document.createElement('div');
            box.className = 'mint-collection__section';
            const title = document.createElement('p');
            title.className = 'settings-section__title';
            title.textContent = I18n.t(titleKey);
            box.appendChild(title);
            if (!ids.length) {
                const empty = document.createElement('p');
                empty.className = 'text-outline';
                empty.style.fontSize = '0.8125rem';
                empty.textContent = I18n.t('mintGarden.collectionEmpty');
                box.appendChild(empty);
            } else {
                const grid = document.createElement('div');
                grid.className = 'mint-collection__grid';
                ids.forEach((id) => {
                    const data = plantData(id);
                    const species = speciesForSubject(id);
                    const stage = isShelf ? 5 : stageFor(data.rounds); // a finished subject's plant is kept at full bloom on the shelf
                    const card = document.createElement('div');
                    card.className = 'mint-collection__card';
                    const svgWrap = document.createElement('div');
                    svgWrap.className = 'mint-scene__svg-wrap';
                    svgWrap.appendChild(buildPlantSvg(species, stage, 0));
                    card.appendChild(svgWrap);
                    const name = document.createElement('p');
                    name.className = 'mint-collection__name';
                    name.textContent = subjectName(id);
                    card.appendChild(name);
                    const meta = document.createElement('p');
                    meta.className = 'mint-collection__meta';
                    meta.textContent = I18n.pick(SPECIES_NAMES[species.id]);
                    card.appendChild(meta);
                    grid.appendChild(card);
                });
                box.appendChild(grid);
            }
            container.appendChild(box);
        };

        section('mintGarden.growingSection', growingId ? [growingId] : [], false);
        section('mintGarden.shelfSection', completedIds, true);
    }

    TFS.Themes && TFS.Themes.registerGimmick('mint', {
        onSessionStart() {}, onSessionComplete, onTaskComplete() {}, onDayRollover() {}, onWeekRollover() {},
        renderFocusScene, renderCollection
    });

})(window);
