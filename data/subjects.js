/**
 * data/subjects.js
 * Domain content for the three supported exams: subject metadata, syllabus
 * topics, and starter flashcard decks. This used to be hardcoded inline in
 * the app's <script> block (`syllabusDB`, `customDecksDB`); it now lives in
 * its own data file so adding/editing a subject never requires touching
 * application logic (Part 4 "un-hardcode the data").
 *
 * This is a plain script (not fetched JSON) on purpose: opening the app via
 * file:// blocks fetch() of local files under Chrome's CORS rules, but a
 * classic <script src="data/subjects.js"> tag loads fine either way.
 *
 * Every learner-facing string is `{ th, en }` so the language switch (3.1)
 * translates this content too — read it with `TFS.I18n.pick(obj)`.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};

    const SUBJECTS = [
        {
            id: 'tgat',
            code: 'TGAT',
            name: { th: 'TGAT', en: 'TGAT' },
            description: { th: 'Thai General Aptitude Test', en: 'Thai General Aptitude Test' },
            icon: 'school',
            colorToken: 'primary',
            topics: [
                { id: 'tgat-eng', label: { th: 'อังกฤษเพื่อการสื่อสาร', en: 'English communication' } },
                { id: 'tgat-reason', label: { th: 'การคิดอย่างมีเหตุผล', en: 'Critical & logical thinking' } },
                { id: 'tgat-work', label: { th: 'สมรรถนะการทำงาน', en: 'Future workforce competencies' } },
                { id: 'tgat-mock', label: { th: 'แนวข้อสอบ TGAT', en: 'TGAT past-paper practice' } }
            ]
        },
        {
            id: 'tpat3',
            code: 'TPAT3',
            name: { th: 'TPAT3', en: 'TPAT3' },
            description: { th: 'ความถนัดทางวิศวกรรมศาสตร์', en: 'Engineering aptitude test' },
            icon: 'engineering',
            colorToken: 'secondary',
            topics: [
                { id: 'tpat3-numeric', label: { th: 'ความถนัดเชิงตัวเลข', en: 'Numerical aptitude' } },
                { id: 'tpat3-spatial', label: { th: 'มิติสัมพันธ์', en: 'Spatial reasoning' } },
                { id: 'tpat3-physics', label: { th: 'ฟิสิกส์วิศวกรรม', en: 'Engineering physics' } },
                { id: 'tpat3-mechanical', label: { th: 'ความถนัดเชิงช่าง', en: 'Mechanical aptitude' } }
            ]
        },
        {
            id: 'a-level',
            code: 'A-Level',
            name: { th: 'A-Level', en: 'A-Level' },
            description: { th: 'วิชาสามัญประยุกต์ (คณิต, ฟิสิกส์)', en: 'Applied core subjects (math, physics)' },
            icon: 'auto_stories',
            colorToken: 'tertiary',
            topics: [
                { id: 'alevel-calc', label: { th: 'แคลคูลัสประยุกต์', en: 'Applied calculus' } },
                { id: 'alevel-electricity', label: { th: 'ฟิสิกส์: ไฟฟ้า', en: 'Physics: electricity' } },
                { id: 'alevel-atom', label: { th: 'เคมี: อะตอม', en: 'Chemistry: atomic structure' } },
                { id: 'alevel-logic', label: { th: 'ตรรกศาสตร์ประยุกต์', en: 'Applied logic' } },
                { id: 'alevel-stats', label: { th: 'สถิติและความน่าจะเป็น', en: 'Statistics & probability' } }
            ]
        }
    ];

    function getSubjects() { return SUBJECTS; }
    function getSubject(id) { return SUBJECTS.find(s => s.id === id) || null; }

    /**
     * Fresh copy of the starter flashcard decks, keyed by a stable id so they
     * merge predictably into state.flashcards.decks. Only used to seed a
     * brand-new install (see storage.js `defaultState()`); once the user has
     * saved any state, whatever is in localStorage is authoritative — a
     * deleted starter deck must stay deleted (see Utils.ATOMIC_STATE_PATHS).
     */
    function createStarterDecks() {
        const decks = {};
        const def = (deckId, subjectId, name, cards) => {
            decks[deckId] = {
                id: deckId,
                subjectId,
                name,
                cards: cards.map(c => ({ id: TFS.Utils.uuid(), term: c.term, def: c.def, ex: c.ex || '' }))
            };
        };

        def('deck-tgat-starter', 'tgat', 'TGAT', [
            { term: 'Aptitude', def: 'ความถนัด, ความสามารถที่มีมาแต่กำเนิดหรือฝึกฝนได้', ex: 'She has a natural aptitude for languages.' },
            { term: 'Reasoning', def: 'การให้เหตุผล, กระบวนการคิดอย่างมีตรรกะ', ex: 'Logical reasoning is tested in the TGAT exam.' },
            { term: 'Competency', def: 'สมรรถนะ, ความสามารถที่จำเป็นต่อการทำงาน', ex: 'Teamwork is a key workplace competency.' }
        ]);

        def('deck-tpat3-starter', 'tpat3', 'TPAT3', [
            { term: 'Velocity', def: 'ความเร็ว (ปริมาณเวกเตอร์)', ex: 'v = s/t (ทิศทางสำคัญ)' },
            { term: 'Friction', def: 'แรงเสียดทาน', ex: 'Friction opposes motion.' },
            { term: 'Torque', def: 'แรงบิด, โมเมนต์ของแรง', ex: 'Torque = force × distance from the pivot.' }
        ]);

        def('deck-alevel-starter', 'a-level', 'A-Level', [
            { term: 'Derivative', def: 'อนุพันธ์ อัตราการเปลี่ยนแปลงของฟังก์ชัน', ex: "The derivative of x² is 2x." },
            { term: 'Voltage', def: 'แรงดันไฟฟ้า, ความต่างศักย์ไฟฟ้า', ex: 'Voltage is measured in volts.' },
            { term: 'Isotope', def: 'ไอโซโทป ธาตุชนิดเดียวกันที่มีจำนวนนิวตรอนต่างกัน', ex: 'Carbon-14 is an isotope of carbon.' }
        ]);

        return decks;
    }

    TFS.Data = { getSubjects, getSubject, createStarterDecks };

})(window);
