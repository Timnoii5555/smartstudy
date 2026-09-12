/**
 * focus.js
 * Screen 6: a real Pomodoro engine (focus / short break / long break, cycling
 * automatically, durations configurable in Settings) plus a generated
 * ambient-noise player. The current phase's progress is shown as a plane
 * flying a fixed route (a "Flight Focus"-style visual, deliberately more
 * fun to glance at than a bare progress ring — see renderFlightPlane()),
 * while the *daily* study goal (today's total vs. the goal) is shown as
 * plain numbers further down the screen. The big numeric readout in the
 * middle of the flight visual counts down the current Pomodoro phase.
 *
 * Timer correctness (Phase 1 rewrite): the countdown is timestamp-based, not
 * a `setInterval` counter. `runStartedAtMs` (when the current run segment
 * began) and `accumulatedMs` (how much of this phase had already elapsed
 * before that segment) are the only persisted source of truth; remaining
 * time is always *derived* from `Date.now() - runStartedAtMs`, never
 * decremented tick-by-tick. This matters because `setInterval` is throttled
 * or fully suspended by the browser while a tab is backgrounded or the
 * phone is locked — a counter that ticks itself down loses time exactly
 * when it matters most. Deriving from a timestamp means a reload, a locked
 * phone, or a backgrounded tab can never desync the countdown: whenever this
 * screen is next rendered, remaining time is recomputed fresh and is correct
 * to within a second, and a run that's still supposed to be going keeps
 * going (including across a full page reload) rather than silently pausing.
 *
 * Leaving screen6 for a different in-app screen still pauses the run (and
 * stops ambient sound) exactly as before — that's a deliberate product
 * choice (a "focus session" means being on the focus screen), not the bug
 * this rewrite fixes. What's fixed is staying *on* this screen while the
 * browser tab itself is backgrounded/locked/reloaded.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};
    const U = TFS.Utils;
    const I18n = TFS.I18n;
    const State = TFS.State;
    const WP = TFS.WheelPicker;

    function todayISO() { return U.formatDateISO(new Date()); }
    function isActive() { return TFS.Router.current() === 'screen6'; }
    function pomodoroSettings() { return State.get().settings.pomodoro; }
    function durationForMode(m) {
        const p = pomodoroSettings();
        if (m === 'shortBreak') return p.shortBreakMin * 60;
        if (m === 'longBreak') return p.longBreakMin * 60;
        return p.focusMin * 60;
    }
    function getTotalToday() { return State.get().focus.totalSecondsByDate[todayISO()] || 0; }

    // A session under this length that gets reset/cancelled is discarded
    // silently rather than logged as partial progress (see reset() below).
    const MIN_PARTIAL_SECONDS = 5 * 60;

    // ---- Runtime engine state. `mode`/`cyclesCompletedToday` and the two
    // timestamp fields below ARE persisted (see persistRuntime) so a reload
    // resumes exactly where things stood — including a run that was still
    // going. `lastCreditMs` is NOT persisted directly; it is reconstructed
    // from the persisted `lastCreditAtMs` checkpoint on load so no elapsed
    // study time is ever double-counted or dropped across a reload. ----
    let mode = 'focus';
    let cyclesCompletedToday = 0;
    let runStartedAtMs = null;   // epoch ms the current run segment began, or null while paused
    let accumulatedMs = 0;       // ms of the current phase already elapsed from previous run segments
    let lastCreditMs = Date.now(); // last time totalSecondsByDate/subject/time-of-day were credited
    let renderIntervalId = null;
    let wakeLockSentinel = null;

    function getElapsedMsInPhase() {
        return accumulatedMs + (runStartedAtMs !== null ? (Date.now() - runStartedAtMs) : 0);
    }
    function getRemainingSeconds() {
        const remainingMs = (durationForMode(mode) * 1000) - getElapsedMsInPhase();
        return Math.max(0, Math.ceil(remainingMs / 1000));
    }
    function isRunning() { return runStartedAtMs !== null; }

    function loadRuntimeFromState() {
        const f = State.get().focus;
        const today = todayISO();
        if (f.lastActiveDateISO !== today) {
            // A new day: cycle count and phase restart fresh, but the
            // per-date/per-subject accumulation maps are keyed by date
            // already so past days are naturally preserved untouched.
            mode = 'focus';
            cyclesCompletedToday = 0;
            runStartedAtMs = null;
            accumulatedMs = 0;
            State.commit({ focus: { lastActiveDateISO: today, mode, cyclesCompletedToday, runStartedAtMs: null, accumulatedMs: 0 } });
        } else {
            mode = f.mode || 'focus';
            cyclesCompletedToday = f.cyclesCompletedToday || 0;
            accumulatedMs = typeof f.accumulatedMs === 'number' ? f.accumulatedMs : 0;
            runStartedAtMs = typeof f.runStartedAtMs === 'number' ? f.runStartedAtMs : null;
        }
        // Resume crediting from exactly where the last session left off
        // (mid-run ticking, or the last visibility/pause checkpoint) — never
        // from "now", which would silently drop everything elapsed while
        // this screen was unmounted or the tab was gone.
        lastCreditMs = typeof f.lastCreditAtMs === 'number' ? f.lastCreditAtMs : (runStartedAtMs || Date.now());

        if (isRunning()) {
            requestWakeLock();
            ensureRenderInterval();
            joinFlightHeartbeatIfEligible();
            // A locked phone or a killed tab can mean the phase boundary was
            // already crossed while we were away — catch up once, immediately.
            creditElapsedFocusTime();
            if (getRemainingSeconds() <= 0) completePhase();
        }
    }

    function persistRuntime() {
        State.commit({ focus: { mode, cyclesCompletedToday, runStartedAtMs, accumulatedMs, lastCreditAtMs: lastCreditMs, lastActiveDateISO: todayISO() } });
    }

    /** Best-effort "which part of the day" bucket for the Phase 6 stats view —
     *  deliberately coarse (4 buckets, not a full per-session log) so this
     *  never grows unbounded and needs no separate cleanup logic. */
    function timeOfDayBucket(date) {
        const h = date.getHours();
        if (h >= 5 && h < 12) return 'morning';
        if (h >= 12 && h < 17) return 'afternoon';
        if (h >= 17 && h < 22) return 'evening';
        return 'night';
    }

    function addSecondsToToday(n) {
        if (n === 0) return;
        const today = todayISO();
        const totals = { ...State.get().focus.totalSecondsByDate };
        totals[today] = Math.max(0, (totals[today] || 0) + n);

        const subjectId = State.get().plan.subject;
        const bySubject = { ...State.get().focus.totalSecondsBySubject };
        if (subjectId) {
            const forSubject = { ...(bySubject[subjectId] || {}) };
            forSubject[today] = Math.max(0, (forSubject[today] || 0) + n);
            bySubject[subjectId] = forSubject;
        }

        const byBucket = { ...State.get().focus.timeOfDayMinutes };
        const bucket = timeOfDayBucket(new Date());
        byBucket[bucket] = Math.max(0, (byBucket[bucket] || 0) + (n / 60));

        State.commit({ focus: { totalSecondsByDate: totals, totalSecondsBySubject: bySubject, timeOfDayMinutes: byBucket } });

        if (TFS.Streak) TFS.Streak.reconcile();
    }

    /** Credits real elapsed wall-clock time (since the last checkpoint) into
     *  today's totals, but only for time actually spent in the 'focus'
     *  phase — breaks never count toward the study goal or streak. Called
     *  on every render tick and at every state transition (start/pause/
     *  reset/complete/visibility-return) so no elapsed time is ever lost to
     *  a throttled or suspended background tab.
     *
     *  Crucially, this never credits more than the current phase's own
     *  duration: if the gap since the last checkpoint is long enough that
     *  the phase boundary falls inside it (a tab backgrounded for hours,
     *  say), only the time up to that boundary counts as focus time — the
     *  rest was spent away from the app entirely and is not fabricated
     *  into study time just because the phase was still technically
     *  "running" in storage. */
    function creditElapsedFocusTime() {
        const now = Date.now();
        if (!isRunning() || mode !== 'focus') { lastCreditMs = now; return; }
        const deltaMs = now - lastCreditMs;
        if (deltaMs <= 0) return;

        const elapsedBeforeThisDelta = accumulatedMs + (lastCreditMs - runStartedAtMs);
        const budgetLeftMs = Math.max(0, (durationForMode(mode) * 1000) - elapsedBeforeThisDelta);

        if (deltaMs > budgetLeftMs) {
            const creditableSec = Math.floor(budgetLeftMs / 1000);
            if (creditableSec > 0) addSecondsToToday(creditableSec);
            lastCreditMs = now;
            return;
        }

        const deltaSec = Math.floor(deltaMs / 1000);
        if (deltaSec > 0) {
            addSecondsToToday(deltaSec);
            lastCreditMs += deltaSec * 1000; // keep any sub-second remainder so normal per-second ticking never drifts
        }
    }

    // ---------------------------------------------------------------- Wake Lock

    async function requestWakeLock() {
        try {
            if ('wakeLock' in navigator) wakeLockSentinel = await navigator.wakeLock.request('screen');
        } catch (e) { /* unsupported, or the page isn't visible yet — fail silently per spec */ }
    }
    function releaseWakeLock() {
        if (wakeLockSentinel) { wakeLockSentinel.release().catch(() => {}); wakeLockSentinel = null; }
    }
    // The OS releases a wake lock the instant a tab is hidden; re-acquire it
    // when the learner comes back to a still-running session. Wrapped in
    // try/catch because this is a raw event listener with nothing upstream
    // (unlike router.js/state.js's own listener dispatch) to stop a thrown
    // error here from becoming a fully uncaught exception.
    document.addEventListener('visibilitychange', () => {
        try {
            if (!isActive()) return;
            if (document.visibilityState === 'visible') {
                creditElapsedFocusTime();
                if (isRunning() && getRemainingSeconds() <= 0) completePhase();
                if (isRunning()) requestWakeLock();
                render();
            } else if (isRunning()) {
                // About to be backgrounded/suspended: checkpoint now so nothing
                // that already elapsed is lost if the tab gets killed outright.
                creditElapsedFocusTime();
                persistRuntime();
            }
        } catch (e) { console.error('[focus] visibilitychange handler threw', e); }
    });

    // ---------------------------------------------------------------- DOM refs

    const focusTimerDisplay = document.getElementById('focusTimerDisplay');
    const focusPhaseLabel = document.getElementById('focusPhaseLabel');
    const focusCycleLabel = document.getElementById('focusCycleLabel');
    const focusStartBtn = document.getElementById('focusStartBtn');
    const focusStartBtnIcon = document.getElementById('focusStartBtnIcon');
    const focusStartBtnText = document.getElementById('focusStartBtnText');
    const focusResetBtn = document.getElementById('focusResetBtn');
    const focusTodayHours = document.getElementById('focusTodayHours');
    const focusGoalHours = document.getElementById('focusGoalHours');
    const displayFocusGoal = document.getElementById('displayFocusGoal');

    // Full-screen "on the plane" mode mirrors the same start/reset controls
    // (see enterImmersive/exitImmersive and handleStartBtnClick further
    // down) so the countdown stays controllable without ever minimizing.
    const flightViz = document.getElementById('flightViz');
    const flightVizExpandBtn = document.getElementById('flightVizExpandBtn');
    const flightVizMinimizeBtn = document.getElementById('flightVizMinimizeBtn');
    const focusImmersiveStartBtn = document.getElementById('focusImmersiveStartBtn');
    const focusImmersiveStartBtnIcon = document.getElementById('focusImmersiveStartBtnIcon');
    const focusImmersiveStartBtnText = document.getElementById('focusImmersiveStartBtnText');
    const focusImmersiveResetBtn = document.getElementById('focusImmersiveResetBtn');

    const PHASE_KEY = { focus: 's6.phaseFocus', shortBreak: 's6.phaseShortBreak', longBreak: 's6.phaseLongBreak' };

    // ---------------------------------------------------------------- Full-screen "on the plane" mode
    //
    // A pure view toggle over the same map/timer/controls — nothing about
    // the timer engine above changes when this turns on or off. Entered
    // manually via the expand button, or automatically right after
    // boarding (see completeBoarding() below); exited any time via the
    // minimize button, or forced closed by the router's onLeave hook if
    // the learner navigates away from this screen entirely.

    function enterImmersive() {
        if (!flightViz || flightViz.classList.contains('flight-viz--immersive')) return;
        flightViz.classList.add('flight-viz--immersive');
        flightViz.setAttribute('role', 'dialog');
        flightViz.setAttribute('aria-modal', 'true');
        document.body.classList.add('is-immersive-focus');
        // Leaflet sizes its tiles against its container at the moment it's
        // measured — the container just jumped from a small card to the
        // full viewport, so it needs to re-check or the map looks cropped.
        if (flightMap) { try { flightMap.invalidateSize(); } catch (e) { /* non-fatal, same as every other flightMap call in this file */ } }
        if (flightVizMinimizeBtn) flightVizMinimizeBtn.focus();
    }
    function exitImmersive() {
        if (!flightViz || !flightViz.classList.contains('flight-viz--immersive')) return;
        flightViz.classList.remove('flight-viz--immersive');
        flightViz.removeAttribute('role');
        flightViz.removeAttribute('aria-modal');
        document.body.classList.remove('is-immersive-focus');
        if (flightMap) { try { flightMap.invalidateSize(); } catch (e) { /* non-fatal */ } }
        if (flightVizExpandBtn) flightVizExpandBtn.focus();
    }
    if (flightVizExpandBtn) flightVizExpandBtn.addEventListener('click', enterImmersive);
    if (flightVizMinimizeBtn) flightVizMinimizeBtn.addEventListener('click', exitImmersive);
    // Escape exits immersive mode too, matching what every full-screen-style
    // surface elsewhere in this app already does (see modal.js's own
    // Escape handling) — safe as a page-wide listener since it's a no-op
    // whenever immersive mode isn't actually active.
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && flightViz && flightViz.classList.contains('flight-viz--immersive')) exitImmersive();
    });

    // ---------------------------------------------------------------- "Flight Focus"-style route visual + flight picker
    //
    // The route is drawn on a real satellite map (Leaflet + Esri World
    // Imagery, https://server.arcgisonline.com/.../World_Imagery — free,
    // no API key or account required for this kind of light, non-bulk
    // use, same as the many small open-source Leaflet demos that use it).
    // Every real coordinate below is an actual Thai city; only the
    // "flight" framing around them is invented. All panning/zooming is
    // disabled since this is a display, not something to explore.
    //
    // Leaflet, and the network fetches it makes for map tiles, are kept
    // fully outside the countdown's critical path: everything in this
    // block is wrapped so a slow connection, a blocked CDN, or Leaflet
    // itself throwing can never affect the timer text rendered separately
    // in render() above it — at worst, the map area just stays blank.

    const flightMapContainer = document.getElementById('flightMapContainer');
    const flightDestCodeEl = document.getElementById('flightDestCode');
    const flightOriginCodeEl = document.getElementById('flightOriginCode');
    const flightPickerRow = document.getElementById('flightPickerRow');
    const flightPickerLabel = document.getElementById('flightPickerLabel');
    const openRealDestBtn = document.getElementById('openRealDestBtn');
    const realDestModal = document.getElementById('realDestModal');
    const realDestList = document.getElementById('realDestList');
    const closeRealDestBtn = document.getElementById('closeRealDestBtn');

    const BKK_LATLNG = [13.6900, 100.7501]; // fallback if data/airports.js ever fails to load
    const WINDOW_COUNT = 6;

    /** The real airport every flight departs from — Settings' "Flight
     *  origin" (data/airports.js, js/geo.js), Bangkok Suvarnabhumi by
     *  default. Falls back to a bare Bangkok coordinate if that data or
     *  module didn't load, so a missing script can never blank the map. */
    function originAirport() {
        const id = State.get().settings.departureAirportId;
        const found = TFS.Geo && TFS.Geo.airportById(id);
        return found || { id: 'bkk', code: 'BKK', latlng: BKK_LATLNG };
    }

    // A handful of curated study-session lengths, each tied to a real Thai
    // city (purely thematic — not a real flight schedule), the same
    // spirit as the video that inspired this. Picking one sets the focus
    // duration to exactly that many minutes, so two learners who pick the
    // same flight are — by definition — running the same timer length,
    // which is what makes "you're on the same plane as them" a meaningful
    // thing to show rather than a coincidence.
    const FLIGHTS = [
        { id: 'tdx', minutes: 10, code: 'TDX', flightNo: 'FS101', name: { th: 'ตราด', en: 'Trat' }, latlng: [12.2728, 102.3189] },
        { id: 'hhq', minutes: 15, code: 'HHQ', flightNo: 'FS115', name: { th: 'หัวหิน', en: 'Hua Hin' }, latlng: [12.5684, 99.9578] },
        { id: 'utp', minutes: 20, code: 'UTP', flightNo: 'FS120', name: { th: 'พัทยา-อู่ตะเภา', en: 'Pattaya (U-Tapao)' }, latlng: [12.6799, 101.0050] },
        { id: 'cnx', minutes: 25, code: 'CNX', flightNo: 'FS225', name: { th: 'เชียงใหม่', en: 'Chiang Mai' }, latlng: [18.7883, 98.9853] },
        { id: 'urt', minutes: 35, code: 'URT', flightNo: 'FS135', name: { th: 'สุราษฎร์ธานี', en: 'Surat Thani' }, latlng: [9.1342, 99.1356] },
        { id: 'hkt', minutes: 45, code: 'HKT', flightNo: 'FS345', name: { th: 'ภูเก็ต', en: 'Phuket' }, latlng: [7.8804, 98.3923] },
        { id: 'uth', minutes: 50, code: 'UTH', flightNo: 'FS150', name: { th: 'อุดรธานี', en: 'Udon Thani' }, latlng: [17.3864, 102.7883] },
        { id: 'kbv', minutes: 60, code: 'KBV', flightNo: 'FS460', name: { th: 'กระบี่', en: 'Krabi' }, latlng: [8.0863, 98.9063] },
        { id: 'ubp', minutes: 75, code: 'UBP', flightNo: 'FS275', name: { th: 'อุบลราชธานี', en: 'Ubon Ratchathani' }, latlng: [15.2528, 104.8703] },
        { id: 'cei', minutes: 90, code: 'CEI', flightNo: 'FS590', name: { th: 'เชียงราย', en: 'Chiang Rai' }, latlng: [19.9105, 99.8406] },
        { id: 'hdy', minutes: 120, code: 'HDY', flightNo: 'FS620', name: { th: 'หาดใหญ่', en: 'Hat Yai' }, latlng: [6.9330, 100.3945] }
    ];

    function flightForMinutes(minutes) { return FLIGHTS.find(f => f.minutes === minutes) || null; }

    /** The nearest flight even when the current duration doesn't exactly
     *  match one (e.g. a custom value set in Settings) — used to still
     *  draw *some* reasonable route and destination code, but never for
     *  passenger matching (see refreshFlightPassengerCount, which requires
     *  an exact match). */
    function nearestFlight(minutes) {
        return flightForMinutes(minutes)
            || FLIGHTS.reduce((best, f) => (Math.abs(f.minutes - minutes) < Math.abs(best.minutes - minutes) ? f : best), FLIGHTS[0]);
    }

    function interpolateLatLng(a, b, t) {
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }

    let flightMap = null, flightRouteLine = null, flightTrailLine = null, flightPlaneMarker = null, flightDestMarker = null, flightOriginMarker = null;
    let mapDrawnFlightId = null; // which flight's route is currently on the map
    let mapDrawnOriginId = null; // which departure airport it's currently drawn from — either changing means a redraw
    let mapTileLayer = null; // the currently-attached tile layer, so a style change can swap it without rebuilding the whole map
    let mapStyleApplied = null; // which style key mapTileLayer currently is

    // Real, free tile providers, no API key — three genuinely different
    // looks (see Settings' "Home map style"), matching the reference
    // video's picker in spirit (its exact "Monochrome"/"Terra" styles are
    // Apple Maps' own and aren't available outside a native iOS app).
    const MAP_STYLES = {
        satellite: {
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            attribution: 'Imagery &copy; Esri', maxZoom: 12
        },
        standard: {
            url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            attribution: '&copy; OpenStreetMap contributors', maxZoom: 12
        },
        monochrome: {
            url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO', maxZoom: 12
        }
    };

    function currentMapStyleKey() {
        const key = State.get().settings.mapStyle;
        return MAP_STYLES[key] ? key : 'satellite';
    }

    /** Swaps the map's tile layer to match Settings' chosen style — safe to
     *  call whenever (a no-op if it's already the current one), so render()
     *  picking this up via State.subscribe() needs no special-casing. */
    function applyMapStyle() {
        if (!flightMap) return;
        const key = currentMapStyleKey();
        if (key === mapStyleApplied) return;
        const cfg = MAP_STYLES[key];
        const next = L.tileLayer(cfg.url, { attribution: cfg.attribution, maxZoom: cfg.maxZoom });
        next.addTo(flightMap);
        if (mapTileLayer) flightMap.removeLayer(mapTileLayer);
        mapTileLayer = next;
        mapStyleApplied = key;
    }

    function buildPlaneIcon() {
        const windows = new Array(WINDOW_COUNT).fill('<span class="flight-window-dot"></span>').join('');
        return L.divIcon({
            className: 'flight-plane-marker',
            html: `<span class="material-symbols-outlined flight-plane-marker__glyph" aria-hidden="true">flight</span>`
                + `<span class="flight-plane-marker__windows">${windows}</span>`,
            iconSize: [56, 40], iconAnchor: [28, 14]
        });
    }

    /** Lazily creates the Leaflet map the first time it's actually needed.
     *  Returns null (never throws) if Leaflet didn't load or initializing
     *  it failed for any reason — every caller already treats that as
     *  "nothing to draw this render" rather than an error. */
    function ensureFlightMap() {
        if (flightMap || !flightMapContainer) return flightMap;
        if (typeof L === 'undefined') return null; // Leaflet's CDN script didn't load — map area just stays blank
        try {
            const origin = originAirport().latlng;
            flightMap = L.map(flightMapContainer, {
                zoomControl: false, dragging: false, touchZoom: false, scrollWheelZoom: false,
                doubleClickZoom: false, boxZoom: false, keyboard: false, tap: false
            }).setView(origin, 6);

            applyMapStyle();

            flightRouteLine = L.polyline([origin, origin], { color: '#000', weight: 5, opacity: 0.22, interactive: false }).addTo(flightMap);
            flightTrailLine = L.polyline([origin, origin], { color: '#fff', weight: 3, interactive: false }).addTo(flightMap);
            flightOriginMarker = L.circleMarker(origin, { radius: 5, weight: 1.5, color: 'rgba(0,0,0,0.35)', fillColor: '#fff', fillOpacity: 1, interactive: false }).addTo(flightMap);
            flightDestMarker = L.circleMarker(origin, { radius: 5, weight: 1.5, color: 'rgba(0,0,0,0.35)', fillColor: '#fff', fillOpacity: 1, interactive: false }).addTo(flightMap);
            flightPlaneMarker = L.marker(origin, { icon: buildPlaneIcon(), interactive: false }).addTo(flightMap);
        } catch (e) {
            console.warn('[focus] Flight map failed to initialize; the map area will just stay blank.', e);
            flightMap = null;
        }
        return flightMap;
    }

    /** (Re)draws the full route the first time a given flight is shown, or
     *  whenever the selected flight or the departure airport changes —
     *  never every render tick, which would otherwise reset the zoom/pan
     *  constantly. */
    function updateFlightRoute(flight) {
        const origin = originAirport();
        if (mapDrawnFlightId === flight.id && mapDrawnOriginId === origin.id) return;
        mapDrawnFlightId = flight.id;
        mapDrawnOriginId = origin.id;
        flightRouteLine.setLatLngs([origin.latlng, flight.latlng]);
        if (flightOriginMarker) flightOriginMarker.setLatLng(origin.latlng);
        flightDestMarker.setLatLng(flight.latlng);
        flightMap.fitBounds([origin.latlng, flight.latlng], { padding: [28, 28] });
    }

    /** Lights up one cabin window per real learner currently on this exact
     *  flight (capped at however many window slots the plane actually has;
     *  anyone beyond that is still counted in the text next to the
     *  toggle, just not drawn individually). Never anything more specific
     *  than a lit dot — see buildPlaneIcon() above for why. */
    function renderFlightWindows(count) {
        if (!flightPlaneMarker) return;
        const el = flightPlaneMarker.getElement();
        if (!el) return;
        const dots = el.querySelectorAll('.flight-window-dot');
        const lit = U.clamp(count, 0, dots.length);
        dots.forEach((dot, i) => dot.classList.toggle('is-lit', i < lit));
    }

    /** Moves the plane along the real route to reflect how far into the
     *  current phase we are — computed the same timestamp-derived way as
     *  the countdown itself so it's never a step behind it — and fills in
     *  the "traveled" trail behind it. */
    function renderFlightPlane() {
        const total = durationForMode(mode);
        const flight = activeFlight(Math.round(total / 60));
        if (flightDestCodeEl) flightDestCodeEl.textContent = flight.code;
        if (flightOriginCodeEl) flightOriginCodeEl.textContent = originAirport().code;
        renderFlightWindows(knownFlightPassengerCount);

        try {
            const map = ensureFlightMap();
            if (!map) return;
            applyMapStyle();
            updateFlightRoute(flight);

            const remaining = getRemainingSeconds();
            const progress = total > 0 ? U.clamp(1 - remaining / total, 0, 1) : 0;
            const current = interpolateLatLng(originAirport().latlng, flight.latlng, progress);
            flightPlaneMarker.setLatLng(current);
            flightTrailLine.setLatLngs([originAirport().latlng, current]);
        } catch (e) {
            console.warn('[focus] Could not update the flight map this render (will retry next tick).', e);
        }
    }

    // How many real people are on this exact flight right now, including
    // this learner — refreshed by refreshFlightPassengerCount() below
    // automatically whenever a flight matches (no toggle to opt into
    // anymore, see that function); otherwise just "yourself" once a flight
    // is selected at all, as flavor. renderFlightWindows() above is the
    // only thing that reads this.
    let knownFlightPassengerCount = 1;

    /** The flight picker: only meaningful before a focus phase starts (you
     *  can't change your ticket mid-flight) and only for the focus phase
     *  itself, not breaks — breaks stay whatever length Settings has them
     *  at. Selecting a chip sets settings.pomodoro.focusMin directly, so
     *  every other part of the app (streak, stats, the timer engine
     *  itself) needs no separate concept of "which flight" at all. */
    function renderFlightPicker() {
        if (!flightPickerRow) return;
        const show = mode === 'focus' && !isRunning();
        flightPickerRow.hidden = !show;
        if (flightPickerLabel) flightPickerLabel.hidden = !show;
        if (openRealDestBtn) openRealDestBtn.hidden = !show;
        if (!show) return;

        const currentMinutes = pomodoroSettings().focusMin;
        const originCode = originAirport().code;
        flightPickerRow.innerHTML = '';
        FLIGHTS.forEach((flight) => {
            const isSelected = flight.minutes === currentMinutes;
            flightPickerRow.appendChild(U.el('button', {
                className: 'flight-chip' + (isSelected ? ' is-selected' : ''),
                attrs: { type: 'button', role: 'radio', 'aria-checked': String(isSelected) },
                on: { click: () => selectFlight(flight) }
            }, [
                U.el('span', { className: 'flight-chip__flightno', text: flight.flightNo }),
                U.el('span', { className: 'flight-chip__route' }, [
                    U.el('span', { className: 'flight-chip__origin', text: originCode }),
                    U.el('span', { className: 'material-symbols-outlined', attrs: { 'aria-hidden': 'true' }, text: 'flight' }),
                    U.el('span', { className: 'flight-chip__code', text: flight.code })
                ]),
                U.el('span', { className: 'flight-chip__name', text: I18n.pick(flight.name) }),
                U.el('span', { className: 'flight-chip__mins', text: I18n.t('s6.flightMinutes', { n: flight.minutes }) }),
                U.el('span', { className: 'material-symbols-outlined flight-chip__check', attrs: { 'aria-hidden': 'true' }, text: 'check_circle' })
            ]));
        });
    }

    function selectFlight(flight) {
        if (isRunning()) return;
        // Picking a curated flight always wins over a previously-explored
        // real destination (see activeFlight() below) — one ticket at a
        // time, and this is the more discoverable/default of the two ways
        // to get one.
        State.commit({ settings: { pomodoro: { focusMin: flight.minutes }, customDestinationId: null } });
        if (mode === 'focus') { accumulatedMs = 0; persistRuntime(); }
        render();
        refreshFlightPassengerCount(); // this flight's passenger count may differ from the previous one
    }

    /** The flight the learner is currently ticketed for, if the duration
     *  exactly matches one of the curated FLIGHTS — null for a custom
     *  duration set via Settings, in which case there's no shared room to
     *  join (see js/presence.js's file header for why matching has to be
     *  exact rather than nearest-match). */
    function currentFocusFlight() { return flightForMinutes(pomodoroSettings().focusMin); }

    /** The flight actually being flown, for anywhere that needs one
     *  concrete answer (the map, the boarding pass, the flight log): an
     *  explicitly-picked real destination (see "Explore real destinations"
     *  below) if one is set, otherwise the exactly-matching curated
     *  flight, otherwise the curated flight whose duration is closest —
     *  the same fallback nearestFlight() already provided. Never null. */
    function activeFlight(minutesHint) {
        const customId = State.get().settings.customDestinationId;
        const airport = customId && TFS.Geo && TFS.Geo.airportById(customId);
        if (airport) {
            return { id: 'custom:' + airport.id, code: airport.code, name: airport.name, latlng: airport.latlng, minutes: pomodoroSettings().focusMin };
        }
        return currentFocusFlight() || nearestFlight(minutesHint !== undefined ? minutesHint : pomodoroSettings().focusMin);
    }

    // ---------------------------------------------------------------- Explore real destinations
    //
    // An alternative to the curated flight-picker chips above: browse every
    // real airport in data/airports.js by how long that route would
    // actually take from the current departure airport, and fly it for
    // real instead of picking a round Pomodoro number. Never the default —
    // round session lengths matter more for actually studying than
    // geographic realism does — just here for whoever wants it anyway.

    /** ~540 km/h cruise speed (9 km/min) plus a flat 12 minutes for taxi,
     *  climb and descent — not a real airline's numbers, just a formula
     *  that lands in the right neighborhood for a short domestic hop
     *  without ever going below what a landing alone realistically takes. */
    function computeRealMinutes(km) {
        return U.clamp(Math.round(12 + km / 9), 10, 180);
    }

    function renderRealDestList() {
        if (!realDestList || !TFS.Geo) return;
        realDestList.innerHTML = '';
        const origin = originAirport();
        const sorted = (TFS.AIRPORTS || [])
            .filter((a) => a.id !== origin.id)
            .map((a) => ({ airport: a, km: U.haversineKm(origin.latlng, a.latlng) }))
            .sort((a, b) => a.km - b.km);
        sorted.forEach(({ airport, km }) => {
            const minutes = computeRealMinutes(km);
            realDestList.appendChild(U.el('button', {
                className: 'search-result-item w-full', attrs: { type: 'button' },
                on: { click: () => selectRealDestination(airport) }
            }, [
                U.el('span', { className: 'flex items-center gap-3' }, [
                    U.el('span', { className: 'material-symbols-outlined text-primary', attrs: { 'aria-hidden': 'true' }, text: 'flight_takeoff' }),
                    U.el('span', {}, [
                        U.el('h3', { attrs: { style: 'font-weight:700;font-size:0.875rem' }, text: `${I18n.pick(airport.name)} (${airport.code})` }),
                        U.el('p', { className: 'text-outline', attrs: { style: 'font-size:0.6875rem' }, text: `${Math.round(km)} km` })
                    ])
                ]),
                U.el('span', { attrs: { style: 'font-weight:700;color:var(--color-primary);white-space:nowrap' }, text: I18n.t('s6.flightMinutes', { n: minutes }) })
            ]));
        });
    }

    function selectRealDestination(airport) {
        if (isRunning()) return;
        const minutes = computeRealMinutes(U.haversineKm(originAirport().latlng, airport.latlng));
        State.commit({ settings: { pomodoro: { focusMin: minutes }, customDestinationId: airport.id } });
        if (mode === 'focus') { accumulatedMs = 0; persistRuntime(); }
        TFS.Modal.close(realDestModal);
        render();
        refreshFlightPassengerCount();
    }

    if (openRealDestBtn) {
        openRealDestBtn.addEventListener('click', () => {
            if (!TFS.Geo) { TFS.Toast.warn(I18n.t('modalRealDest.unavailable')); return; }
            renderRealDestList();
            TFS.Modal.open(realDestModal);
        });
    }
    if (closeRealDestBtn) closeRealDestBtn.addEventListener('click', () => TFS.Modal.close(realDestModal));

    /** Joins this flight's shared presence room whenever we're actually in
     *  the focus phase (not a break) and the current duration exactly
     *  matches a curated flight to join a room for — automatic now, no
     *  opt-in toggle (removed; see the "Flight passenger presence" section
     *  further down for why). Safe to call unconditionally; no-ops
     *  otherwise. `activeSeat` (set by showBoardingPass) tags this
     *  learner's seat on their presence doc so real co-passengers show up
     *  correctly taken in the seat picker. */
    function joinFlightHeartbeatIfEligible() {
        const flight = mode === 'focus' ? currentFocusFlight() : null;
        if (flight && TFS.Presence && TFS.Presence.isAvailable()) {
            TFS.Presence.startHeartbeat(flight.id, activeSeat);
        }
    }

    function render() {
        // The parts that actually matter — remaining time, phase, goal,
        // the start/pause button — always run first and unconditionally,
        // regardless of whether the decorative flight visual below them
        // succeeds. That order is deliberate defense in depth: renderFlightPlane()
        // already guards its own risky SVG calls, but nothing about the
        // countdown itself should ever be allowed to depend on a map
        // animation rendering correctly.
        const goal = State.get().plan.dailyGoalSeconds;
        focusTimerDisplay.textContent = U.formatSecondsToHMS(getRemainingSeconds());
        focusPhaseLabel.textContent = I18n.t(PHASE_KEY[mode]);
        const cycles = pomodoroSettings().cyclesBeforeLongBreak;
        const currentCycle = (cyclesCompletedToday % cycles) + 1;
        focusCycleLabel.textContent = I18n.t('s6.cycleLabel', { current: currentCycle, total: cycles });

        displayFocusGoal.textContent = U.formatSecondsToHHMM(goal);
        focusTodayHours.textContent = U.formatSecondsToHHMM(getTotalToday());
        focusGoalHours.textContent = U.formatSecondsToHHMM(goal);

        if (isRunning()) {
            focusStartBtnIcon.textContent = 'pause';
            focusStartBtnText.textContent = I18n.t('s6.pause');
        } else {
            focusStartBtnIcon.textContent = 'play_arrow';
            const full = durationForMode(mode);
            focusStartBtnText.textContent = (getRemainingSeconds() < full) ? I18n.t('s6.resume') : I18n.t('s6.start');
        }
        // Mirrors the same state onto the full-screen mode's own start
        // button, so it reads correctly whichever way immersive mode was
        // entered (see enterImmersive() above).
        if (focusImmersiveStartBtnIcon) focusImmersiveStartBtnIcon.textContent = focusStartBtnIcon.textContent;
        if (focusImmersiveStartBtnText) focusImmersiveStartBtnText.textContent = focusStartBtnText.textContent;

        renderSoundToggle();
        renderFlightPlane();
        renderFlightPicker();
    }

    function ensureRenderInterval() {
        if (renderIntervalId !== null) return;
        renderIntervalId = setInterval(tick, 1000);
    }
    function clearRenderInterval() {
        if (renderIntervalId !== null) { clearInterval(renderIntervalId); renderIntervalId = null; }
    }

    // Wrapped for the same reason as the visibilitychange listener above:
    // this runs once a second via setInterval with nothing upstream to
    // catch a thrown error, and it would do so every single second a
    // session is running if it ever regressed.
    function tick() {
        try {
            creditElapsedFocusTime();
            if (isRunning() && getRemainingSeconds() <= 0) completePhase();
            render();
        } catch (e) { console.error('[focus] tick threw', e); }
    }

    /** Appends one entry to the "Mine" flight log (js/settings.js reads it),
     *  capped at the most recent 20 — same bounded-array spirit as
     *  flashcards.js's reviewLog, so this never grows without limit.
     *  `minutes` is however long the phase actually ran, which can be less
     *  than the full ticketed length for a partial session (see reset()'s
     *  own caller). Never logs a break, or a session too short to have
     *  meant anything. */
    function logFlight(minutes) {
        if (!minutes || minutes < 1) return;
        const flight = activeFlight(minutes);
        const origin = originAirport();
        const entry = {
            dateISO: U.formatDateISO(new Date()),
            originCode: origin.code, destCode: flight.code, destName: I18n.pick(flight.name),
            minutes, seat: activeSeat, scenarioId: activeScenario.id
        };
        const log = [...State.get().focus.flightLog, entry].slice(-20);
        State.commit({ focus: { flightLog: log } });
    }

    function completePhase() {
        // A phase ending (landing for a break, or a break ending) always
        // drops back to the normal screen — the toast/stats right after
        // this need to actually be visible, not sit under a full-bleed map.
        exitImmersive();
        playNotificationSound();
        if (mode === 'focus') {
            logFlight(pomodoroSettings().focusMin);
            cyclesCompletedToday++;
            const cycles = pomodoroSettings().cyclesBeforeLongBreak;
            mode = (cyclesCompletedToday % cycles === 0) ? 'longBreak' : 'shortBreak';
            TFS.Toast.info(I18n.t('s6.phaseCompleteFocus'));
            // Landed for a break — a flight's shared room only makes sense
            // while actually mid-focus, so leave it rather than keep
            // pinging a room for a flight that's no longer in the air, and
            // reset the cabin back to just yourself until the next flight.
            if (TFS.Presence) TFS.Presence.stopHeartbeat();
            knownFlightPassengerCount = 1;
        } else {
            mode = 'focus';
            TFS.Toast.info(I18n.t('s6.phaseCompleteBreak'));
        }
        accumulatedMs = 0;
        // Auto-advance into the next phase without requiring another tap —
        // but only if a session was actually running; completing a phase
        // that was reached via the day-rollover reset above never auto-runs.
        if (isRunning()) {
            runStartedAtMs = Date.now(); lastCreditMs = runStartedAtMs;
            if (mode === 'focus') joinFlightHeartbeatIfEligible(); // break just ended — back in the air
        }
        persistRuntime();
    }

    function start() {
        if (isRunning()) return;
        runStartedAtMs = Date.now();
        lastCreditMs = runStartedAtMs;
        requestWakeLock();
        ensureRenderInterval();
        joinFlightHeartbeatIfEligible();
        persistRuntime();
        render();
    }

    function pause() {
        if (!isRunning()) return;
        creditElapsedFocusTime();
        accumulatedMs += Date.now() - runStartedAtMs;
        runStartedAtMs = null;
        releaseWakeLock();
        clearRenderInterval();
        if (TFS.Presence) TFS.Presence.stopHeartbeat();
        persistRuntime();
        render();
    }

    /** "Cancel" per the spec: a focus phase cut short before 5 minutes is
     *  discarded silently (the seconds already credited to today's total are
     *  subtracted back out); one cut short after 5 minutes stays logged as a
     *  partial session — no penalty copy or confirmation dialog either way. */
    function reset() {
        exitImmersive();
        creditElapsedFocusTime();
        const elapsedMs = getElapsedMsInPhase();
        releaseWakeLock();
        clearRenderInterval();
        if (TFS.Presence) TFS.Presence.stopHeartbeat();
        runStartedAtMs = null;
        if (mode === 'focus' && elapsedMs > 0 && elapsedMs < MIN_PARTIAL_SECONDS * 1000) {
            addSecondsToToday(-Math.floor(elapsedMs / 1000));
        } else if (mode === 'focus' && elapsedMs >= MIN_PARTIAL_SECONDS * 1000) {
            logFlight(Math.round(elapsedMs / 60000)); // however long it actually ran, not the full ticketed length
        }
        accumulatedMs = 0;
        persistRuntime();
        render();
    }

    // ---------------------------------------------------------------- Boarding pass ("check in" ritual)

    const boardingPassModal = document.getElementById('boardingPassModal');
    const boardingPassCard = document.getElementById('boardingPassCard');
    const boardingPassOriginCode = document.getElementById('boardingPassOriginCode');
    const boardingPassScenarioIcon = document.getElementById('boardingPassScenarioIcon');
    const boardingPassScenarioLabel = document.getElementById('boardingPassScenarioLabel');
    const boardingPassDestCode = document.getElementById('boardingPassDestCode');
    const boardingPassDestName = document.getElementById('boardingPassDestName');
    const boardingPassSeat = document.getElementById('boardingPassSeat');
    const boardingPassDuration = document.getElementById('boardingPassDuration');
    const boardingPassDate = document.getElementById('boardingPassDate');
    const boardingPassDistance = document.getElementById('boardingPassDistance');
    const boardingPassBarcode = document.getElementById('boardingPassBarcode');
    const boardingPassTear = document.getElementById('boardingPassTear');
    const boardingPassTearThumb = document.getElementById('boardingPassTearThumb');
    const TEAR_COMPLETE_RATIO = 0.82;

    function randomSeat() {
        const row = 1 + Math.floor(Math.random() * 32);
        const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
        return `${row}${letters[Math.floor(Math.random() * letters.length)]}`;
    }

    /** A purely decorative barcode — a row of bars with randomized widths,
     *  regenerated fresh each time the pass is shown. Never anything to
     *  actually scan; it's set dressing for the "real ticket" feel, the
     *  same spirit as the seat number next to it. */
    function renderBarcode() {
        if (!boardingPassBarcode) return;
        boardingPassBarcode.innerHTML = '';
        for (let i = 0; i < 46; i++) {
            const bar = document.createElement('span');
            bar.style.width = (1 + Math.floor(Math.random() * 3)) + 'px';
            boardingPassBarcode.appendChild(bar);
        }
    }

    /** Moves the drag thumb to `ratio` (0-1) along the tear track and keeps
     *  its ARIA value in sync. Safe to call before the modal is visible —
     *  it only reads layout when ratio > 0, which never happens until a
     *  real drag/keypress is already underway. */
    function setTearProgress(ratio) {
        if (!boardingPassTear || !boardingPassTearThumb) return;
        const clamped = Math.max(0, Math.min(1, ratio));
        let offset = 4;
        if (clamped > 0) {
            const trackRect = boardingPassTear.getBoundingClientRect();
            const maxLeft = Math.max(0, trackRect.width - boardingPassTearThumb.offsetWidth - 8);
            offset = 4 + clamped * maxLeft;
        }
        boardingPassTearThumb.style.left = offset + 'px';
        boardingPassTearThumb.setAttribute('aria-valuenow', String(Math.round(clamped * 100)));
    }

    function resetTear() {
        if (boardingPassTear) boardingPassTear.classList.remove('is-dragging', 'is-complete');
        if (boardingPassCard) boardingPassCard.classList.remove('is-torn');
        setTearProgress(0);
    }

    /** Plays the tear-apart animation, then performs the exact same action
     *  as the plain fallback button (close + start) — called both when the
     *  swipe gesture crosses its threshold and when that fallback button is
     *  tapped, so every path ends the same way. Reduced-motion users skip
     *  the wait entirely rather than sitting through a transform they won't
     *  see, per this app's accessibility rules. */
    function completeBoarding() {
        if (boardingPassTear) boardingPassTear.classList.add('is-complete');
        if (boardingPassCard) boardingPassCard.classList.add('is-torn');
        const finish = () => {
            TFS.Modal.close(boardingPassModal);
            start();
            // The whole point of the check-in ritual is landing in the
            // "on the plane" full-screen view right after — see this
            // file's "Full-screen" section above. exitImmersive() elsewhere
            // (completePhase, reset, leaving the screen) always brings the
            // learner back out cleanly.
            enterImmersive();
        };
        const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reducedMotion) finish();
        else setTimeout(finish, 360);
    }

    /** Drag-to-tear gesture on the boarding-pass stub. Uses pointer capture
     *  so move/up events keep reaching the thumb even once the finger/mouse
     *  leaves it mid-drag. Arrow keys and Enter/Space give the same result
     *  without a pointer, and the always-visible fallback button below
     *  covers everyone else — this is flavor on top of that, never the only
     *  way to proceed. */
    function initTearGesture() {
        if (!boardingPassTear || !boardingPassTearThumb) return;
        let dragging = false;
        let startX = 0;
        let maxLeft = 1;

        function onPointerDown(e) {
            dragging = true;
            boardingPassTear.classList.add('is-dragging');
            startX = e.clientX;
            const trackRect = boardingPassTear.getBoundingClientRect();
            maxLeft = Math.max(1, trackRect.width - boardingPassTearThumb.offsetWidth - 8);
            try { boardingPassTearThumb.setPointerCapture(e.pointerId); } catch (err) { /* unsupported, drag still works via move/up */ }
        }
        function onPointerMove(e) {
            if (!dragging) return;
            setTearProgress((e.clientX - startX) / maxLeft);
        }
        function onPointerUp(e) {
            if (!dragging) return;
            dragging = false;
            boardingPassTear.classList.remove('is-dragging');
            const ratio = Math.max(0, Math.min(1, (e.clientX - startX) / maxLeft));
            if (ratio >= TEAR_COMPLETE_RATIO) { setTearProgress(1); completeBoarding(); }
            else setTearProgress(0);
        }
        boardingPassTearThumb.addEventListener('pointerdown', onPointerDown);
        boardingPassTearThumb.addEventListener('pointermove', onPointerMove);
        boardingPassTearThumb.addEventListener('pointerup', onPointerUp);
        boardingPassTearThumb.addEventListener('pointercancel', onPointerUp);
        boardingPassTearThumb.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                e.preventDefault();
                setTearProgress(1);
                completeBoarding();
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                const current = Number(boardingPassTearThumb.getAttribute('aria-valuenow') || '0') / 100;
                const next = current + (e.key === 'ArrowRight' ? 0.2 : -0.2);
                if (next >= TEAR_COMPLETE_RATIO) { setTearProgress(1); completeBoarding(); }
                else setTearProgress(next);
            }
        });
    }
    initTearGesture();

    /** The seat for the flight about to start, set below whenever the
     *  boarding pass is shown — read by joinFlightHeartbeatIfEligible()
     *  (above) so a real learner's chosen seat shows up correctly taken to
     *  anyone else looking at the seat picker for this same flight. */
    let activeSeat = null;

    /** Step 2 of the check-in ritual (see showSeatPicker below, its only
     *  caller) — `seat` is whatever was actually picked there; `randomSeat()`
     *  is only a defensive fallback if the seat picker's elements are ever
     *  missing for some reason. */
    function showBoardingPass(seat) {
        const flight = activeFlight();
        const origin = originAirport();
        activeSeat = seat || randomSeat();
        if (boardingPassOriginCode) boardingPassOriginCode.textContent = origin.code;
        if (boardingPassDestCode) boardingPassDestCode.textContent = flight.code;
        if (boardingPassDestName) boardingPassDestName.textContent = I18n.pick(flight.name);
        if (boardingPassSeat) boardingPassSeat.textContent = activeSeat;
        if (boardingPassDuration) boardingPassDuration.textContent = I18n.t('s6.flightMinutes', { n: flight.minutes });
        if (boardingPassDistance) boardingPassDistance.textContent = I18n.t('s6.distanceKm', { n: Math.round(U.haversineKm(origin.latlng, flight.latlng)) });
        if (boardingPassScenarioIcon) boardingPassScenarioIcon.textContent = activeScenario.icon;
        if (boardingPassScenarioLabel) boardingPassScenarioLabel.textContent = I18n.pick(activeScenario.label);
        if (boardingPassDate) {
            const today = new Date();
            // Thai (Buddhist) calendar year, matching how a Thai-audience
            // app would actually print a date on a ticket like this.
            boardingPassDate.textContent = `${today.getFullYear() + 543}/${U.pad2(today.getMonth() + 1)}/${U.pad2(today.getDate())}`;
        }
        renderBarcode();
        resetTear();
        TFS.Modal.open(boardingPassModal);
    }

    document.getElementById('closeBoardingPassBtn').addEventListener('click', () => TFS.Modal.close(boardingPassModal));
    document.getElementById('confirmBoardingBtn').addEventListener('click', () => completeBoarding());

    // ---------------------------------------------------------------- Seat picker (check-in ritual, step 1)

    const seatPickerModal = document.getElementById('seatPickerModal');
    const seatPickerGrid = document.getElementById('seatPickerGrid');
    const seatPickerOriginCode = document.getElementById('seatPickerOriginCode');
    const seatPickerDestCode = document.getElementById('seatPickerDestCode');
    const seatPickerHint = document.getElementById('seatPickerHint');
    const seatPickerScenarioPrompt = document.getElementById('seatPickerScenarioPrompt');
    const seatPickerScenarioSeatLabel = document.getElementById('seatPickerScenarioSeatLabel');
    const seatPickerScenarios = document.getElementById('seatPickerScenarios');
    const confirmSeatBtn = document.getElementById('confirmSeatBtn');
    const closeSeatPickerBtn = document.getElementById('closeSeatPickerBtn');
    const SEAT_LETTERS = ['A', 'C', 'D', 'F']; // a small regional-jet 2+2 cabin, matching these short domestic routes
    const SEAT_ROWS = 10;
    let pickedSeat = null;

    // A light, skippable extra touch once a seat is picked (see selectSeat
    // below) — "what are you here to do", purely flavor/future-stats, never
    // required (always defaults to "Focus", this app's actual purpose).
    const SCENARIOS = [
        { id: 'focus', icon: 'hub', label: { th: 'โฟกัส', en: 'Focus' } },
        { id: 'work', icon: 'laptop_mac', label: { th: 'ทำงาน', en: 'Work' } },
        { id: 'meditate', icon: 'self_improvement', label: { th: 'ทำสมาธิ', en: 'Meditate' } },
        { id: 'read', icon: 'menu_book', label: { th: 'อ่านหนังสือ', en: 'Read' } },
        { id: 'exercise', icon: 'directions_run', label: { th: 'ออกกำลังกาย', en: 'Exercise' } }
    ];
    let activeScenario = SCENARIOS[0];

    function scenarioById(id) { return SCENARIOS.find((s) => s.id === id) || SCENARIOS[0]; }

    function renderScenarioRow() {
        if (!seatPickerScenarios) return;
        seatPickerScenarios.innerHTML = '';
        SCENARIOS.forEach((sc) => {
            const isSelected = sc.id === activeScenario.id;
            seatPickerScenarios.appendChild(U.el('button', {
                className: 'scenario-chip' + (isSelected ? ' is-selected' : ''),
                attrs: { type: 'button', role: 'radio', 'aria-checked': String(isSelected) },
                on: { click: () => { activeScenario = sc; renderScenarioRow(); } }
            }, [
                U.el('span', { className: 'material-symbols-outlined', attrs: { 'aria-hidden': 'true' }, text: sc.icon }),
                U.el('span', { text: I18n.pick(sc.label) })
            ]));
        });
    }

    /** Rebuilds the whole seat grid with every seat available, then — if a
     *  real flight and presence are both available — asynchronously marks
     *  exactly the seats real co-passengers on *this* flight currently hold
     *  as taken. No other real users right now (or no way to check) both
     *  look identical on purpose: every seat stays open rather than faking
     *  occupancy, so a genuinely empty flight really can pick any seat. */
    function renderSeatGrid(flightId) {
        if (!seatPickerGrid) return;
        seatPickerGrid.innerHTML = '';
        seatPickerGrid.dataset.flightId = flightId || '';
        pickedSeat = null;
        activeScenario = SCENARIOS[0];
        if (confirmSeatBtn) confirmSeatBtn.disabled = true;
        if (seatPickerScenarioPrompt) seatPickerScenarioPrompt.hidden = true;
        if (seatPickerHint) seatPickerHint.hidden = false;

        const seatButtons = new Map();
        for (let r = 1; r <= SEAT_ROWS; r++) {
            const rowEl = U.el('div', { className: 'seat-picker__row' });
            rowEl.appendChild(U.el('span', { className: 'seat-picker__row-num', text: U.pad2(r) }));
            SEAT_LETTERS.forEach((letter, i) => {
                const seatId = `${r}${letter}`;
                const btn = U.el('button', {
                    className: 'seat-picker__seat',
                    attrs: { type: 'button', role: 'radio', 'aria-checked': 'false', 'aria-label': I18n.t('modalSeatPicker.seatLabel', { seat: seatId }) },
                    text: letter,
                    on: { click: () => selectSeat(seatId, btn) }
                });
                seatButtons.set(seatId, btn);
                rowEl.appendChild(btn);
                if (i === 1) rowEl.appendChild(U.el('span', { className: 'seat-picker__aisle' }));
            });
            seatPickerGrid.appendChild(rowEl);
        }

        if (!flightId || !TFS.Presence || !TFS.Presence.isAvailable()) return;
        TFS.Presence.fetchTakenSeats(flightId).then((taken) => {
            if (!taken || !taken.length) return; // null (couldn't check) or genuinely empty — both mean every seat stays open
            // The learner may have reopened the picker (or it moved to a
            // different flight) before this resolved — only apply a result
            // that still matches what's actually on screen.
            if (seatPickerGrid.dataset.flightId !== flightId) return;
            taken.forEach((seatId) => {
                const btn = seatButtons.get(seatId);
                if (!btn || btn.classList.contains('is-selected')) return; // unknown seat id, or already this learner's own pick
                btn.classList.add('is-taken');
                btn.disabled = true;
                btn.setAttribute('aria-disabled', 'true');
                btn.setAttribute('aria-label', I18n.t('modalSeatPicker.seatTakenLabel', { seat: seatId }));
            });
        }).catch((e) => console.warn('[focus] Could not check real seat occupancy for this flight.', e));
    }

    function selectSeat(seatId, btnEl) {
        if (seatPickerGrid) {
            U.qsa('.seat-picker__seat.is-selected', seatPickerGrid).forEach((el) => {
                el.classList.remove('is-selected');
                el.setAttribute('aria-checked', 'false');
            });
        }
        btnEl.classList.add('is-selected');
        btnEl.setAttribute('aria-checked', 'true');
        pickedSeat = seatId;
        if (confirmSeatBtn) confirmSeatBtn.disabled = false;
        if (seatPickerHint) seatPickerHint.hidden = true;
        if (seatPickerScenarioPrompt) {
            seatPickerScenarioPrompt.hidden = false;
            if (seatPickerScenarioSeatLabel) seatPickerScenarioSeatLabel.textContent = I18n.t('modalSeatPicker.seatLabel', { seat: seatId });
            renderScenarioRow();
        }
    }

    /** Only meaningful right before a genuinely fresh focus phase — see the
     *  handleStartBtnClick handler below, which is the only caller. Falls
     *  straight through to the boarding pass with a random seat if the
     *  picker's own elements are ever missing, so a markup problem here can
     *  never block starting a session outright. */
    function showSeatPicker() {
        if (!seatPickerModal || !seatPickerGrid) { showBoardingPass(randomSeat()); return; }
        const flight = activeFlight();
        if (seatPickerOriginCode) seatPickerOriginCode.textContent = originAirport().code;
        if (seatPickerDestCode) seatPickerDestCode.textContent = flight.code;
        // Only a curated flight (an exact duration match) has a real shared
        // room to check — see currentFocusFlight()'s own comment — so a
        // custom duration's seat picker just shows every seat open.
        renderSeatGrid(currentFocusFlight() ? flight.id : null);
        TFS.Modal.open(seatPickerModal);
    }

    if (closeSeatPickerBtn) closeSeatPickerBtn.addEventListener('click', () => TFS.Modal.close(seatPickerModal));
    if (confirmSeatBtn) confirmSeatBtn.addEventListener('click', () => {
        if (!pickedSeat) return; // disabled until a seat is chosen, but never trust that alone
        const seat = pickedSeat;
        TFS.Modal.close(seatPickerModal);
        showBoardingPass(seat);
    });

    /** Shared by the normal and full-screen start/pause buttons so both
     *  read exactly the same state and trigger the same check-in ritual. */
    function handleStartBtnClick() {
        if (isRunning()) { pause(); return; }
        // Only for a genuinely fresh focus phase — not resuming a paused
        // one, and not for a break — matching the same condition render()
        // already uses to decide between "Start" and "Resume" wording.
        const freshFocusStart = mode === 'focus' && getRemainingSeconds() >= durationForMode(mode);
        if (freshFocusStart) showSeatPicker();
        else start();
    }
    focusStartBtn.addEventListener('click', handleStartBtnClick);
    focusResetBtn.addEventListener('click', reset);
    if (focusImmersiveStartBtn) focusImmersiveStartBtn.addEventListener('click', handleStartBtnClick);
    if (focusImmersiveResetBtn) focusImmersiveResetBtn.addEventListener('click', reset);

    function playNotificationSound() {
        if (!State.get().settings.soundEnabled) return;
        try {
            const audioCtx = new (global.AudioContext || global.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.start();
            gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 1.5);
            oscillator.stop(audioCtx.currentTime + 1.5);
        } catch (e) { console.warn('[focus] Web Audio unavailable for the notification sound.', e); }
    }

    // ---------------------------------------------------------------- Sound toggle

    const notifToggleBtn = document.getElementById('notifToggleBtn');
    const notifToggleSwitch = document.getElementById('notifToggleSwitch');
    const notifToggleIcon = document.getElementById('notifToggleIcon');

    function renderSoundToggle() {
        const on = State.get().settings.soundEnabled;
        notifToggleSwitch.classList.toggle('is-on', on);
        notifToggleBtn.setAttribute('aria-pressed', String(on));
        notifToggleIcon.textContent = on ? 'notifications_active' : 'notifications_off';
    }
    notifToggleBtn.addEventListener('click', () => {
        State.commit({ settings: { soundEnabled: !State.get().settings.soundEnabled } });
    });

    // ---------------------------------------------------------------- Daily goal quick-edit wheel

    const setTimerModal = document.getElementById('setTimerModal');
    const btnOpenSetTimerModal = document.getElementById('btnOpenSetTimerModal');
    const hoursWheel = document.getElementById('hoursWheel');
    const minutesWheel = document.getElementById('minutesWheel');
    let goalWheelsBuilt = false;

    btnOpenSetTimerModal.addEventListener('click', () => {
        if (isRunning()) { TFS.Toast.warn(I18n.t('errors.stopTimerFirst')); return; }
        if (!goalWheelsBuilt) {
            WP.createItems(hoursWheel, 24, false);
            WP.createItems(minutesWheel, 59, true);
            WP.attachScrollSync(hoursWheel);
            WP.attachScrollSync(minutesWheel);
            WP.attachWheelStep(hoursWheel, 24);
            WP.attachWheelStep(minutesWheel, 59);
            goalWheelsBuilt = true;
        }
        const goal = State.get().plan.dailyGoalSeconds;
        const h = Math.floor(goal / 3600), m = Math.floor((goal % 3600) / 60);
        TFS.Modal.open(setTimerModal, { onOpen: () => { WP.setValue(hoursWheel, h); WP.setValue(minutesWheel, m); } });
    });

    document.getElementById('closeSetTimerBtn').addEventListener('click', () => TFS.Modal.close(setTimerModal));
    document.getElementById('saveSetTimerBtn').addEventListener('click', () => {
        const h = WP.getValue(hoursWheel), m = WP.getValue(minutesWheel);
        if (h === 0 && m === 0) { TFS.Toast.warn(I18n.t('errors.setGoalMin')); return; }
        State.commit({ plan: { dailyGoalSeconds: (h * 3600) + (m * 60) } });
        TFS.Modal.close(setTimerModal);
        render();
    });

    // ---------------------------------------------------------------- Flight passenger presence (per-flight — see js/presence.js)
    //
    // Used to be two separate opt-in toggles here (ambient sound, and a
    // "join the public focus room" switch for this count) — both removed
    // after real usage feedback that neither pulled its weight against the
    // clutter of always showing them. Presence itself wasn't the problem,
    // just the manual toggle for it: joining is automatic now, the same
    // way the flight-map's lit cabin windows and the seat picker's taken
    // seats already read from it passively, with nothing to switch on.

    let flightPassengerIntervalId = null;

    /** How many real people are on this exact flight right now, including
     *  this learner once their own session is running — see
     *  knownFlightPassengerCount's own comment for who reads this. */
    async function refreshFlightPassengerCount() {
        const flight = mode === 'focus' ? currentFocusFlight() : null;
        if (!flight || !TFS.Presence || !TFS.Presence.isAvailable()) {
            knownFlightPassengerCount = 1; // just yourself, as flavor
            renderFlightWindows(knownFlightPassengerCount);
            return;
        }
        const n = await TFS.Presence.fetchFlightCount(flight.id);
        if (!isActive()) return; // the learner navigated away while this was in flight
        if (n === null) return; // couldn't check — leave the last known count as-is rather than guess

        // A heartbeat only exists once a session is actually running (see
        // start()), so `n` only counts *this* learner once they've joined —
        // before that, `n` is purely "other people already flying" and
        // needs +1 for the window display to read as "yourself plus
        // however many others", the same framing either way.
        knownFlightPassengerCount = isRunning() ? n : n + 1;
        renderFlightWindows(knownFlightPassengerCount);
    }

    function initFlightPassengerUpdates() {
        refreshFlightPassengerCount();
        if (flightPassengerIntervalId === null) flightPassengerIntervalId = setInterval(refreshFlightPassengerCount, 30000);
    }

    function teardownFlightPassengerUpdates() {
        if (flightPassengerIntervalId !== null) { clearInterval(flightPassengerIntervalId); flightPassengerIntervalId = null; }
    }

    // ---------------------------------------------------------------- Wiring

    I18n.onChange(() => { if (isActive()) render(); });
    State.subscribe(() => { if (isActive()) render(); });

    TFS.Router.register('screen6', {
        onEnter: () => {
            TFS.Nav.show(); TFS.Nav.setActive('focus');
            loadRuntimeFromState();
            render();
            initFlightPassengerUpdates();
            // Leaflet sizes itself against its container at creation time;
            // re-checking on every re-entry to this screen (a standard
            // Leaflet pattern for a map inside a show/hide container) fixes
            // it up if that container's size was still settling the very
            // first time the map was created.
            if (flightMap) { try { flightMap.invalidateSize(); } catch (e) { /* non-fatal — see renderFlightPlane's own guard */ } }
        },
        onLeave: () => {
            // Leaving the focus screen for another in-app screen pauses the
            // run — see the file header for why this is a deliberate
            // product choice, not the bug this file fixes. Immersive mode
            // is forced closed too: it's fixed-position and otherwise
            // wouldn't be torn down by this screen simply being hidden,
            // which would leave the whole app unscrollable behind it.
            exitImmersive();
            pause();
            teardownFlightPassengerUpdates();
        }
    });

    // A small read-only surface for js/pilotClub.js ("Mine") — the
    // scenario list and map style keys, so that file doesn't need its own
    // copy of either to stay in sync with.
    TFS.Focus = { SCENARIOS, MAP_STYLE_KEYS: Object.keys(MAP_STYLES) };

})(window);
