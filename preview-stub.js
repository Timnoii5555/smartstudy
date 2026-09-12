/**
 * preview-stub.js — PORTFOLIO KIT ONLY, not part of the shipped app.
 *
 * Loaded as the very first <script> in preview-app.html (a verbatim copy of
 * the real index.html), before any real project file runs. It does exactly
 * two things, both read by js/auth.js and js/storage.js at face value —
 * neither file has been modified to accommodate this:
 *
 *   1. Installs a `window.firebase` object with the same surface the real
 *      Firebase compat SDK exposes (initializeApp/.auth()/.firestore()),
 *      backed by canned data — instead of the real gstatic.com SDK, which
 *      an Artifact's CSP blocks outright, and which would otherwise try to
 *      make real network calls to the live smartstudy-7a7cc project.
 *   2. Pre-seeds localStorage with one realistic "2-3 weeks in" demo
 *      profile, in the exact shape js/storage.js's defaultState() defines,
 *      under the exact keys js/storage.js reads (tfs:v1:activeProfile,
 *      tfs:v1:state:<id>) — so the real app boots straight into a lived-in
 *      account instead of a first-run empty state.
 *
 * All dates are computed relative to whatever "today" actually is when this
 * loads (not hardcoded), so the preview stays internally consistent — the
 * reading plan, the exam countdown and the weekly schedule all line up with
 * the real date arithmetic in js/planner.js and js/utils.js — no matter
 * which day someone opens this Portfolio Kit.
 */
(function () {
    'use strict';

    // ---------------------------------------------------------------- Date helpers
    // Mirrors js/utils.js's own formatDateISO/addDays/startOfWeekMonday exactly
    // (local-time, not UTC) so the seed lines up with what the real code computes.
    function pad2(n) { return n.toString().padStart(2, '0'); }
    function iso(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
    function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
    function startOfWeekMonday(d) {
        const day = d.getDay();
        const diffToMonday = day === 0 ? 6 : day - 1;
        return addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -diffToMonday);
    }

    const today = new Date();
    const todayISO = iso(today);
    const weekStart = startOfWeekMonday(today);
    const examDateISO = iso(addDays(today, 45));

    // ---------------------------------------------------------------- Mock Firebase
    // Shaped to match exactly what js/auth.js calls: app.auth(), app.firestore(),
    // firebase.firestore.FieldValue.serverTimestamp(). Nothing more.
    const DEMO_UID = 'demo-pan';
    const DEMO_USER = {
        uid: DEMO_UID,
        email: 'pan.demo@example.com',
        displayName: 'ปัญ',
        updateProfile: function () { return Promise.resolve(); }
    };

    // Shared "Firestore" backing store — a plain object keyed by
    // "collection/doc", so .set()/.get()/.update() all agree with each other
    // the same way real Firestore would across calls in one session.
    const firestoreDocs = {
        'users/demo-pan': { displayName: 'ปัญ', avatarURL: null, points: 245 },
        'users/u1': { displayName: 'แนน', avatarURL: null, points: 890 },
        'users/u2': { displayName: 'โบ๊ท', avatarURL: null, points: 610 },
        'users/u3': { displayName: 'มายด์', avatarURL: null, points: 505 },
        'users/u5': { displayName: 'เจได', avatarURL: null, points: 180 }
    };

    function mockDocRef(path) {
        return {
            get: function () {
                const data = firestoreDocs[path];
                return Promise.resolve({ exists: !!data, id: path.split('/')[1], data: function () { return data; } });
            },
            set: function (data, opts) {
                if (opts && opts.merge && firestoreDocs[path]) Object.assign(firestoreDocs[path], data);
                else firestoreDocs[path] = data;
                return Promise.resolve();
            }
        };
    }

    const mockFirestore = {
        collection: function (name) {
            return {
                doc: function (id) { return mockDocRef(name + '/' + id); },
                orderBy: function () {
                    return {
                        limit: function () {
                            return {
                                get: function () {
                                    const rows = Object.keys(firestoreDocs)
                                        .filter(function (k) { return k.indexOf(name + '/') === 0; })
                                        .map(function (k) { return { id: k.split('/')[1], data: function () { return firestoreDocs[k]; } }; })
                                        .sort(function (a, b) { return b.data().points - a.data().points; });
                                    return Promise.resolve({ docs: rows });
                                }
                            };
                        }
                    };
                }
            };
        }
    };

    const mockAuth = {
        onAuthStateChanged: function (cb) { setTimeout(function () { cb(DEMO_USER); }, 0); return function () {}; },
        signInWithEmailAndPassword: function () { return Promise.resolve({ user: DEMO_USER }); },
        createUserWithEmailAndPassword: function () { return Promise.resolve({ user: DEMO_USER }); },
        sendPasswordResetEmail: function () { return Promise.resolve(); },
        signOut: function () { return Promise.resolve(); },
        currentUser: DEMO_USER
    };

    window.firebase = {
        initializeApp: function () { return { auth: function () { return mockAuth; }, firestore: function () { return mockFirestore; } }; },
        firestore: { FieldValue: { serverTimestamp: function () { return new Date().toISOString(); } } }
    };

    // ---------------------------------------------------------------- Seeded app state
    // Exactly the shape js/storage.js's defaultState() defines — this is what
    // load() merges onto, so any field left out here still falls back safely.
    const seedState = {
        schemaVersion: 1,
        settings: {
            language: 'th', theme: 'system', soundEnabled: true,
            ambientType: 'rain', ambientVolume: 0.6,
            pomodoro: { focusMin: 25, shortBreakMin: 5, longBreakMin: 15, cyclesBeforeLongBreak: 4 }
        },
        plan: {
            subject: 'tgat',
            examDateISO: examDateISO,
            dailyGoalSeconds: 4.5 * 3600,
            orderStrategy: 'balanced',
            completedSubjects: [],
            readAheadUntilDate: null,
            // Real js/planner.js shape: days is a flat list of {dateISO, topicIds}.
            // Two days already behind "today" (all done), today's own day still
            // has one topic open, and the 8th topic is scheduled two days out —
            // so the dashboard shows real, partial, in-progress state.
            readingPlan: {
                subjectId: 'tgat', orderStrategy: 'balanced', generatedAt: iso(addDays(today, -14)),
                days: [
                    { dateISO: iso(addDays(today, -6)), topicIds: ['tgat-eng-listen-read', 'tgat-eng-write-vocab'] },
                    { dateISO: iso(addDays(today, -3)), topicIds: ['tgat-reason-logic', 'tgat-reason-numeric'] },
                    { dateISO: todayISO, topicIds: ['tgat-work-innovation', 'tgat-work-problem', 'tgat-work-emotion'] },
                    { dateISO: iso(addDays(today, 2)), topicIds: ['tgat-mock'] }
                ]
            }
        },
        syllabusProgress: {
            tgat: {
                'tgat-eng-listen-read': { completedAt: addDays(today, -6).toISOString() },
                'tgat-eng-write-vocab': { completedAt: addDays(today, -6).toISOString() },
                'tgat-reason-logic': { completedAt: addDays(today, -3).toISOString() },
                'tgat-reason-numeric': { completedAt: addDays(today, -3).toISOString() },
                'tgat-work-innovation': { completedAt: today.toISOString() }
            }
        },
        customSubjects: [],
        schedule: {
            // Anchored to THIS week's Monday/Wednesday/Friday, not to "today +N",
            // so it always falls inside the schedule screen's default (current
            // week) view regardless of which weekday this is opened on.
            sessions: [
                { id: 'demo-sess-1', dateISO: iso(addDays(weekStart, 0)), startMin: 9 * 60, endMin: 11 * 60, topicId: 'tgat-work-problem', subjectId: 'tgat', color: 'blue', completed: false },
                { id: 'demo-sess-2', dateISO: iso(addDays(weekStart, 2)), startMin: 19 * 60, endMin: 20 * 60 + 30, topicId: 'tgat-work-emotion', subjectId: 'tgat', color: 'green', completed: false },
                { id: 'demo-sess-3', dateISO: iso(addDays(weekStart, 4)), startMin: 9 * 60, endMin: 10 * 60 + 30, topicId: 'tgat-mock', subjectId: 'tgat', color: 'orange', completed: false }
            ]
        },
        flashcards: {
            // Same 3 real starter cards data/subjects.js ships for TGAT.
            decks: {
                'deck-tgat-starter': {
                    id: 'deck-tgat-starter', subjectId: 'tgat', name: 'TGAT',
                    cards: [
                        { id: 'card-1', term: 'Aptitude', def: 'ความถนัด, ความสามารถที่มีมาแต่กำเนิดหรือฝึกฝนได้', ex: 'She has a natural aptitude for languages.' },
                        { id: 'card-2', term: 'Reasoning', def: 'การให้เหตุผล, กระบวนการคิดอย่างมีตรรกะ', ex: 'Logical reasoning is tested in the TGAT exam.' },
                        { id: 'card-3', term: 'Competency', def: 'สมรรถนะ, ความสามารถที่จำเป็นต่อการทำงาน', ex: 'Teamwork is a key workplace competency.' }
                    ]
                }
            },
            deckOrder: ['deck-tgat-starter'],
            currentDeckId: 'deck-tgat-starter'
        },
        focus: {
            totalSecondsByDate: (function () { const o = {}; o[todayISO] = 2 * 3600 + 15 * 60; return o; })(),
            mode: 'focus',
            phaseRemainingSeconds: 18 * 60 + 47,
            cyclesCompletedToday: 1,
            lastActiveDateISO: todayISO
        },
        ui: { lastScreen: 'screen3', hasSeenQuestIntro: true },
        quests: {
            dateISO: todayISO,
            progress: { 'complete-topic': 1, 'focus-session': 1, 'flashcard-review': 6, 'daily-goal': 0 },
            claimed: { 'complete-topic': true }
        },
        points: { total: 245 }
    };

    try {
        localStorage.setItem('tfs:v1:activeProfile', 'fb:' + DEMO_UID);
        localStorage.setItem('tfs:v1:state:fb:' + DEMO_UID, JSON.stringify(seedState));
    } catch (e) { /* private-browsing or storage disabled — the real app's own fallbacks handle this */ }

})();
