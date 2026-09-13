/**
 * js/gimmicks/pixel.js
 * The Pixel theme's gimmick: a small blocky hillside scene — sky, two
 * mountain layers, a terraced hill layer, unlocked foreground scenery and
 * a ground strip — with a chosen character (6 palettes) and an optional
 * pet (5 kinds) standing on it. Every shape is built from plain <rect>
 * (plus a couple of two-rect fins/ears) rather than curves, matching the
 * theme's own zero-radius, blocky visual identity (styles/tokens.css sets
 * every --radius-* to 0 only for this theme).
 *
 * Two things react to the real day rather than being fixed: the sky's
 * color band follows *today's* cumulative real focus minutes (not the
 * wall clock — dawn/day/dusk/night is a proxy for "how far into today's
 * studying you are", the same "the world reflects effort, not the clock"
 * idea Mint and Night both use), and the weather is picked deterministically
 * from the real date (month -> a rough 3-season cycle -> a stable
 * same-all-day pick within that season's set) — decorative only, exactly
 * like Night's moon phase, never stored.
 *
 * Scenery unlocks at lifetime-focus-hour milestones, the same pattern as
 * Paper's doodles and stored the same way (kept forever once earned).
 * The character and pet are not gated — pickable from the very first
 * launch, only the backdrop items are a collectible.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};
    const U = TFS.Utils;
    const I18n = TFS.I18n;
    const State = TFS.State;
    const SVG_NS = 'http://www.w3.org/2000/svg';

    const CHARACTERS = [
        { id: 'char1', skin: '#E8B98C', hair: '#4A2E1E', shirt: '#5B8C5A' },
        { id: 'char2', skin: '#C68A5B', hair: '#1E1E1E', shirt: '#5A7FA8' },
        { id: 'char3', skin: '#F2D2A9', hair: '#D9A441', shirt: '#B5623C' },
        { id: 'char4', skin: '#8C5A3C', hair: '#2E1E14', shirt: '#8A6BAE' },
        { id: 'char5', skin: '#F2E0C8', hair: '#E8C4A0', shirt: '#D98E5F' },
        { id: 'char6', skin: '#A8703C', hair: '#6E4A2E', shirt: '#4A6E8A' }
    ];
    const PANTS_COLOR = '#3B3B3B';
    const SHOE_COLOR = '#241C14';

    const PETS = [
        { id: 'pet-cat', kind: 'cat', fur: '#D9A441' },
        { id: 'pet-dog', kind: 'dog', fur: '#8A6BAE' },
        { id: 'pet-bird', kind: 'bird', fur: '#5A8CBE' },
        { id: 'pet-rabbit', kind: 'rabbit', fur: '#E8C4A0' },
        { id: 'pet-fish', kind: 'fish', fur: '#5AAE9E' }
    ];

    // Lifetime-focus-hours milestones, easiest first.
    const SCENERY = [
        { id: 'tree', hours: 1 }, { id: 'rock', hours: 3 }, { id: 'flowers', hours: 6 },
        { id: 'fence', hours: 10 }, { id: 'windmill', hours: 18 }, { id: 'pond', hours: 28 },
        { id: 'lantern', hours: 40 }, { id: 'bench', hours: 55 }
    ];
    // Fixed ground x-slots (in the scene's own 0-300 viewBox), one per
    // scenery id above, spread out so unlocked items never overlap.
    const SCENERY_SLOTS = [30, 60, 255, 15, 95, 190, 275, 225];

    const SKY_COLORS = {
        dawn: ['#F2C6A0', '#F2A0A0'], day: ['#8FCBEA', '#C9E8F5'],
        dusk: ['#8A6BAE', '#D9895F'], night: ['#0F1A2B', '#1E2E44']
    };
    const WEATHER_SETS = {
        cool: ['clear', 'clear', 'cloudy'],
        hot: ['clear', 'clear', 'clear', 'cloudy'],
        rainy: ['rain', 'cloudy', 'clear']
    };

    function svgEl(tag, attrs) {
        const el = document.createElementNS(SVG_NS, tag);
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        return el;
    }
    function rect(x, y, w, h, fill) { return svgEl('rect', { x, y, width: w, height: h, fill }); }
    function group(children) {
        const g = svgEl('g', {});
        children.forEach((c) => g.appendChild(c));
        return g;
    }

    function hashString(str) {
        let h = 5381;
        for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
        return h;
    }

    function todayISO() { return U.formatDateISO(new Date()); }

    function lifetimeHours() {
        const totals = State.get().focus.totalSecondsByDate;
        return Object.values(totals).reduce((a, b) => a + b, 0) / 3600;
    }
    function todayMinutes() {
        const totals = State.get().focus.totalSecondsByDate;
        return Math.round((totals[todayISO()] || 0) / 60);
    }

    function timeBand(minutes) {
        if (minutes >= 120) return 'night';
        if (minutes >= 60) return 'dusk';
        if (minutes >= 25) return 'day';
        return 'dawn';
    }

    function seasonForMonth(month) {
        if (month === 11 || month <= 1) return 'cool';
        if (month >= 2 && month <= 4) return 'hot';
        return 'rainy';
    }

    function weatherForDate(date) {
        const set = WEATHER_SETS[seasonForMonth(date.getMonth())];
        return set[hashString(U.formatDateISO(date)) % set.length];
    }

    function currentCharacter() {
        const id = State.get().pixelMeadow.characterId;
        return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
    }
    function currentPet() {
        const id = State.get().pixelMeadow.petId;
        return PETS.find((p) => p.id === id) || null;
    }

    function checkSceneryUnlocks() {
        const hours = lifetimeHours();
        const unlocked = State.get().pixelMeadow.unlockedScenery;
        const earned = SCENERY.filter((s) => hours >= s.hours && !unlocked.includes(s.id)).map((s) => s.id);
        if (earned.length) State.commit({ pixelMeadow: { unlockedScenery: [...unlocked, ...earned] } });
    }

    // ---------------------------------------------------------------- Sprite builders (local coordinates)

    /** A simple blocky standing figure, 14 wide x 20 tall. */
    function buildCharacterGroup(palette) {
        return group([
            rect(2, 0, 8, 2, palette.hair),
            rect(3, 1, 6, 5, palette.skin),
            rect(2, 6, 10, 7, palette.shirt),
            rect(0, 6, 2, 6, palette.skin),
            rect(12, 6, 2, 6, palette.skin),
            rect(2, 13, 4, 5, PANTS_COLOR),
            rect(8, 13, 4, 5, PANTS_COLOR),
            rect(2, 18, 4, 2, SHOE_COLOR),
            rect(8, 18, 4, 2, SHOE_COLOR)
        ]);
    }

    /** A blocky critter, 16 wide x 12 tall, one shared body+head block with
     *  per-kind ears/tail/legs so the 5 stay easy to tell apart despite
     *  the shared base. */
    function buildPetGroup(pet) {
        const fur = pet.fur;
        const body = rect(2, 6, 9, 4, fur);
        const head = rect(9, 2, 5, 5, fur);
        const parts = [];
        switch (pet.kind) {
            case 'cat':
                parts.push(rect(9, 1, 1.5, 1.5, fur), rect(12.5, 1, 1.5, 1.5, fur), body, head,
                    rect(0, 5, 2, 1.5, fur), rect(3, 10, 2, 2, fur), rect(8, 10, 2, 2, fur));
                break;
            case 'dog':
                parts.push(body, head, rect(13, 3, 2, 3, fur),
                    rect(0, 4.5, 2, 2, fur), rect(3, 10, 2, 2, fur), rect(8, 10, 2, 2, fur));
                break;
            case 'bird':
                parts.push(body, head, rect(4, 7, 4, 2, fur), rect(13.5, 4, 1.5, 1, '#E8A23C'),
                    rect(6, 10, 1, 2, fur));
                break;
            case 'rabbit':
                parts.push(rect(9.5, 0, 1.5, 3, fur), rect(12, 0, 1.5, 3, fur), body, head,
                    rect(0, 6, 1.5, 1.5, fur), rect(3, 10, 2, 2, fur), rect(8, 10, 2, 2, fur));
                break;
            case 'fish':
                parts.push(rect(2, 4, 9, 4, fur), rect(11, 3, 2, 2, fur), rect(11, 7, 2, 2, fur), rect(6, 2, 3, 2, fur));
                break;
            default:
                parts.push(body, head);
        }
        return group(parts);
    }

    /** Each entry returns a <g> already positioned with its own bottom
     *  edge at local y=0 (so placeScenery() only has to translate it to
     *  the ground line, no per-item vertical fudging). */
    const SCENERY_BUILDERS = {
        tree: () => group([rect(-1.5, -8, 3, 8, '#6E4A2E'), rect(-7, -22, 14, 16, '#5B8C5A')]),
        rock: () => group([rect(-6, -6, 12, 6, '#8A8A82'), rect(-4, -8, 8, 3, '#9C9C92')]),
        flowers: () => group([
            rect(-8, -3, 4, 3, '#5B8C5A'), rect(-2, -3, 4, 3, '#5B8C5A'), rect(4, -3, 4, 3, '#5B8C5A'),
            rect(-7, -5, 2, 2, '#D9895F'), rect(-1, -5, 2, 2, '#D98E5F'), rect(5, -5, 2, 2, '#B5623C')
        ]),
        fence: () => group([
            rect(-10, -6, 1.5, 6, '#8A6748'), rect(-3, -6, 1.5, 6, '#8A6748'), rect(4, -6, 1.5, 6, '#8A6748'),
            rect(-10, -5, 15.5, 1.5, '#8A6748'), rect(-10, -2, 15.5, 1.5, '#8A6748')
        ]),
        windmill: () => group([
            rect(-1, -20, 2, 20, '#D9C9A8'),
            rect(-8, -22, 6, 2, '#F2E6C8'), rect(2, -22, 6, 2, '#F2E6C8'),
            rect(-1, -29, 2, 6, '#F2E6C8'), rect(-1, -22, 2, 6, '#F2E6C8')
        ]),
        pond: () => group([rect(-14, -4, 28, 4, '#5A8CBE'), rect(-10, -6, 20, 2, '#6E9ECE')]),
        lantern: () => group([rect(-1, -18, 2, 18, '#3B3B3B'), rect(-3, -22, 6, 5, '#E8C24A')]),
        bench: () => group([
            rect(-8, -5, 1.5, 5, '#6E4A2E'), rect(6.5, -5, 1.5, 5, '#6E4A2E'),
            rect(-9, -7, 18, 2, '#8A6748')
        ])
    };

    function placeScenery(id, x, groundY) {
        const builder = SCENERY_BUILDERS[id];
        if (!builder) return null;
        const g = builder();
        g.setAttribute('transform', `translate(${x}, ${groundY})`);
        return g;
    }

    // ---------------------------------------------------------------- Weather overlays

    function buildWeatherOverlay(weather, timeIsNight) {
        const g = svgEl('g', { opacity: timeIsNight ? 0.7 : 0.85 });
        if (weather === 'rain') {
            for (let i = 0; i < 10; i++) {
                const x = 10 + (i * 29) % 290;
                const y = (i * 17) % 90;
                g.appendChild(svgEl('line', { x1: x, y1: y, x2: x - 5, y2: y + 10, stroke: '#7FA8D9', 'stroke-width': 1.5 }));
            }
        } else if (weather === 'cloudy') {
            [[40, 25], [150, 15], [240, 30]].forEach(([cx, cy]) => {
                g.appendChild(rect(cx - 12, cy - 4, 24, 8, '#E8ECEF'));
                g.appendChild(rect(cx - 6, cy - 8, 20, 6, '#E8ECEF'));
            });
        }
        return g;
    }

    // ---------------------------------------------------------------- The scene itself

    function buildSceneSvg() {
        const svg = svgEl('svg', { viewBox: '0 0 300 150', width: '100%', height: '100%', preserveAspectRatio: 'xMidYMax slice', 'aria-hidden': 'true' });
        const minutes = todayMinutes();
        const band = timeBand(minutes);
        const weather = weatherForDate(new Date());
        const isNight = band === 'night';
        const groundY = 118;

        const defs = document.createElementNS(SVG_NS, 'defs');
        const grad = svgEl('linearGradient', { id: 'pixelSky', x1: '0', y1: '0', x2: '0', y2: '1' });
        const colors = SKY_COLORS[band];
        grad.appendChild(svgEl('stop', { offset: '0%', 'stop-color': colors[0] }));
        grad.appendChild(svgEl('stop', { offset: '100%', 'stop-color': colors[1] }));
        defs.appendChild(grad);
        svg.appendChild(defs);

        svg.appendChild(rect(0, 0, 300, groundY, 'url(#pixelSky)'));

        if (isNight) {
            const starIdx = [20, 60, 100, 140, 180, 220, 260, 45, 165, 285];
            starIdx.forEach((x, i) => svg.appendChild(svgEl('circle', { cx: x, cy: 10 + (i * 13) % 70, r: 1, fill: '#F4EFD8', opacity: 0.8 })));
            if (weather === 'clear') svg.appendChild(svgEl('circle', { cx: 250, cy: 30, r: 12, fill: '#EDEAE0' }));
        } else if (weather === 'clear') {
            svg.appendChild(svgEl('circle', { cx: 250, cy: 30, r: 16, fill: '#F4E0A0' }));
        }

        // Back mountains (2 overlapping triangle-ish shapes via polygon).
        svg.appendChild(svgEl('polygon', { points: `0,${groundY} 60,55 130,${groundY}`, fill: isNight ? '#1E2A3E' : '#8FA898', opacity: 0.7 }));
        svg.appendChild(svgEl('polygon', { points: `120,${groundY} 200,40 280,${groundY}`, fill: isNight ? '#182238' : '#7C9686', opacity: 0.8 }));

        // Terraced hill layer — a jagged pixel silhouette made of stepped bars.
        const stepW = 30;
        for (let i = 0; i < 10; i++) {
            const h = 20 + ((i * 37) % 18);
            svg.appendChild(rect(i * stepW, groundY - h, stepW, h, isNight ? '#233A2E' : '#5B8C5A'));
        }

        // Unlocked scenery, on the ground, behind the character.
        const unlocked = State.get().pixelMeadow.unlockedScenery;
        SCENERY.forEach((item, i) => {
            if (unlocked.includes(item.id)) {
                const g = placeScenery(item.id, SCENERY_SLOTS[i], groundY);
                if (g) svg.appendChild(g);
            }
        });

        // Ground strip.
        svg.appendChild(rect(0, groundY, 300, 150 - groundY, isNight ? '#16241C' : '#4A7A4A'));

        // Character + pet, standing on the ground line.
        const charG = buildCharacterGroup(currentCharacter());
        charG.setAttribute('transform', 'translate(140, ' + (groundY - 20) + ')');
        svg.appendChild(charG);
        const pet = currentPet();
        if (pet) {
            const petG = buildPetGroup(pet);
            petG.setAttribute('transform', 'translate(160, ' + (groundY - 12) + ')');
            svg.appendChild(petG);
        }

        svg.appendChild(buildWeatherOverlay(weather, isNight));

        return svg;
    }

    // ---------------------------------------------------------------- Gimmick hooks

    function onSessionComplete() { checkSceneryUnlocks(); }

    function renderFocusScene(container) {
        if (!container) return;
        const wrap = document.createElement('div');
        wrap.className = 'pixel-scene';
        const svgWrap = document.createElement('div');
        svgWrap.className = 'pixel-scene__svg-wrap';
        svgWrap.appendChild(buildSceneSvg());
        wrap.appendChild(svgWrap);
        container.appendChild(wrap);
    }

    function renderSummary(container) {
        if (!container) return;
        const wrap = document.createElement('div');
        wrap.className = 'pixel-scene pixel-scene--compact';
        const svgWrap = document.createElement('div');
        svgWrap.className = 'pixel-scene__svg-wrap pixel-scene__svg-wrap--compact';
        svgWrap.appendChild(buildSceneSvg());
        wrap.appendChild(svgWrap);
        container.appendChild(wrap);
    }

    function renderCollection(container) {
        if (!container) return;

        const charSection = document.createElement('div');
        charSection.className = 'paper-collection__section';
        const charTitle = document.createElement('p');
        charTitle.className = 'settings-section__title';
        charTitle.textContent = I18n.t('pixelMeadow.characterSection');
        charSection.appendChild(charTitle);
        const charGrid = document.createElement('div');
        charGrid.className = 'pixel-picker-grid';
        const selectedCharId = State.get().pixelMeadow.characterId;
        CHARACTERS.forEach((c) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'pixel-picker-cell' + (c.id === selectedCharId ? ' is-selected' : '');
            const svg = svgEl('svg', { viewBox: '0 0 14 20' });
            svg.appendChild(buildCharacterGroup(c));
            btn.appendChild(svg);
            btn.addEventListener('click', () => {
                State.commit({ pixelMeadow: { characterId: c.id } });
                renderCollection(container);
            });
            charGrid.appendChild(btn);
        });
        charSection.appendChild(charGrid);
        container.appendChild(charSection);

        const petSection = document.createElement('div');
        petSection.className = 'paper-collection__section';
        const petTitle = document.createElement('p');
        petTitle.className = 'settings-section__title';
        petTitle.textContent = I18n.t('pixelMeadow.petSection');
        petSection.appendChild(petTitle);
        const petGrid = document.createElement('div');
        petGrid.className = 'pixel-picker-grid';
        const selectedPetId = State.get().pixelMeadow.petId;
        // A "none" option — a pet is optional, unlike the character.
        const noneBtn = document.createElement('button');
        noneBtn.type = 'button';
        noneBtn.className = 'pixel-picker-cell pixel-picker-cell--none' + (!selectedPetId ? ' is-selected' : '');
        noneBtn.textContent = '—';
        noneBtn.addEventListener('click', () => { State.commit({ pixelMeadow: { petId: null } }); renderCollection(container); });
        petGrid.appendChild(noneBtn);
        PETS.forEach((p) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'pixel-picker-cell' + (p.id === selectedPetId ? ' is-selected' : '');
            const svg = svgEl('svg', { viewBox: '0 0 16 12' });
            svg.appendChild(buildPetGroup(p));
            btn.appendChild(svg);
            btn.addEventListener('click', () => { State.commit({ pixelMeadow: { petId: p.id } }); renderCollection(container); });
            petGrid.appendChild(btn);
        });
        petSection.appendChild(petGrid);
        container.appendChild(petSection);

        const scenerySection = document.createElement('div');
        scenerySection.className = 'paper-collection__section';
        const sceneryTitle = document.createElement('p');
        sceneryTitle.className = 'settings-section__title';
        sceneryTitle.textContent = I18n.t('pixelMeadow.scenerySection');
        scenerySection.appendChild(sceneryTitle);
        const sceneryGrid = document.createElement('div');
        sceneryGrid.className = 'paper-collection__doodle-grid';
        const unlocked = State.get().pixelMeadow.unlockedScenery;
        SCENERY.forEach((item) => {
            const cell = document.createElement('div');
            cell.className = 'paper-collection__doodle';
            const isUnlocked = unlocked.includes(item.id);
            const svg = svgEl('svg', { viewBox: '-16 -32 32 32' });
            const g = placeScenery(item.id, 0, 0);
            if (g) {
                if (!isUnlocked) g.setAttribute('opacity', '0.25');
                svg.appendChild(g);
            }
            cell.appendChild(svg);
            sceneryGrid.appendChild(cell);
        });
        scenerySection.appendChild(sceneryGrid);
        container.appendChild(scenerySection);
    }

    TFS.Themes && TFS.Themes.registerGimmick('pixel', {
        onSessionStart() {}, onSessionComplete, onTaskComplete() {}, onDayRollover() {}, onWeekRollover() {},
        renderFocusScene, renderSummary, renderCollection
    });

})(window);
