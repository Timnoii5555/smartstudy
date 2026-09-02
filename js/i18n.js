/**
 * i18n.js
 * Every user-facing UI string lives in the TH/EN dictionaries below (Part 3.1).
 * Domain *content* (subject names, topic lists, default flashcards) is kept in
 * data/subjects.js instead, each string stored as `{ th, en }` — that is data,
 * not interface chrome, so it is looked up with `I18n.pick()` rather than `t()`.
 *
 * Markup opts in via attributes instead of hand-written text:
 *   data-i18n="key.path"                 -> element.textContent
 *   data-i18n-attr='{"placeholder":"key"}' -> sets attributes from key paths
 * `applyTranslations(root)` walks both and must be re-run after language
 * changes and after any dynamic HTML is injected.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};

    const DICT = {
        th: {
            brand: { full: 'The Focused Scholar', short: 'Smart Study' },
            common: {
                cancel: 'ยกเลิก', save: 'บันทึก', close: 'ปิด', confirm: 'ยืนยัน', delete: 'ลบ',
                add: 'เพิ่ม', edit: 'แก้ไข', back: 'กลับ', next: 'ถัดไป', today: 'วันนี้',
                loading: 'กำลังโหลด...', optional: 'ไม่บังคับ', hours: 'ชม.', minutes: 'นาที',
                noResults: 'ไม่พบผลลัพธ์', search: 'ค้นหา', settings: 'ตั้งค่า', on: 'เปิด', off: 'ปิด'
            },
            nav: { home: 'หน้าหลัก', schedule: 'ตาราง', flashcards: 'แฟลชการ์ด', focus: 'โฟกัส' },
            s0: {
                title: 'ใครจะอ่านหนังสือวันนี้?',
                subtitle: 'เลือกโปรไฟล์ของคุณ เพื่อให้เราจดจำความคืบหน้าของคุณโดยเฉพาะ',
                createTitle: 'สร้างโปรไฟล์ใหม่',
                nameLabel: 'ชื่อของคุณ',
                namePlaceholder: 'เช่น หนึ่ง',
                avatarLabel: 'เลือกไอคอนประจำตัว',
                createBtn: 'เริ่มอ่านหนังสือ',
                errName: 'กรุณาใส่ชื่อของคุณก่อนครับ',
                deleteProfile: 'ลบโปรไฟล์นี้',
                deleteConfirmTitle: 'ลบโปรไฟล์นี้?',
                deleteConfirmMsg: 'ข้อมูลทั้งหมดของ "{name}" (แผนการอ่าน คะแนน สถิติ) จะถูกลบอย่างถาวร',
            },
            s1: {
                stepLabel: 'ขั้นที่ {n} จาก 3',
                title: 'เป้าหมายของคุณ',
                subtitle: 'คุณกำลังเตรียมตัวสอบวิชาอะไรบ้าง?',
                hint: '*เลือกได้เพียง 1 วิชาเพื่อโฟกัสให้เต็มที่ (เรียนจบแล้วค่อยเลือกวิชาถัดไปได้)',
                topicsHeading: 'เนื้อหาที่ต้องอ่าน:',
                next: 'ถัดไป',
                errSelectSubject: 'กรุณาเลือกวิชาที่จะสอบก่อนครับ',
                completedTag: '✓ เรียนจบแล้ว'
            },
            s2: {
                title: 'กำหนดวันสอบและเวลาที่คุณมี',
                subtitle: 'ให้เราช่วยคำนวณแผนที่เหมาะสมกับไลฟ์สไตล์ของคุณที่สุด',
                examDateSection: 'วันสอบที่สำคัญที่สุดของคุณ',
                examDateFieldLabel: 'วัน / เดือน / ปี',
                examDatePlaceholder: 'เลือกวันสอบ...',
                dailyHoursSection: 'เวลาอ่านหนังสือต่อวัน',
                sliderEasy: 'ขยันเล็กน้อย', sliderHard: 'วิถีนักรบ',
                calcDefault: 'โปรดเลือกวันสอบด้านบนเพื่อคำนวณเวลาเตรียมตัวที่เหลือทั้งหมด 🎯',
                calcPast: 'วันสอบผ่านไปแล้ว!',
                calcToday: 'สอบวันนี้! มีเวลาทบทวน {hrs} ชม.',
                calcDaysLeft: 'เหลือเวลา {days} วัน (รวมเวลาอ่าน {total} ชม.)',
                generate: 'สร้างแผนการเรียนอัจฉริยะ',
                errSelectDate: 'เลือกวันสอบก่อนครับ 📅',
                orderSection: 'ลำดับการอ่าน',
                orderHint: 'อยากให้เราจัดลำดับหัวข้อในแต่ละวันแบบไหน?'
            },
            datePicker: { title: 'เลือกวันสอบ' },
            s3: {
                greeting: 'สวัสดี, สรุปผลวันนี้',
                subtitle: 'อัปเดตความก้าวหน้าของคุณด้านล่างได้เลย 🚀',
                progressTitle: 'ความก้าวหน้าเนื้อหาหลัก',
                readinessLabel: 'ความพร้อมสอบ',
                goalLabel: 'เป้าหมาย',
                completedLabel: 'เนื้อหาที่อ่านจบ',
                dailyGoalTag: 'เป้าหมายรายวัน',
                subjectLoading: 'เตรียมโหลดวิชา...',
                subjectPrefix: 'วิชา {subject}',
                progressCaption: 'ลุยเก็บเนื้อหาให้ครบ 100%',
                todoTitle: 'รายการสิ่งที่ต้องทำวันนี้',
                lessonsUnit: 'บท',
                tickHint: 'ติ๊กเมื่อเรียนจบ',
                emptyChecklist: 'ยังไม่มีวิชาที่เลือก กลับไปเลือกวิชาที่หน้าแรกก่อนนะครับ'
            },
            congrats: {
                title: 'ยินดีด้วย! 🎉',
                message: 'คุณทำภารกิจอ่านหนังสือครบ 100% แล้ว\nความพยายามของคุณยอดเยี่ยมมาก ขอให้โชคดีกับการสอบนะครับ!',
                close: 'ยอดเยี่ยม!',
                chooseNext: 'เลือกวิชาถัดไป'
            },
            s4: {
                title: 'ตารางเรียน',
                addSession: 'เพิ่มคาบเรียน',
                weekOf: 'สัปดาห์ {start} – {end}',
                thisWeek: 'สัปดาห์ปัจจุบัน',
                prevWeek: 'สัปดาห์ก่อนหน้า', nextWeek: 'สัปดาห์ถัดไป', jumpToday: 'วันนี้',
                searchPlaceholder: 'ค้นหาคาบเรียนหรือหัวข้อ...',
                searchTopicsHeading: 'หัวข้อในซิลลาบัส',
                searchSessionsHeading: 'คาบเรียนที่ตรงกัน',
                examIndicator: 'วันสอบ:',
                todoTitle: 'รายการสิ่งที่ต้องทำวันนี้',
                todoEmpty: 'ยังไม่มีคาบเรียนในตาราง เพิ่มคาบเรียนเพื่อสร้างรายการ',
                todoEmptyForWeek: 'ไม่มีคาบเรียนในสัปดาห์นี้',
                timeColumn: 'เวลา',
                prevMonth: 'เดือนก่อนหน้า', nextMonth: 'เดือนถัดไป'
            },
            colors: { blue: 'ฟ้า', orange: 'ส้ม', green: 'เขียว', purple: 'ม่วง', pink: 'ชมพู', red: 'แดง', teal: 'เขียวมิ้นท์' },
            modalAddClass: {
                title: 'เพิ่มคาบเรียน', topicLabel: 'เลือกหัวข้อย่อยที่จะอ่าน',
                colorLabel: 'สีประจำวิชา', dateLabel: 'วันที่เจาะจง',
                startLabel: 'เริ่มเวลา', endLabel: 'ถึงเวลา', save: 'บันทึกลงตาราง',
                errDateRequired: 'กรุณาเลือกวันที่', errTimeOrder: 'เวลาเริ่มต้องมาก่อนเวลาจบครับ',
                errTimeRange: 'กรุณาระบุเวลาในช่วง 00:00 - 24:00 น.',
                errOverlap: 'ช่วงเวลานี้ทับซ้อนกับคาบเรียนอื่นในวันเดียวกัน',
                saved: 'บันทึกคาบเรียนเรียบร้อยแล้ว'
            },
            modalDeleteClass: { title: 'ลบคาบเรียน', confirm: 'คุณต้องการลบวิชา {name} ออกจากตารางใช่หรือไม่?', ok: 'ลบทิ้ง' },
            modalTimePicker: { title: 'เลือกเวลา', confirm: 'ยืนยันเวลา' },
            modalDeckSelector: { title: 'เลือกชุดคำศัพท์', createNew: 'สร้างชุดคำศัพท์ใหม่', wordsCount: '{n} คำศัพท์' },
            modalDeleteCard: { title: 'ลบคำศัพท์', selectLabel: 'เลือกคำศัพท์ที่ต้องการลบ', warning: '*การลบคำศัพท์จะไม่สามารถกู้คืนได้', ok: 'ลบคำศัพท์' },
            modalAddCard: { title: 'เพิ่มคำศัพท์ใหม่', termLabel: 'คำศัพท์', defLabel: 'ความหมาย', exampleLabel: 'ตัวอย่างประโยค', save: 'เพิ่มคำศัพท์', errRequired: 'กรุณากรอกคำศัพท์และความหมายให้ครบครับ' },
            modalAddDeck: { title: 'สร้างชุดคำศัพท์', nameLabel: 'ชื่อชุดคำศัพท์', namePlaceholder: 'เช่น สังคมศึกษา, ชีววิทยา', errRequired: 'กรุณาตั้งชื่อชุดคำศัพท์ครับ', errExists: 'ชื่อชุดคำศัพท์นี้มีอยู่แล้วครับ' },
            s5: {
                title: 'คลังศัพท์', deckLabel: 'ชุดคำศัพท์:', progressCount: '{current} / {total} คำ',
                term: 'ศัพท์', hintTap: 'แตะเพื่อดูความหมาย', meaning: 'ความหมาย',
                example: 'ตัวอย่าง: {ex}', noExample: 'ไม่มีตัวอย่างประโยค',
                reviewAgain: 'ข้าม / ยังไม่แม่น', remembered: 'จำได้แล้ว / ไปต่อ',
                emptyTitle: 'ชุดคำศัพท์นี้ยังว่างเปล่า', emptyHint: 'กด + มุมขวาบนเพื่อเพิ่มศัพท์ได้เลย',
                perfectTitle: 'ยอดเยี่ยมมาก! 🎉', perfectHint: 'คุณจำคำศัพท์ได้ครบ 100% แล้วในรอบนี้',
                summaryTitle: 'สรุปผลการทบทวน', summaryHint: 'ทบทวนต่ออีกนิดเพื่อความแม่นยำ!',
                restartWrong: 'เริ่มทบทวนคำที่ยังไม่แม่น', restartWrongCount: 'เริ่มทบทวนคำที่ยังไม่แม่น ({n} คำ)',
                reviewAll: 'ทบทวนใหม่ทั้งหมดทุกคำ',
                correctCount: 'จำได้แม่น: {n} คำ', wrongCount: 'ต้องทวนซ้ำ: {n} คำ', accuracy: 'ความแม่นยำรอบนี้: {pct}%',
                tip: 'แตะที่การ์ดเพื่อดูเฉลย และกดเลือกเพื่อบันทึกสถิติ',
                selectDeckFirst: 'กรุณาสร้างชุดคำศัพท์ก่อนครับ'
            },
            s6: {
                title: 'โหมดโฟกัส', subtitle: 'ตัดสิ่งรบกวนและเริ่มสร้างสรรค์ผลงาน',
                phaseFocus: 'โฟกัส', phaseShortBreak: 'พักสั้น', phaseLongBreak: 'พักยาว',
                cycleLabel: 'รอบที่ {current} / {total}',
                mainGoal: 'เป้าหมายหลัก',
                start: 'เริ่มจับเวลา', pause: 'หยุดพัก', resume: 'ทำต่อ', reset: 'รีเซ็ต',
                soundToggleLabel: 'เสียงแจ้งเตือนเมื่อครบเวลา',
                ambientLabel: 'เสียงบรรยากาศ (Ambient)', ambientBrown: 'เสียงสีน้ำตาล', ambientRain: 'เสียงฝน',
                ambientAddCustom: 'เพิ่มเสียงของฉัน', ambientUploadSuccess: 'เพิ่มเสียงเรียบร้อยแล้ว',
                ambientUploadError: 'ไม่สามารถบันทึกไฟล์เสียงนี้ได้', ambientCustomError: 'เล่นไฟล์เสียงนี้ไม่ได้ ขอเปลี่ยนเป็นเสียงสีน้ำตาลแทน',
                today: 'วันนี้', goal: 'เป้าหมาย',
                timerAnnounce: '{phase} เหลือเวลา {time}',
                phaseCompleteFocus: 'ครบเวลาโฟกัสแล้ว ถึงเวลาพัก!',
                phaseCompleteBreak: 'พักครบแล้ว กลับมาโฟกัสกันต่อ!'
            },
            settings: {
                title: 'ตั้งค่า', language: 'ภาษา', theme: 'ธีม',
                themeLight: 'สว่าง', themeDark: 'มืด', themeSystem: 'ตามระบบ',
                dailyGoal: 'เป้าหมายชั่วโมงอ่านต่อวัน', examDate: 'วันสอบ',
                pomodoroSection: 'ตั้งเวลาโฟกัส (Pomodoro)',
                focusMin: 'ช่วงโฟกัส (นาที)', shortBreakMin: 'พักสั้น (นาที)',
                longBreakMin: 'พักยาว (นาที)', cycles: 'จำนวนรอบก่อนพักยาว',
                soundSection: 'เสียง', soundEnabled: 'เปิดเสียงแจ้งเตือน',
                accountSection: 'บัญชี', switchProfile: 'สลับโปรไฟล์ผู้ใช้',
                dataSection: 'ข้อมูล',
                exportBtn: 'ส่งออกข้อมูล (JSON)', importBtn: 'นำเข้าข้อมูล (JSON)',
                resetAllBtn: 'ล้างข้อมูลทั้งหมด',
                resetConfirmTitle: 'ล้างข้อมูลทั้งหมด?', resetConfirmMsg: 'การกระทำนี้จะลบแผนการอ่าน ตารางเรียน คำศัพท์ และสถิติทั้งหมดอย่างถาวร ไม่สามารถกู้คืนได้',
                resetConfirmOk: 'ล้างข้อมูลทั้งหมด',
                exportSuccess: 'ส่งออกข้อมูลเรียบร้อยแล้ว', importSuccess: 'นำเข้าข้อมูลเรียบร้อยแล้ว',
                importErrorJson: 'ไฟล์ที่เลือกไม่ใช่ไฟล์ JSON ที่ถูกต้อง', importErrorShape: 'ไฟล์นี้ไม่ใช่ไฟล์ข้อมูลของ Smart Study',
                resetSuccess: 'ล้างข้อมูลทั้งหมดเรียบร้อยแล้ว'
            },
            quests: {
                cardTitle: 'เควสประจำวัน',
                pointsTotal: '{n} คะแนนสะสม',
                pointsBadge: '⭐ {n} · {level}',
                claim: 'รับ +{points}',
                claimedToast: 'รับรางวัลแล้ว! +{points} คะแนน 🎉'
            },
            errors: {
                storageUnavailable: 'เบราว์เซอร์นี้ไม่รองรับการบันทึกข้อมูลถาวร (เช่น โหมดส่วนตัว) การเปลี่ยนแปลงจะหายไปเมื่อปิดแท็บนี้',
                corruptData: 'ข้อมูลที่บันทึกไว้เสียหาย ระบบได้เริ่มต้นใหม่ให้อัตโนมัติ',
                setGoalMin: 'ตั้งเวลาให้หน่อยสิ อย่างน้อย 1 นาทีก็ยังดีนะ 🎯',
                stopTimerFirst: 'กรุณาหยุดเวลาก่อนแก้ไขเป้าหมายครับ'
            },
            aria: {
                closeDialog: 'ปิดหน้าต่าง', openSettings: 'เปิดการตั้งค่า', openSearch: 'ค้นหา',
                closeSearch: 'ปิดการค้นหา', deleteWord: 'ลบคำศัพท์', addWord: 'เพิ่มคำศัพท์',
                prevMonth: 'เดือนก่อนหน้า', nextMonth: 'เดือนถัดไป', prevWeek: 'สัปดาห์ก่อนหน้า', nextWeek: 'สัปดาห์ถัดไป',
                playAmbient: 'เล่นเสียงบรรยากาศ', pauseAmbient: 'หยุดเสียงบรรยากาศ', ambientVolume: 'ระดับเสียงบรรยากาศ',
                skipToContent: 'ข้ามไปยังเนื้อหาหลัก', dismissToast: 'ปิดการแจ้งเตือน'
            }
        },
        en: {
            brand: { full: 'The Focused Scholar', short: 'Smart Study' },
            common: {
                cancel: 'Cancel', save: 'Save', close: 'Close', confirm: 'Confirm', delete: 'Delete',
                add: 'Add', edit: 'Edit', back: 'Back', next: 'Next', today: 'Today',
                loading: 'Loading...', optional: 'optional', hours: 'hrs', minutes: 'min',
                noResults: 'No results found', search: 'Search', settings: 'Settings', on: 'On', off: 'Off'
            },
            nav: { home: 'Home', schedule: 'Schedule', flashcards: 'Flashcards', focus: 'Focus' },
            s0: {
                title: "Who's studying today?",
                subtitle: 'Pick your profile so we can remember your own progress.',
                createTitle: 'Create a new profile',
                nameLabel: 'Your name',
                namePlaceholder: 'e.g. Alex',
                avatarLabel: 'Choose an avatar',
                createBtn: 'Start studying',
                errName: 'Please enter your name first.',
                deleteProfile: 'Delete this profile',
                deleteConfirmTitle: 'Delete this profile?',
                deleteConfirmMsg: 'All of "{name}"\'s data (plan, points, stats) will be permanently deleted.',
            },
            s1: {
                stepLabel: 'Step {n} of 3',
                title: 'Your Goal',
                subtitle: 'Which exam are you preparing for?',
                hint: '*Pick just one subject so you can focus fully (choose another once you finish it)',
                topicsHeading: 'Topics to cover:',
                next: 'Next',
                errSelectSubject: 'Please choose a subject to continue.',
                completedTag: '✓ Completed'
            },
            s2: {
                title: 'Set your exam date & available time',
                subtitle: "Let us calculate the plan that best fits your lifestyle.",
                examDateSection: 'Your most important exam date',
                examDateFieldLabel: 'Day / Month / Year',
                examDatePlaceholder: 'Choose exam date...',
                dailyHoursSection: 'Daily study hours',
                sliderEasy: 'Light effort', sliderHard: 'Warrior mode',
                calcDefault: 'Choose your exam date above to calculate the remaining prep time 🎯',
                calcPast: 'That exam date has already passed!',
                calcToday: "It's exam day! You have {hrs} hrs left to review.",
                calcDaysLeft: '{days} days left (total study time: {total} hrs)',
                generate: 'Generate my smart study plan',
                errSelectDate: 'Please choose your exam date first 📅',
                orderSection: 'Reading order',
                orderHint: 'How should we sequence your topics day to day?'
            },
            datePicker: { title: 'Choose exam date' },
            s3: {
                greeting: "Hi, here's today's summary",
                subtitle: 'Update your progress below 🚀',
                progressTitle: 'Core content progress',
                readinessLabel: 'Exam readiness',
                goalLabel: 'Goal',
                completedLabel: 'Topics completed',
                dailyGoalTag: 'Daily goal',
                subjectLoading: 'Loading subject...',
                subjectPrefix: 'Subject: {subject}',
                progressCaption: 'Push to 100% coverage',
                todoTitle: "Today's to-do list",
                lessonsUnit: 'topics',
                tickHint: 'Tap to mark as done',
                emptyChecklist: 'No subject selected yet. Go back to the first screen to choose one.'
            },
            congrats: {
                title: 'Congratulations! 🎉',
                message: "You've covered 100% of your syllabus.\nAmazing effort — good luck on the exam!",
                close: 'Awesome!',
                chooseNext: 'Choose your next subject'
            },
            s4: {
                title: 'Schedule',
                addSession: 'Add session',
                weekOf: 'Week of {start} – {end}',
                thisWeek: 'This week',
                prevWeek: 'Previous week', nextWeek: 'Next week', jumpToday: 'Today',
                searchPlaceholder: 'Search sessions or topics...',
                searchTopicsHeading: 'Syllabus topics',
                searchSessionsHeading: 'Matching sessions',
                examIndicator: 'Exam date:',
                todoTitle: "Today's to-do list",
                todoEmpty: 'No sessions scheduled yet. Add one to build your list.',
                todoEmptyForWeek: 'No sessions in this week',
                timeColumn: 'Time',
                prevMonth: 'Previous month', nextMonth: 'Next month'
            },
            colors: { blue: 'Blue', orange: 'Orange', green: 'Green', purple: 'Purple', pink: 'Pink', red: 'Red', teal: 'Teal' },
            modalAddClass: {
                title: 'Add session', topicLabel: 'Choose a topic to study',
                colorLabel: 'Subject color', dateLabel: 'Date',
                startLabel: 'Start time', endLabel: 'End time', save: 'Save to schedule',
                errDateRequired: 'Please choose a date', errTimeOrder: 'Start time must be before end time.',
                errTimeRange: 'Please choose a time between 00:00 and 24:00.',
                errOverlap: 'This time range overlaps with another session on the same day.',
                saved: 'Session saved to your schedule.'
            },
            modalDeleteClass: { title: 'Delete session', confirm: 'Remove {name} from your schedule?', ok: 'Delete' },
            modalTimePicker: { title: 'Choose time', confirm: 'Confirm time' },
            modalDeckSelector: { title: 'Choose a deck', createNew: 'Create new deck', wordsCount: '{n} words' },
            modalDeleteCard: { title: 'Delete word', selectLabel: 'Choose a word to delete', warning: '*This cannot be undone.', ok: 'Delete word' },
            modalAddCard: { title: 'Add new word', termLabel: 'Term', defLabel: 'Definition', exampleLabel: 'Example sentence', save: 'Add word', errRequired: 'Please fill in both the term and the definition.' },
            modalAddDeck: { title: 'Create deck', nameLabel: 'Deck name', namePlaceholder: 'e.g. Social Studies, Biology', errRequired: 'Please name your deck.', errExists: 'A deck with this name already exists.' },
            s5: {
                title: 'Vocabulary', deckLabel: 'Deck:', progressCount: '{current} / {total} words',
                term: 'Term', hintTap: 'Tap to reveal meaning', meaning: 'Meaning',
                example: 'Example: {ex}', noExample: 'No example sentence',
                reviewAgain: 'Skip / not sure', remembered: 'Got it / next',
                emptyTitle: 'This deck is empty', emptyHint: 'Tap + in the top right to add a word',
                perfectTitle: 'Amazing! 🎉', perfectHint: "You remembered 100% of this deck this round",
                summaryTitle: 'Review summary', summaryHint: 'Review a bit more for full accuracy!',
                restartWrong: 'Review the words you missed', restartWrongCount: 'Review the words you missed ({n})',
                reviewAll: 'Review the whole deck again',
                correctCount: 'Remembered: {n}', wrongCount: 'To review again: {n}', accuracy: 'Accuracy this round: {pct}%',
                tip: 'Tap the card to reveal the answer, then choose an option to record it.',
                selectDeckFirst: 'Please create a deck first.'
            },
            s6: {
                title: 'Focus mode', subtitle: 'Cut distractions and get to work',
                phaseFocus: 'Focus', phaseShortBreak: 'Short break', phaseLongBreak: 'Long break',
                cycleLabel: 'Cycle {current} / {total}',
                mainGoal: 'Main goal',
                start: 'Start', pause: 'Pause', resume: 'Resume', reset: 'Reset',
                soundToggleLabel: 'Play a sound when time is up',
                ambientLabel: 'Ambient sound', ambientBrown: 'Brown noise', ambientRain: 'Rain',
                ambientAddCustom: 'Add my own sound', ambientUploadSuccess: 'Sound added successfully.',
                ambientUploadError: 'Could not save that sound file.', ambientCustomError: "Couldn't play that sound file — switched back to brown noise.",
                today: 'Today', goal: 'Goal',
                timerAnnounce: '{phase}, {time} remaining',
                phaseCompleteFocus: 'Focus session complete — time for a break!',
                phaseCompleteBreak: 'Break is over — back to focus!'
            },
            settings: {
                title: 'Settings', language: 'Language', theme: 'Theme',
                themeLight: 'Light', themeDark: 'Dark', themeSystem: 'Follow system',
                dailyGoal: 'Daily study goal (hours)', examDate: 'Exam date',
                pomodoroSection: 'Focus timer (Pomodoro)',
                focusMin: 'Focus length (min)', shortBreakMin: 'Short break (min)',
                longBreakMin: 'Long break (min)', cycles: 'Cycles before long break',
                soundSection: 'Sound', soundEnabled: 'Enable notification sound',
                accountSection: 'Account', switchProfile: 'Switch profile',
                dataSection: 'Data',
                exportBtn: 'Export data (JSON)', importBtn: 'Import data (JSON)',
                resetAllBtn: 'Reset all data',
                resetConfirmTitle: 'Reset all data?', resetConfirmMsg: 'This permanently deletes your study plan, schedule, flashcards and stats. This cannot be undone.',
                resetConfirmOk: 'Reset everything',
                exportSuccess: 'Data exported successfully.', importSuccess: 'Data imported successfully.',
                importErrorJson: 'That file is not valid JSON.', importErrorShape: 'That file is not a Smart Study data export.',
                resetSuccess: 'All data has been reset.'
            },
            quests: {
                cardTitle: 'Daily quests',
                pointsTotal: '{n} points',
                pointsBadge: '⭐ {n} · {level}',
                claim: 'Claim +{points}',
                claimedToast: 'Reward claimed! +{points} points 🎉'
            },
            errors: {
                storageUnavailable: "This browser can't persist data here (e.g. private browsing). Changes will be lost when you close this tab.",
                corruptData: 'Your saved data was corrupted, so a fresh start was loaded automatically.',
                setGoalMin: 'Come on, set at least 1 minute! 🎯',
                stopTimerFirst: 'Please stop the timer before editing the goal.'
            },
            aria: {
                closeDialog: 'Close dialog', openSettings: 'Open settings', openSearch: 'Search',
                closeSearch: 'Close search', deleteWord: 'Delete word', addWord: 'Add word',
                prevMonth: 'Previous month', nextMonth: 'Next month', prevWeek: 'Previous week', nextWeek: 'Next week',
                playAmbient: 'Play ambient sound', pauseAmbient: 'Pause ambient sound', ambientVolume: 'Ambient volume',
                skipToContent: 'Skip to main content', dismissToast: 'Dismiss notification'
            }
        }
    };

    let currentLang = 'th';
    const listeners = new Set();

    function resolveInitialLang() {
        const saved = TFS.State && TFS.State.get().settings.language;
        if (saved === 'th' || saved === 'en') return saved;
        const nav = (navigator.language || 'th').toLowerCase();
        return nav.startsWith('en') ? 'en' : 'th';
    }

    function getByPath(dict, path) {
        return path.split('.').reduce((acc, key) => (acc && typeof acc === 'object') ? acc[key] : undefined, dict);
    }

    function interpolate(str, vars) {
        if (!vars) return str;
        return str.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
    }

    function t(key, vars) {
        const val = getByPath(DICT[currentLang], key) ?? getByPath(DICT.th, key);
        if (val === undefined) {
            console.warn('[i18n] Missing translation key:', key);
            return key;
        }
        return interpolate(val, vars);
    }

    /** For bilingual *data* objects, e.g. { th: 'ฟิสิกส์', en: 'Physics' }. */
    function pick(obj) {
        if (!obj) return '';
        if (typeof obj === 'string') return obj;
        return obj[currentLang] || obj.th || obj.en || '';
    }

    function getLang() { return currentLang; }

    function localeTag() { return currentLang === 'en' ? 'en-US' : 'th-TH'; }

    function setLanguage(lang) {
        if (lang !== 'th' && lang !== 'en') return;
        currentLang = lang;
        document.documentElement.setAttribute('lang', lang);
        if (TFS.State) TFS.State.commit({ settings: { language: lang } });
        applyTranslations(document);
        listeners.forEach(fn => { try { fn(lang); } catch (e) { console.error(e); } });
    }

    function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

    function translateNode(elNode) {
        if (elNode.hasAttribute('data-i18n')) {
            let vars;
            const rawVars = elNode.getAttribute('data-i18n-vars');
            if (rawVars) { try { vars = JSON.parse(rawVars); } catch (e) { /* ignore malformed vars */ } }
            elNode.textContent = t(elNode.getAttribute('data-i18n'), vars);
        }
        if (elNode.hasAttribute('data-i18n-attr')) {
            try {
                const map = JSON.parse(elNode.getAttribute('data-i18n-attr'));
                Object.entries(map).forEach(([attr, key]) => elNode.setAttribute(attr, t(key)));
            } catch (e) { /* malformed attribute map, skip */ }
        }
    }

    /** `root` defaults to the whole document. `querySelectorAll` only ever matches
     *  DESCENDANTS, so `root` itself is translated separately — this makes
     *  `applyTranslations(someSingleElement)` do what it looks like it does. */
    function applyTranslations(root) {
        const scope = root || document;
        if (scope !== document && scope.nodeType === 1) translateNode(scope);
        scope.querySelectorAll('[data-i18n], [data-i18n-attr]').forEach(translateNode);
    }

    function formatDate(date, opts) {
        return date.toLocaleDateString(localeTag(), opts || { year: 'numeric', month: 'long', day: 'numeric' });
    }

    function formatMonthYear(date) {
        return date.toLocaleDateString(localeTag(), { year: 'numeric', month: 'long' });
    }

    /** Mon..Sun short weekday labels for the current locale, used by both calendars. */
    function weekdayShortLabels() {
        // 2024-01-01 was a Monday — a stable anchor to enumerate Mon..Sun regardless of today's date.
        const fmt = new Intl.DateTimeFormat(localeTag(), { weekday: 'short' });
        const out = [];
        for (let i = 0; i < 7; i++) {
            out.push(fmt.format(new Date(2024, 0, 1 + i)));
        }
        return out;
    }

    function formatNumber(n, opts) {
        return new Intl.NumberFormat(localeTag(), opts).format(n);
    }

    TFS.I18n = {
        init() { currentLang = resolveInitialLang(); document.documentElement.setAttribute('lang', currentLang); },
        t, pick, getLang, setLanguage, onChange, applyTranslations,
        formatDate, formatMonthYear, weekdayShortLabels, formatNumber, localeTag
    };

})(window);
