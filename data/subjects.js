/**
 * data/subjects.js
 * Domain content for the TCAS exam lineup (TGAT, TPAT1-5, and the A-Level
 * subjects), the applications-track exams every Thai student preparing for
 * university admission actually sits. This used to be hardcoded inline in
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
 *
 * Each topic also carries:
 *   - `difficulty` (1 easy .. 3 hard) — lets the "จัดลำดับการอ่าน" (reading
 *     order) picker in screen 2 offer an easy-first or hard-first sort.
 *   - `estMinutes` — a rough real-world study-time estimate, in minutes, for
 *     that one topic. js/planner.js sums these against the daily study-hour
 *     budget to spread a subject's topics across the days left until the
 *     exam date, instead of dumping the whole syllabus on day one.
 * Neither field is exact science — they are reasonable planning defaults a
 * student can always deviate from, not a guarantee.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};

    const SUBJECTS = [
        {
            id: 'tgat',
            code: 'TGAT',
            name: { th: 'TGAT', en: 'TGAT' },
            description: { th: 'ความถนัดทั่วไป (3 พาร์ท)', en: 'Thai General Aptitude Test (3 parts)' },
            icon: 'school',
            colorToken: 'primary',
            topics: [
                { id: 'tgat-eng-listen-read', label: { th: 'TGAT1: การฟัง-อ่านภาษาอังกฤษเพื่อความเข้าใจ', en: 'TGAT1: English listening & reading comprehension' }, difficulty: 2, estMinutes: 180 },
                { id: 'tgat-eng-write-vocab', label: { th: 'TGAT1: ศัพท์และไวยากรณ์เพื่อการสื่อสาร', en: 'TGAT1: Vocabulary & grammar for communication' }, difficulty: 2, estMinutes: 150 },
                { id: 'tgat-reason-logic', label: { th: 'TGAT2: การคิดอย่างมีเหตุผลเชิงตรรกะ', en: 'TGAT2: Logical & critical reasoning' }, difficulty: 3, estMinutes: 180 },
                { id: 'tgat-reason-numeric', label: { th: 'TGAT2: การวิเคราะห์ข้อมูลเชิงตัวเลข', en: 'TGAT2: Quantitative data analysis' }, difficulty: 3, estMinutes: 150 },
                { id: 'tgat-work-innovation', label: { th: 'TGAT3: การสร้างคุณค่าและนวัตกรรม', en: 'TGAT3: Creativity & value creation' }, difficulty: 1, estMinutes: 90 },
                { id: 'tgat-work-problem', label: { th: 'TGAT3: การแก้ไขปัญหาที่ซับซ้อน', en: 'TGAT3: Complex problem-solving' }, difficulty: 2, estMinutes: 120 },
                { id: 'tgat-work-emotion', label: { th: 'TGAT3: การบริหารจัดการอารมณ์และการเป็นพลเมืองดี', en: 'TGAT3: Emotional management & citizenship' }, difficulty: 1, estMinutes: 90 },
                { id: 'tgat-mock', label: { th: 'ฝึกทำแนวข้อสอบ TGAT ทั้ง 3 พาร์ท', en: 'Full TGAT past-paper practice (all 3 parts)' }, difficulty: 2, estMinutes: 180 }
            ]
        },
        {
            id: 'tpat1',
            code: 'TPAT1',
            name: { th: 'TPAT1 (กสพท)', en: 'TPAT1 (Medical)' },
            description: { th: 'ความถนัดแพทย์ (แพทย์ ทันตะ สัตวะ เภสัช)', en: 'Medical aptitude (medicine, dentistry, vet, pharmacy)' },
            icon: 'medical_services',
            colorToken: 'secondary',
            topics: [
                { id: 'tpat1-ethics', label: { th: 'จริยธรรมทางการแพทย์และจรรยาบรรณวิชาชีพ', en: 'Medical ethics & professional conduct' }, difficulty: 2, estMinutes: 150 },
                { id: 'tpat1-connect', label: { th: 'ความคิดเชื่อมโยง (Connective Thinking)', en: 'Connective thinking' }, difficulty: 3, estMinutes: 180 },
                { id: 'tpat1-logic-read', label: { th: 'ตรรกะและการอ่านเชิงวิเคราะห์', en: 'Logic & analytical reading' }, difficulty: 3, estMinutes: 180 },
                { id: 'tpat1-scenario', label: { th: 'สถานการณ์จำลองทางการแพทย์', en: 'Simulated medical situations' }, difficulty: 2, estMinutes: 120 }
            ]
        },
        {
            id: 'tpat2',
            code: 'TPAT2',
            name: { th: 'TPAT2', en: 'TPAT2' },
            description: { th: 'ความถนัดทางศิลปกรรมศาสตร์', en: 'Fine & applied arts aptitude' },
            icon: 'palette',
            colorToken: 'tertiary',
            topics: [
                { id: 'tpat2-visual', label: { th: 'ทัศนศิลป์ (วาดเส้น องค์ประกอบศิลป์)', en: 'Visual arts (drawing, composition)' }, difficulty: 2, estMinutes: 180 },
                { id: 'tpat2-music', label: { th: 'ดนตรี (ทฤษฎีและโสตทักษะ)', en: 'Music (theory & ear training)' }, difficulty: 2, estMinutes: 150 },
                { id: 'tpat2-performance', label: { th: 'นาฏศิลป์และการแสดง', en: 'Dance & performing arts' }, difficulty: 2, estMinutes: 120 },
                { id: 'tpat2-creative', label: { th: 'ความคิดสร้างสรรค์เชิงศิลปะ', en: 'Artistic creative thinking' }, difficulty: 1, estMinutes: 90 }
            ]
        },
        {
            id: 'tpat3',
            code: 'TPAT3',
            name: { th: 'TPAT3', en: 'TPAT3' },
            description: { th: 'ความถนัดทางวิทยาศาสตร์ เทคโนโลยี และวิศวกรรมศาสตร์', en: 'Science, technology & engineering aptitude' },
            icon: 'engineering',
            colorToken: 'secondary',
            topics: [
                { id: 'tpat3-numeric', label: { th: 'ความถนัดเชิงตัวเลข', en: 'Numerical aptitude' }, difficulty: 2, estMinutes: 150 },
                { id: 'tpat3-spatial', label: { th: 'มิติสัมพันธ์ (Spatial reasoning)', en: 'Spatial reasoning' }, difficulty: 2, estMinutes: 150 },
                { id: 'tpat3-physics', label: { th: 'ฟิสิกส์วิศวกรรมเบื้องต้น', en: 'Basic engineering physics' }, difficulty: 3, estMinutes: 180 },
                { id: 'tpat3-mechanical', label: { th: 'ความถนัดเชิงช่างและกลไก', en: 'Mechanical aptitude' }, difficulty: 2, estMinutes: 120 },
                { id: 'tpat3-scitech', label: { th: 'หลักการวิทยาศาสตร์และเทคโนโลยีประยุกต์', en: 'Applied science & technology principles' }, difficulty: 2, estMinutes: 150 }
            ]
        },
        {
            id: 'tpat4',
            code: 'TPAT4',
            name: { th: 'TPAT4', en: 'TPAT4' },
            description: { th: 'ความถนัดทางสถาปัตยกรรมศาสตร์', en: 'Architecture aptitude' },
            icon: 'architecture',
            colorToken: 'tertiary',
            topics: [
                { id: 'tpat4-creative-design', label: { th: 'ความคิดสร้างสรรค์และการออกแบบ', en: 'Creative & design thinking' }, difficulty: 2, estMinutes: 180 },
                { id: 'tpat4-spatial', label: { th: 'การรับรู้เชิงพื้นที่ (Spatial perception)', en: 'Spatial perception' }, difficulty: 2, estMinutes: 150 },
                { id: 'tpat4-drawing', label: { th: 'การวาดเส้นและสัดส่วน', en: 'Drawing & proportion' }, difficulty: 2, estMinutes: 150 },
                { id: 'tpat4-basics', label: { th: 'ความรู้พื้นฐานทางสถาปัตยกรรม', en: 'Basic architecture knowledge' }, difficulty: 1, estMinutes: 120 }
            ]
        },
        {
            id: 'tpat5',
            code: 'TPAT5',
            name: { th: 'TPAT5', en: 'TPAT5' },
            description: { th: 'ความถนัดทางครุศาสตร์-ศึกษาศาสตร์', en: 'Education & teaching aptitude' },
            icon: 'psychology',
            colorToken: 'primary',
            topics: [
                { id: 'tpat5-teacher-mindset', label: { th: 'ความเป็นครูและจรรยาบรรณวิชาชีพ', en: 'Teacher identity & professional ethics' }, difficulty: 1, estMinutes: 120 },
                { id: 'tpat5-psychology', label: { th: 'จิตวิทยาการเรียนรู้และพัฒนาการ', en: 'Learning & developmental psychology' }, difficulty: 2, estMinutes: 150 },
                { id: 'tpat5-reasoning', label: { th: 'การคิดวิเคราะห์และเหตุผลเชิงเหตุผล', en: 'Analytical & logical reasoning' }, difficulty: 2, estMinutes: 150 },
                { id: 'tpat5-thai-teaching', label: { th: 'ภาษาไทยเพื่อการสื่อสารในการสอน', en: 'Thai for teaching communication' }, difficulty: 1, estMinutes: 120 }
            ]
        },
        {
            id: 'alevel-thai',
            code: 'A-Level ไทย',
            name: { th: 'A-Level ภาษาไทย', en: 'A-Level Thai' },
            description: { th: 'หลักภาษา วรรณคดี และการอ่านจับใจความ', en: 'Grammar, literature & reading comprehension' },
            icon: 'menu_book',
            colorToken: 'primary',
            topics: [
                { id: 'alevel-thai-grammar', label: { th: 'หลักภาษาไทย (ไวยากรณ์ ชนิดคำ ประโยค)', en: 'Thai grammar (word types, sentence structure)' }, difficulty: 2, estMinutes: 180 },
                { id: 'alevel-thai-reading', label: { th: 'การอ่านจับใจความและตีความ', en: 'Reading comprehension & interpretation' }, difficulty: 2, estMinutes: 180 },
                { id: 'alevel-thai-lit', label: { th: 'วรรณคดีและวรรณกรรมไทย', en: 'Thai literature' }, difficulty: 3, estMinutes: 210 },
                { id: 'alevel-thai-writing', label: { th: 'การเขียนและการใช้เหตุผล', en: 'Writing & argumentation' }, difficulty: 2, estMinutes: 150 }
            ]
        },
        {
            id: 'alevel-social',
            code: 'A-Level สังคม',
            name: { th: 'A-Level สังคมศึกษา', en: 'A-Level Social Studies' },
            description: { th: 'ศาสนา หน้าที่พลเมือง เศรษฐศาสตร์ ประวัติศาสตร์ ภูมิศาสตร์', en: 'Religion, civics, economics, history, geography' },
            icon: 'public',
            colorToken: 'secondary',
            topics: [
                { id: 'alevel-social-religion', label: { th: 'ศาสนา ศีลธรรม จริยธรรม', en: 'Religion & ethics' }, difficulty: 1, estMinutes: 120 },
                { id: 'alevel-social-civics', label: { th: 'หน้าที่พลเมือง วัฒนธรรม และการเมืองการปกครอง', en: 'Civics, culture & government' }, difficulty: 2, estMinutes: 150 },
                { id: 'alevel-social-econ', label: { th: 'เศรษฐศาสตร์เบื้องต้น', en: 'Basic economics' }, difficulty: 2, estMinutes: 150 },
                { id: 'alevel-social-history', label: { th: 'ประวัติศาสตร์ไทยและสากล', en: 'Thai & world history' }, difficulty: 2, estMinutes: 180 },
                { id: 'alevel-social-geo', label: { th: 'ภูมิศาสตร์และทรัพยากรธรรมชาติ', en: 'Geography & natural resources' }, difficulty: 1, estMinutes: 120 }
            ]
        },
        {
            id: 'alevel-eng',
            code: 'A-Level Eng',
            name: { th: 'A-Level ภาษาอังกฤษ', en: 'A-Level English' },
            description: { th: 'ไวยากรณ์ คำศัพท์ การอ่านและเขียนภาษาอังกฤษ', en: 'Grammar, vocabulary, reading & writing' },
            icon: 'translate',
            colorToken: 'tertiary',
            topics: [
                { id: 'alevel-eng-grammar', label: { th: 'Grammar & Structure', en: 'Grammar & structure' }, difficulty: 2, estMinutes: 180 },
                { id: 'alevel-eng-vocab', label: { th: 'Vocabulary in Context', en: 'Vocabulary in context' }, difficulty: 2, estMinutes: 150 },
                { id: 'alevel-eng-reading', label: { th: 'Reading Comprehension', en: 'Reading comprehension' }, difficulty: 3, estMinutes: 180 },
                { id: 'alevel-eng-writing', label: { th: 'Writing & Sentence Completion', en: 'Writing & sentence completion' }, difficulty: 2, estMinutes: 150 }
            ]
        },
        {
            id: 'alevel-math1',
            code: 'A-Level คณิต 1',
            name: { th: 'A-Level คณิตศาสตร์ประยุกต์ 1', en: 'A-Level Applied Math 1' },
            description: { th: 'สายวิทย์: พีชคณิต แคลคูลัส สถิติ', en: 'Science track: algebra, calculus, statistics' },
            icon: 'functions',
            colorToken: 'primary',
            topics: [
                { id: 'alevel-math1-algebra', label: { th: 'พีชคณิตและฟังก์ชัน', en: 'Algebra & functions' }, difficulty: 2, estMinutes: 180 },
                { id: 'alevel-math1-trig', label: { th: 'ตรีโกณมิติ', en: 'Trigonometry' }, difficulty: 2, estMinutes: 150 },
                { id: 'alevel-math1-geo', label: { th: 'เรขาคณิตวิเคราะห์และเวกเตอร์', en: 'Analytic geometry & vectors' }, difficulty: 3, estMinutes: 180 },
                { id: 'alevel-math1-calc', label: { th: 'แคลคูลัสเบื้องต้น (ลิมิต อนุพันธ์ ปริพันธ์)', en: 'Intro calculus (limits, derivatives, integrals)' }, difficulty: 3, estMinutes: 240 },
                { id: 'alevel-math1-stats', label: { th: 'สถิติและความน่าจะเป็น', en: 'Statistics & probability' }, difficulty: 2, estMinutes: 180 },
                { id: 'alevel-math1-matrix', label: { th: 'เมทริกซ์และจำนวนเชิงซ้อน', en: 'Matrices & complex numbers' }, difficulty: 3, estMinutes: 180 }
            ]
        },
        {
            id: 'alevel-math2',
            code: 'A-Level คณิต 2',
            name: { th: 'A-Level คณิตศาสตร์ประยุกต์ 2', en: 'A-Level Applied Math 2' },
            description: { th: 'สายศิลป์: พีชคณิตพื้นฐาน สถิติ การเงิน', en: 'Arts track: basic algebra, statistics, finance' },
            icon: 'calculate',
            colorToken: 'secondary',
            topics: [
                { id: 'alevel-math2-algebra', label: { th: 'พีชคณิตพื้นฐาน', en: 'Basic algebra' }, difficulty: 1, estMinutes: 150 },
                { id: 'alevel-math2-stats', label: { th: 'สถิติเบื้องต้น', en: 'Basic statistics' }, difficulty: 2, estMinutes: 150 },
                { id: 'alevel-math2-prob', label: { th: 'ความน่าจะเป็นเบื้องต้น', en: 'Basic probability' }, difficulty: 2, estMinutes: 120 },
                { id: 'alevel-math2-finance', label: { th: 'ดอกเบี้ยและคณิตศาสตร์การเงิน', en: 'Interest & financial math' }, difficulty: 2, estMinutes: 150 }
            ]
        },
        {
            id: 'alevel-sci',
            code: 'A-Level วิทย์',
            name: { th: 'A-Level วิทยาศาสตร์ประยุกต์', en: 'A-Level Applied Science' },
            description: { th: 'วิทยาศาสตร์กายภาพ ชีวภาพ และเคมีพื้นฐาน', en: 'Basic physical, biological & chemical science' },
            icon: 'science',
            colorToken: 'tertiary',
            topics: [
                { id: 'alevel-sci-physical', label: { th: 'วิทยาศาสตร์กายภาพพื้นฐาน', en: 'Basic physical science' }, difficulty: 2, estMinutes: 150 },
                { id: 'alevel-sci-bio', label: { th: 'ชีววิทยาพื้นฐาน', en: 'Basic biology' }, difficulty: 2, estMinutes: 150 },
                { id: 'alevel-sci-chem', label: { th: 'เคมีพื้นฐาน', en: 'Basic chemistry' }, difficulty: 2, estMinutes: 150 },
                { id: 'alevel-sci-thinking', label: { th: 'การคิดเชิงวิทยาศาสตร์และการทดลอง', en: 'Scientific thinking & experiments' }, difficulty: 1, estMinutes: 120 }
            ]
        },
        {
            id: 'alevel-physics',
            code: 'A-Level ฟิสิกส์',
            name: { th: 'A-Level ฟิสิกส์', en: 'A-Level Physics' },
            description: { th: 'กลศาสตร์ ไฟฟ้า คลื่น และฟิสิกส์แผนใหม่', en: 'Mechanics, electricity, waves & modern physics' },
            icon: 'bolt',
            colorToken: 'primary',
            topics: [
                { id: 'alevel-phys-mechanics', label: { th: 'กลศาสตร์ (แรง การเคลื่อนที่ พลังงาน)', en: 'Mechanics (force, motion, energy)' }, difficulty: 3, estMinutes: 210 },
                { id: 'alevel-phys-electric', label: { th: 'ไฟฟ้าและแม่เหล็ก', en: 'Electricity & magnetism' }, difficulty: 3, estMinutes: 210 },
                { id: 'alevel-phys-wave', label: { th: 'คลื่นและแสง', en: 'Waves & light' }, difficulty: 2, estMinutes: 180 },
                { id: 'alevel-phys-thermo', label: { th: 'ความร้อนและอุณหพลศาสตร์', en: 'Heat & thermodynamics' }, difficulty: 2, estMinutes: 150 },
                { id: 'alevel-phys-modern', label: { th: 'ฟิสิกส์อะตอมและนิวเคลียร์', en: 'Atomic & nuclear physics' }, difficulty: 3, estMinutes: 180 }
            ]
        },
        {
            id: 'alevel-chem',
            code: 'A-Level เคมี',
            name: { th: 'A-Level เคมี', en: 'A-Level Chemistry' },
            description: { th: 'โครงสร้างอะตอม พันธะเคมี และเคมีอินทรีย์', en: 'Atomic structure, bonding & organic chemistry' },
            icon: 'biotech',
            colorToken: 'secondary',
            topics: [
                { id: 'alevel-chem-atom', label: { th: 'โครงสร้างอะตอมและตารางธาตุ', en: 'Atomic structure & periodic table' }, difficulty: 2, estMinutes: 150 },
                { id: 'alevel-chem-bond', label: { th: 'พันธะเคมี', en: 'Chemical bonding' }, difficulty: 2, estMinutes: 150 },
                { id: 'alevel-chem-stoich', label: { th: 'ปริมาณสารสัมพันธ์', en: 'Stoichiometry' }, difficulty: 3, estMinutes: 180 },
                { id: 'alevel-chem-acidbase', label: { th: 'กรด-เบส และสมดุลเคมี', en: 'Acids, bases & chemical equilibrium' }, difficulty: 3, estMinutes: 180 },
                { id: 'alevel-chem-organic', label: { th: 'เคมีอินทรีย์', en: 'Organic chemistry' }, difficulty: 3, estMinutes: 210 },
                { id: 'alevel-chem-electro', label: { th: 'เคมีไฟฟ้า', en: 'Electrochemistry' }, difficulty: 2, estMinutes: 150 }
            ]
        },
        {
            id: 'alevel-bio',
            code: 'A-Level ชีวะ',
            name: { th: 'A-Level ชีววิทยา', en: 'A-Level Biology' },
            description: { th: 'เซลล์ พันธุศาสตร์ ร่างกายมนุษย์ และนิเวศวิทยา', en: 'Cells, genetics, human body & ecology' },
            icon: 'eco',
            colorToken: 'tertiary',
            topics: [
                { id: 'alevel-bio-cell', label: { th: 'เซลล์และสารชีวโมเลกุล', en: 'Cells & biomolecules' }, difficulty: 2, estMinutes: 180 },
                { id: 'alevel-bio-genetics', label: { th: 'พันธุศาสตร์และการถ่ายทอดลักษณะ', en: 'Genetics & heredity' }, difficulty: 3, estMinutes: 210 },
                { id: 'alevel-bio-human', label: { th: 'ระบบต่างๆ ในร่างกายมนุษย์', en: 'Human body systems' }, difficulty: 2, estMinutes: 210 },
                { id: 'alevel-bio-ecology', label: { th: 'นิเวศวิทยาและสิ่งแวดล้อม', en: 'Ecology & environment' }, difficulty: 1, estMinutes: 150 },
                { id: 'alevel-bio-evolution', label: { th: 'วิวัฒนาการและความหลากหลายทางชีวภาพ', en: 'Evolution & biodiversity' }, difficulty: 2, estMinutes: 150 }
            ]
        },
        {
            id: 'alevel-chinese',
            code: 'A-Level จีน',
            name: { th: 'A-Level ภาษาจีน', en: 'A-Level Chinese' },
            description: { th: 'ไวยากรณ์ คำศัพท์ และการอ่าน-ฟังภาษาจีน', en: 'Chinese grammar, vocabulary, reading & listening' },
            icon: 'language',
            colorToken: 'primary',
            topics: [
                { id: 'alevel-chinese-grammar', label: { th: 'ไวยากรณ์จีนพื้นฐาน', en: 'Basic Chinese grammar' }, difficulty: 2, estMinutes: 180 },
                { id: 'alevel-chinese-vocab', label: { th: 'คำศัพท์และตัวอักษรจีน (Hanzi)', en: 'Vocabulary & Chinese characters (Hanzi)' }, difficulty: 3, estMinutes: 210 },
                { id: 'alevel-chinese-reading', label: { th: 'การอ่านจับใจความภาษาจีน', en: 'Chinese reading comprehension' }, difficulty: 2, estMinutes: 180 }
            ]
        },
        {
            id: 'alevel-japanese',
            code: 'A-Level ญี่ปุ่น',
            name: { th: 'A-Level ภาษาญี่ปุ่น', en: 'A-Level Japanese' },
            description: { th: 'ไวยากรณ์ คำศัพท์ และการอ่าน-ฟังภาษาญี่ปุ่น', en: 'Japanese grammar, vocabulary, reading & listening' },
            icon: 'language',
            colorToken: 'secondary',
            topics: [
                { id: 'alevel-japanese-grammar', label: { th: 'ไวยากรณ์ญี่ปุ่นพื้นฐาน', en: 'Basic Japanese grammar' }, difficulty: 2, estMinutes: 180 },
                { id: 'alevel-japanese-kana-kanji', label: { th: 'ฮิรางานะ คาตากานะ และคันจิพื้นฐาน', en: 'Hiragana, katakana & basic kanji' }, difficulty: 3, estMinutes: 210 },
                { id: 'alevel-japanese-reading', label: { th: 'การอ่านจับใจความภาษาญี่ปุ่น', en: 'Japanese reading comprehension' }, difficulty: 2, estMinutes: 180 }
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

        def('deck-alevel-math1-starter', 'alevel-math1', 'A-Level คณิต 1', [
            { term: 'Derivative', def: 'อนุพันธ์ อัตราการเปลี่ยนแปลงของฟังก์ชัน', ex: "The derivative of x² is 2x." },
            { term: 'Vector', def: 'เวกเตอร์ ปริมาณที่มีทั้งขนาดและทิศทาง', ex: 'Force is a vector quantity.' },
            { term: 'Probability', def: 'ความน่าจะเป็น', ex: 'The probability of the event is 0.5.' }
        ]);

        def('deck-alevel-eng-starter', 'alevel-eng', 'A-Level English', [
            { term: 'Inference', def: 'การอนุมาน การสรุปความจากบริบท', ex: 'You can infer the meaning from context.' },
            { term: 'Synonym', def: 'คำพ้องความหมาย', ex: '"Happy" and "glad" are synonyms.' }
        ]);

        return decks;
    }

    TFS.Data = { getSubjects, getSubject, createStarterDecks };

})(window);
