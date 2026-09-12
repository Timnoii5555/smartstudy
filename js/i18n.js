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
            landing: {
                loginLink: 'เข้าสู่ระบบ',
                eyebrow: 'แพลตฟอร์มติวสอบ TCAS ฟรี 100%',
                heroTitle: 'วางแผนอ่านหนังสือสอบ TCAS ให้ฉลาดขึ้น ไม่ใช่แค่ตารางเปล่าๆ ให้กรอกเอง',
                heroSubtitle: 'SmartStudy คำนวณแผนอ่านรายวันให้อัตโนมัติจากวันสอบจริงของคุณ พร้อมระบบเกมมิฟิเคชันที่ทำให้การอ่านหนังสือกลายเป็นสิ่งที่อยากเปิดมาทำทุกวัน',
                ctaBtn: 'เริ่มต้นใช้งานฟรี',
                ctaNote: 'ไม่ต้องใช้บัตรเครดิต · ไม่มีโฆษณา · ฟรีตลอดไป',
                skipToFocus: 'หรือเริ่มโฟกัสตอนนี้เลย — ไม่ต้องตั้งค่าอะไรก่อน',
                quickGuestName: 'ผู้มาเยือน',
                stepsTitle: 'เริ่มต้นใช้งานยังไง',
                newBadge: 'ใหม่',
                step1Title: '1. เลือกวิชาที่จะสอบ',
                step1Desc: 'เลือกจากวิชา TCAS จริง 23 วิชาขึ้นไป — TGAT, TPAT1-5, A-Level ทุกวิชา — หรือสร้างวิชาและหัวข้อของตัวเองได้ในไม่กี่วินาที',
                step2Title: '2. ตั้งวันสอบและเวลาที่มี',
                step2Desc: 'บอกวันสอบและจำนวนชั่วโมงที่อ่านได้ต่อวัน ระบบจะสร้างแผนอ่านรายวันให้อัตโนมัติทันที',
                step3Title: '3. ทำตามแผนทุกวัน',
                step3Desc: 'ติ๊กหัวข้อที่อ่านจบวันนี้ และต่อสตรีคแบบไม่กดดัน ได้จากหน้าแดชบอร์ดเดียว',
                step4Title: '4. ติดตามความพร้อมสอบจริง',
                step4Desc: 'ใช้โหมดโฟกัสพร้อมเสียงบรรยากาศ แล้วดูคะแนนความพร้อมสอบรวมของคุณ — ไม่ใช่แค่ "% เสร็จแล้ว" เฉยๆ — ขยับขึ้นเรื่อยๆ',
                compareTitle: 'ต่างจากแอปติวทั่วไปยังไง',
                compareThemLabel: 'แอปวางแผนทั่วไป',
                compareThem1: 'ต้องพิมพ์ตารางเรียนเองทั้งหมด',
                compareThem2: 'ความคืบหน้าคือแถบ "% เสร็จแล้ว" เส้นเดียว',
                compareThem3: 'เสียงบรรยากาศ = ไฟล์ mp3 วนลูป',
                compareThem4: 'อ่านคนเดียว ไม่รู้เลยว่ามีใครกำลังอ่านอยู่เหมือนกันไหม',
                compareUsLabel: 'SmartStudy',
                compareUs1: 'ระบบสร้างแผนให้จากวันสอบของคุณเอง',
                compareUs2: 'คะแนนรวมที่นับความสม่ำเสมอด้วย ไม่ใช่แค่ % เนื้อหา',
                compareUs3: 'เสียงสังเคราะห์สดด้วย Web Audio ไม่มีไฟล์เลย',
                compareUs4: 'ดูว่าตอนนี้มีคนกำลังโฟกัสอยู่ด้วยกันกี่คนแบบไม่ระบุตัวตน — ไม่มีชื่อ ไม่มีแชท ไม่มีการจัดอันดับใครแข่งกับใคร',
                finalTitle: 'พร้อมวางแผนสอบให้เป็นระบบแล้วหรือยัง?',
                footerNote: 'สร้างมาเพื่อนักเรียนที่กำลังเตรียมสอบ TCAS'
            },
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
                tabLogin: 'เข้าสู่ระบบ', tabSignup: 'สมัครสมาชิก',
                emailLabel: 'อีเมล', passwordLabel: 'รหัสผ่าน',
                loginBtn: 'เข้าสู่ระบบ', signupBtn: 'สร้างบัญชี',
                avatarHint: 'ไม่บังคับ — แตะเพื่อเลือกรูป', passwordHint: 'อย่างน้อย 6 ตัวอักษร',
                orDivider: 'หรือ',
                forgotPassword: 'ลืมรหัสผ่าน?',
                guestSectionLabel: 'ใช้แบบไม่มีบัญชี (เก็บข้อมูลในเครื่องนี้เท่านั้น)',
                errFillFields: 'กรุณากรอกข้อมูลให้ครบครับ'
            },
            s1: {
                stepLabel: 'ขั้นที่ {n} จาก 3',
                title: 'เป้าหมายของคุณ',
                subtitle: 'คุณกำลังเตรียมตัวสอบวิชาอะไรบ้าง?',
                hint: '*เลือกได้เพียง 1 วิชาเพื่อโฟกัสให้เต็มที่ (เรียนจบแล้วค่อยเลือกวิชาถัดไปได้)',
                topicsHeading: 'เนื้อหาที่ต้องอ่าน:',
                next: 'ถัดไป',
                errSelectSubject: 'กรุณาเลือกวิชาที่จะสอบก่อนครับ',
                completedTag: '✓ เรียนจบแล้ว',
                completedDisabledHint: 'คุณเรียนวิชานี้จบไปแล้ว เลือกวิชาอื่นได้เลย',
                addCustomDesc: 'สร้างวิชาและหัวข้อของคุณเอง',
                deleteCustomTitle: 'ลบวิชานี้?',
                deleteCustomMsg: 'วิชา "{name}" และความคืบหน้าทั้งหมดจะถูกลบอย่างถาวร'
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
                overloadHoursNudged: 'ปรับเป็น {hrs} ชม./วันให้แล้ว กด "สร้างแผนการอ่าน" อีกครั้งได้เลยครับ',
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
                todoTitle: 'หัวข้อที่ต้องอ่าน',
                lessonsUnit: 'บท',
                tickHint: 'ติ๊กเมื่อเรียนจบ',
                emptyChecklist: 'ยังไม่มีวิชาที่เลือก เลือกวิชาแรกของคุณเพื่อสร้างแผนอ่านหนังสือให้อัตโนมัติ',
                emptyChecklistCta: 'เลือกวิชาที่จะอ่าน',
                readAheadText: 'เก่งมาก! อ่านครบตามเป้าหมายวันนี้แล้ว อยากอ่านต่อเลยไหม?',
                readAheadBtn: 'อ่านต่อเลย',
                streakBadge: '{n} วันติดต่อกัน',
                streakFreezesLeft: 'เหลือวันหยุดพัก (freeze) {n} วันเดือนนี้',
                notTodayBtn: 'วันนี้ไม่ไหว',
                notTodayToast: 'ไม่เป็นไรครับ พักได้ งานที่เหลือของวันนี้ถูกเลื่อนไปวันถัดไปให้แล้ว',
                readinessScoreTitle: 'คะแนนความพร้อมสอบรวม',
                readinessScoreHint: 'ไม่ใช่แค่ % เนื้อหา แต่รวมความสม่ำเสมอด้วย',
                readinessFactorContent: 'เนื้อหาที่อ่านจบ',
                readinessFactorConsistency: 'ทำเป้าหมาย 7 วันล่าสุด',
                readinessFactorStreak: 'ความต่อเนื่อง (สตรีค)'
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
            modalWeakDecks: {
                title: 'จุดอ่อน', hint: 'เรียงชุดคำศัพท์ตามความแม่นยำใน 30 วันล่าสุด จากน้อยไปมาก แตะเพื่อทบทวนได้เลย',
                empty: 'ยังไม่มีข้อมูลการทบทวนพอที่จะวิเคราะห์ ลองทบทวนคำศัพท์สักชุดก่อนนะครับ',
                reviewCount: 'ทบทวนไปแล้ว {n} ครั้ง'
            },
            modalOverload: {
                title: 'ตารางค่อนข้างแน่น',
                message: 'เนื้อหาที่เหลือต้องใช้เวลาอ่านรวมประมาณ {needHours} ชม. แต่จากจำนวนวันที่เหลือถึงวันสอบและเวลาที่ตั้งไว้ตอนนี้ ({haveHours} ชม./วัน) จะรวมได้ประมาณ {capacityHours} ชม. เท่านั้น (ขาดไปประมาณ {gapHours} ชม.) ลองเลือกทางใดทางหนึ่งด้านล่างได้เลยครับ',
                increaseHours: 'เพิ่มเวลาอ่านต่อวัน', changeSubject: 'เลือกวิชาอื่นหรือลดเนื้อหา'
            },
            modalStats: { title: 'สรุปรายสัปดาห์', createCardBtn: 'สร้างการ์ดสรุปผลงานไว้แชร์' },
            modalRecap: {
                title: 'การ์ดผลงานของฉัน',
                hint: 'เป็นผลงานของคุณคนเดียวเท่านั้น ไม่มีการเทียบกับใครทั้งนั้น',
                shareBtn: 'แชร์', downloadBtn: 'ดาวน์โหลดรูปภาพ'
            },
            modalBoardingPass: {
                title: 'ตั๋วโดยสารของคุณ',
                seatLabel: 'ที่นั่ง', durationLabel: 'ระยะเวลา', boardingLabel: 'ขึ้นเครื่อง', now: 'ตอนนี้', dateLabel: 'วันที่',
                tip: '📵 เคล็ดลับ: เปิดโหมดห้ามรบกวนหรือโหมดเครื่องบินก่อนขึ้นเครื่อง เพื่อโฟกัสได้เต็มที่',
                checkInBtn: 'เช็คอินและเริ่มบิน'
            },
            recap: {
                streakLabel: 'วันติดต่อกัน',
                weekLabel: 'เวลาโฟกัสสัปดาห์นี้',
                bestTimeLabel: 'ช่วงเวลาที่โฟกัสได้ดีที่สุด',
                footerLine: 'ทำเพื่อความฝันของตัวเอง ไม่ใช่เพื่อแข่งกับใคร ✨',
                shareUnsupported: 'อุปกรณ์นี้แชร์รูปโดยตรงไม่ได้ ลองดาวน์โหลดแล้วแชร์เองได้ครับ',
                shareFailed: 'แชร์ไม่สำเร็จ ลองดาวน์โหลดรูปแทนได้ครับ'
            },
            garden: {
                stageSeed: 'เพิ่งปลูกเมล็ดแรก 🌱',
                stageSprout: 'กำลังแตกยอดอ่อน',
                stageGrowing: 'เติบโตขึ้นเรื่อยๆ',
                stageBlooming: 'ใกล้จะออกดอกเต็มต้นแล้ว',
                stageFull: 'ต้นไม้ของคุณออกดอกเต็มที่แล้ว 🌸',
                hoursCaption: 'รวมเวลาโฟกัสตลอดที่ผ่านมา {hrs} ชม.'
            },
            stats: {
                summaryTotal: 'สัปดาห์นี้คุณโฟกัสไปทั้งหมด {hrs} ชม.',
                summaryUp: 'มากกว่าสัปดาห์ก่อน {hrs} ชม.',
                summaryDown: 'น้อยกว่าสัปดาห์ก่อน {hrs} ชม.',
                summaryLeastSubject: '{subject} เป็นวิชาที่ได้รับความสนใจน้อยที่สุดในตอนนี้',
                thisWeekLabel: 'เวลาโฟกัสรวม 7 วันล่าสุด',
                deltaUp: 'เพิ่มขึ้น {hrs} ชม. จาก 7 วันก่อนหน้า',
                deltaDown: 'ลดลง {hrs} ชม. จาก 7 วันก่อนหน้า',
                deltaSame: 'เท่ากับ 7 วันก่อนหน้า',
                perSubjectTitle: 'เวลาที่ใช้ไปกับแต่ละวิชา',
                bestTimeOfDay: 'ช่วงเวลาที่คุณโฟกัสได้ดีที่สุดมักเป็นช่วง{time}',
                bucket: { morning: 'เช้า', afternoon: 'บ่าย', evening: 'เย็น', night: 'ดึก' }
            },
            modalDeleteCard: { title: 'ลบคำศัพท์', selectLabel: 'เลือกคำศัพท์ที่ต้องการลบ', warning: '*การลบคำศัพท์จะไม่สามารถกู้คืนได้', ok: 'ลบคำศัพท์' },
            modalCustomSubject: {
                title: 'สร้างวิชาของฉันเอง',
                nameLabel: 'ชื่อวิชา',
                namePlaceholder: 'เช่น IELTS, ใบขับขี่, วิชาที่โรงเรียนสอน',
                topicsLabel: 'หัวข้อที่ต้องอ่าน',
                addTopic: 'เพิ่มหัวข้อ',
                topicPlaceholder: 'เช่น บทที่ 1: คำศัพท์พื้นฐาน',
                errName: 'กรุณาตั้งชื่อวิชาก่อนครับ',
                errTopics: 'กรุณาเพิ่มอย่างน้อย 1 หัวข้อ'
            },
            modalRename: {
                title: 'แก้ไขโปรไฟล์',
                success: 'บันทึกโปรไฟล์เรียบร้อยแล้ว'
            },
            modalForgotPassword: {
                title: 'ตั้งรหัสผ่านใหม่',
                hint: 'ใช้อีเมลเดียวกับที่ใช้ "สมัครสมาชิก" ไว้เท่านั้น ถึงจะมีอีเมลส่งไปจริง — ถ้าเป็นอีเมลอื่นระบบจะไม่ส่งอะไรไปเลย (แต่ก็ไม่ขึ้นว่าผิดเช่นกัน เพื่อความปลอดภัย)',
                send: 'ส่งลิงก์รีเซ็ต',
                sent: 'ส่งคำขอเรียบร้อยแล้ว ถ้าอีเมลนี้เคยสมัครไว้จริง จะมีลิงก์ส่งไปใน 1-2 นาที อย่าลืมเช็คในกล่อง "สแปม/จดหมายขยะ" ด้วยนะครับ'
            },
            modalAuth: {
                errEmailInUse: 'อีเมลนี้มีบัญชีอยู่แล้ว ลองเข้าสู่ระบบแทนไหมครับ?',
                errInvalidEmail: 'รูปแบบอีเมลไม่ถูกต้อง',
                errWeakPassword: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร',
                errUserNotFound: 'ไม่พบบัญชีนี้ในระบบ',
                errWrongPassword: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
                errNetwork: 'เชื่อมต่อเครือข่ายไม่ได้ ลองใหม่อีกครั้ง',
                errTooMany: 'ลองผิดหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่',
                errGeneric: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'
            },
            modalHistory: {
                title: 'ประวัติการอ่าน',
                empty: 'ยังไม่มีหัวข้อที่อ่านจบเลย เริ่มติ๊กจากหน้าแรกได้เลยครับ',
                countLabel: 'อ่านจบแล้ว {n}/{total} บท'
            },
            modalReport: {
                title: 'รายงานบัค / ข้อเสนอแนะ',
                hint: 'จะเปิดแอปอีเมลของคุณพร้อมข้อความนี้ ส่งถึงผู้พัฒนาโดยตรง',
                label: 'เจอปัญหาอะไร หรืออยากให้เพิ่มอะไร?',
                placeholder: 'พิมพ์รายละเอียดที่นี่...',
                send: 'เปิดอีเมล',
                errEmpty: 'กรุณาพิมพ์ข้อความก่อนส่งครับ'
            },
            modalAddCard: { title: 'เพิ่มคำศัพท์ใหม่', termLabel: 'คำศัพท์', defLabel: 'ความหมาย', exampleLabel: 'ตัวอย่างประโยค', save: 'เพิ่มคำศัพท์', errRequired: 'กรุณากรอกคำศัพท์และความหมายให้ครบครับ', bulkImportLink: 'วางคำศัพท์หลายคำพร้อมกันแทน' },
            modalBulkImport: {
                title: 'นำเข้าคำศัพท์หลายคำ',
                hint: 'วางทีละบรรทัด คั่นคำศัพท์กับความหมายด้วย "|" แท็บ หรือ " - "',
                placeholder: 'apple | แอปเปิ้ล\nbanana - กล้วย',
                previewBtn: 'ดูตัวอย่างก่อนนำเข้า',
                confirmBtn: 'นำเข้าคำศัพท์',
                errNoneParsed: 'ไม่พบคำศัพท์ที่แยกได้เลย ลองตรวจสอบตัวคั่นอีกครั้งครับ',
                summary: 'พบคำศัพท์ {n} คำ พร้อมนำเข้า',
                summaryWithSkipped: 'พบคำศัพท์ {n} คำ พร้อมนำเข้า (ข้าม {skipped} บรรทัดที่แยกไม่ได้)',
                importedToast: 'นำเข้าคำศัพท์ {n} คำเรียบร้อยแล้ว 🎉'
            },
            modalAddDeck: { title: 'สร้างชุดคำศัพท์', nameLabel: 'ชื่อชุดคำศัพท์', namePlaceholder: 'เช่น สังคมศึกษา, ชีววิทยา', errRequired: 'กรุณาตั้งชื่อชุดคำศัพท์ครับ', errExists: 'ชื่อชุดคำศัพท์นี้มีอยู่แล้วครับ' },
            s5: {
                title: 'คลังศัพท์', deckLabel: 'ชุดคำศัพท์:', progressCount: '{current} / {total} คำ',
                term: 'ศัพท์', hintTap: 'แตะเพื่อดูความหมาย', meaning: 'ความหมาย',
                example: 'ตัวอย่าง: {ex}', noExample: 'ไม่มีตัวอย่างประโยค',
                gradeAgain: 'ยังไม่ได้', gradeHard: 'ยาก', gradeGood: 'ได้แล้ว', gradeEasy: 'ง่ายมาก',
                nothingDueTitle: 'ไม่มีคำที่ต้องทบทวนตอนนี้', nothingDueHint: 'เก่งมาก! กลับมาใหม่ตามรอบทบทวนที่ระบบนัดไว้ หรือเลือกทบทวนทั้งชุดได้เลย',
                newCardCapHint: 'ครบโควตาคำใหม่ของวันนี้แล้ว ({n} คำ) พรุ่งนี้มาต่อกันใหม่นะ',
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
                coStudyToggleLabel: 'แชร์ว่าคุณอยู่บนไฟลท์นี้ (ไม่มีชื่อ ไม่มีแชท)',
                coStudyCountActive: '🟢 มีอีก {n} คนอยู่บนไฟลท์เดียวกับคุณตอนนี้',
                coStudyCountAlone: 'ตอนนี้คุณเป็นคนเดียวบนไฟลท์นี้ — ชวนเพื่อนมาบินด้วยกันได้นะ',
                coStudyUnavailable: 'ฟีเจอร์นี้ยังไม่พร้อมใช้งานในตอนนี้',
                flightPickerLabel: 'เลือกไฟลท์ของคุณ',
                flightMinutes: '{n} นาที',
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
                themeLight: 'สว่าง', themeDark: 'มืด', themePaper: 'กระดาษ', themeNight: 'กลางคืน', themeSystem: 'ตามระบบ',
                dailyGoal: 'เป้าหมายชั่วโมงอ่านต่อวัน', examDate: 'วันสอบ',
                pomodoroSection: 'ตั้งเวลาโฟกัส (Pomodoro)',
                focusMin: 'ช่วงโฟกัส (นาที)', shortBreakMin: 'พักสั้น (นาที)',
                longBreakMin: 'พักยาว (นาที)', cycles: 'จำนวนรอบก่อนพักยาว',
                flashcardsSection: 'แฟลชการ์ด', newCardsPerDay: 'คำศัพท์ใหม่สูงสุดต่อวัน',
                soundSection: 'เสียง', soundEnabled: 'เปิดเสียงแจ้งเตือน',
                accountSection: 'บัญชี', renameBtn: 'แก้ไขโปรไฟล์ (ชื่อ/รูป)',
                switchProfile: 'สลับโปรไฟล์ผู้ใช้', logout: 'ออกจากระบบ',
                historySection: 'ประวัติการอ่าน', historyBtn: 'ดูสิ่งที่อ่านจบไปแล้ว',
                feedbackSection: 'ความคิดเห็น', reportBtn: 'รายงานบัค / ข้อเสนอแนะ'
            },
            streak: {
                freezeUsedToast: 'ใช้วันหยุดพัก (freeze) ไป {n} วันแล้ว ยังเหลืออีก {left} วันในเดือนนี้ สตรีคของคุณยังอยู่ครบ'
            },
            errors: {
                storageUnavailable: 'เบราว์เซอร์นี้ไม่รองรับการบันทึกข้อมูลถาวร (เช่น โหมดส่วนตัว) การเปลี่ยนแปลงจะหายไปเมื่อปิดแท็บนี้',
                corruptData: 'ข้อมูลที่บันทึกไว้เสียหาย ระบบได้เริ่มต้นใหม่ให้อัตโนมัติ',
                setGoalMin: 'ตั้งเวลาให้หน่อยสิ อย่างน้อย 1 นาทีก็ยังดีนะ 🎯',
                stopTimerFirst: 'กรุณาหยุดเวลาก่อนแก้ไขเป้าหมายครับ'
            },
            aria: {
                closeDialog: 'ปิดหน้าต่าง', openSettings: 'เปิดการตั้งค่า', openSearch: 'ค้นหา', openWeakDecks: 'จุดอ่อน', openStats: 'สรุปรายสัปดาห์',
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
            landing: {
                loginLink: 'Log in',
                eyebrow: 'A free TCAS study platform',
                heroTitle: 'Plan your TCAS reading smarter — not just another empty timetable.',
                heroSubtitle: 'SmartStudy builds your day-by-day reading plan automatically from your real exam date, and turns studying into something you actually want to open every day.',
                ctaBtn: 'Start for free',
                ctaNote: 'No credit card · No ads · Free forever',
                skipToFocus: 'Or just start a focus session now — no setup',
                quickGuestName: 'Guest',
                stepsTitle: 'How it works',
                newBadge: 'New',
                step1Title: '1. Pick your exam',
                step1Desc: 'Choose from 23+ real TCAS subjects — TGAT, TPAT1-5, every A-Level — or define your own subject and topics in seconds.',
                step2Title: '2. Set your exam date & hours',
                step2Desc: 'Tell it when you sit the exam and how many hours a day you can study — a full day-by-day reading plan is generated automatically.',
                step3Title: '3. Follow the plan, daily',
                step3Desc: "Check off today's topics right from your dashboard and build a gentle, forgiving study streak.",
                step4Title: '4. Track real readiness',
                step4Desc: 'Use Focus mode with live ambient sound, then watch your composite readiness score — not just a flat "% done" — climb over time.',
                compareTitle: 'How this is different from a typical planner',
                compareThemLabel: 'A typical planner app',
                compareThem1: 'You type in your own schedule by hand.',
                compareThem2: 'Progress is one flat "% done" bar.',
                compareThem3: 'Ambient sound = a looping mp3 file.',
                compareThem4: 'Studying alone, with no sense anyone else is doing it too.',
                compareUsLabel: 'SmartStudy',
                compareUs1: 'The plan is generated for you from your exam date.',
                compareUs2: 'A composite score that also rewards consistency.',
                compareUs3: 'Sound synthesized live with Web Audio — zero files.',
                compareUs4: "See an anonymous live count of how many others are focusing right now — no names, no chat, never a public ranking.",
                finalTitle: 'Ready to plan your exam prep properly?',
                footerNote: 'Built for students preparing for TCAS.'
            },
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
                tabLogin: 'Log in', tabSignup: 'Sign up',
                emailLabel: 'Email', passwordLabel: 'Password',
                loginBtn: 'Log in', signupBtn: 'Create account',
                avatarHint: 'Optional — tap to choose a photo', passwordHint: 'At least 6 characters.',
                orDivider: 'or',
                forgotPassword: 'Forgot your password?',
                guestSectionLabel: 'Use without an account (this device only)',
                errFillFields: 'Please fill in all fields.'
            },
            s1: {
                stepLabel: 'Step {n} of 3',
                title: 'Your Goal',
                subtitle: 'Which exam are you preparing for?',
                hint: '*Pick just one subject so you can focus fully (choose another once you finish it)',
                topicsHeading: 'Topics to cover:',
                next: 'Next',
                errSelectSubject: 'Please choose a subject to continue.',
                completedTag: '✓ Completed',
                completedDisabledHint: "You've already finished this subject — pick another one.",
                addCustomDesc: 'Create your own subject and topics',
                deleteCustomTitle: 'Delete this subject?',
                deleteCustomMsg: 'The "{name}" subject and all its progress will be permanently deleted.'
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
                overloadHoursNudged: 'Set to {hrs}h/day — tap "Generate my study plan" again to rebuild it.',
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
                todoTitle: "Topics to read",
                lessonsUnit: 'topics',
                tickHint: 'Tap to mark as done',
                emptyChecklist: "No subject selected yet — pick your first one and we'll build a reading plan automatically.",
                emptyChecklistCta: 'Choose a subject',
                readAheadText: "Nice work! You've hit today's target. Want to keep reading ahead?",
                readAheadBtn: 'Keep reading',
                streakBadge: '{n}-day streak',
                streakFreezesLeft: '{n} freeze day(s) left this month',
                notTodayBtn: 'Not feeling it today',
                notTodayToast: "No worries — take the day off. Today's remaining topics have been pushed to the next days.",
                readinessScoreTitle: 'Composite exam-readiness score',
                readinessScoreHint: "Not just content % — consistency counts too",
                readinessFactorContent: 'Content finished',
                readinessFactorConsistency: 'Goal hit rate (last 7 days)',
                readinessFactorStreak: 'Consistency (streak)'
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
            modalWeakDecks: {
                title: 'Weak spots', hint: 'Decks sorted by your accuracy over the last 30 days — lowest first. Tap one to review it now.',
                empty: "Not enough review data yet to analyze — review a deck first.",
                reviewCount: '{n} reviews'
            },
            modalOverload: {
                title: 'Tight schedule',
                message: "The remaining content needs about {needHours}h of reading, but the days left before your exam at {haveHours}h/day only add up to about {capacityHours}h (a gap of about {gapHours}h). Pick one of the options below.",
                increaseHours: 'Increase daily hours', changeSubject: 'Choose a different subject or trim content'
            },
            modalStats: { title: 'This week', createCardBtn: 'Create a shareable card' },
            modalRecap: {
                title: 'Your progress card',
                hint: "Just your own progress — nothing here compares you to anyone else.",
                shareBtn: 'Share', downloadBtn: 'Download image'
            },
            modalBoardingPass: {
                title: 'Your boarding pass',
                seatLabel: 'Seat', durationLabel: 'Duration', boardingLabel: 'Boarding', now: 'Now', dateLabel: 'Date',
                tip: '📵 Tip: turn on Do Not Disturb or Airplane Mode before boarding, for full focus.',
                checkInBtn: 'Check in & start flying'
            },
            recap: {
                streakLabel: 'day streak',
                weekLabel: 'Focus time this week',
                bestTimeLabel: 'Focuses best in the',
                footerLine: "For your own goals — not a competition with anyone ✨",
                shareUnsupported: "This device can't share images directly — try downloading and sharing it yourself.",
                shareFailed: 'Share failed — try downloading the image instead.'
            },
            garden: {
                stageSeed: 'Just planted the first seed 🌱',
                stageSprout: 'Sprouting',
                stageGrowing: 'Growing steadily',
                stageBlooming: 'Almost in full bloom',
                stageFull: 'Your tree is in full bloom 🌸',
                hoursCaption: '{hrs} of focus time in total, all-time'
            },
            stats: {
                summaryTotal: "You focused for {hrs} total this week.",
                summaryUp: 'That is {hrs} more than the week before.',
                summaryDown: 'That is {hrs} less than the week before.',
                summaryLeastSubject: '{subject} has gotten the least attention lately.',
                thisWeekLabel: 'Total focus time, last 7 days',
                deltaUp: 'Up {hrs} from the previous 7 days',
                deltaDown: 'Down {hrs} from the previous 7 days',
                deltaSame: 'Same as the previous 7 days',
                perSubjectTitle: 'Time spent per subject',
                bestTimeOfDay: 'You tend to focus best in the {time}',
                bucket: { morning: 'morning', afternoon: 'afternoon', evening: 'evening', night: 'late night' }
            },
            modalDeleteCard: { title: 'Delete word', selectLabel: 'Choose a word to delete', warning: '*This cannot be undone.', ok: 'Delete word' },
            modalCustomSubject: {
                title: 'Create my own subject',
                nameLabel: 'Subject name',
                namePlaceholder: 'e.g. IELTS, driving test, a school course',
                topicsLabel: 'Topics to read',
                addTopic: 'Add a topic',
                topicPlaceholder: 'e.g. Chapter 1: Basic vocabulary',
                errName: 'Please name your subject first.',
                errTopics: 'Please add at least one topic.'
            },
            modalRename: {
                title: 'Edit profile',
                success: 'Profile saved.'
            },
            modalForgotPassword: {
                title: 'Reset your password',
                hint: "Only works with the email you actually signed up with — a different address gets no email at all (and won't show an error either, to protect account privacy).",
                send: 'Send reset link',
                sent: "Request sent. If this email really has an account, a link will arrive within a minute or two — check your spam/junk folder too."
            },
            modalAuth: {
                errEmailInUse: 'That email already has an account — try logging in instead?',
                errInvalidEmail: 'That email address looks invalid.',
                errWeakPassword: 'Password must be at least 6 characters.',
                errUserNotFound: 'No account found with that email.',
                errWrongPassword: 'Incorrect email or password.',
                errNetwork: 'Could not reach the network — please try again.',
                errTooMany: 'Too many attempts — please wait a moment and try again.',
                errGeneric: 'Something went wrong — please try again.'
            },
            modalHistory: {
                title: 'Reading history',
                empty: "You haven't finished any topics yet — start ticking them off on the first screen.",
                countLabel: '{n}/{total} topics finished'
            },
            modalReport: {
                title: 'Report a bug / suggestion',
                hint: 'Opens your email app with this pre-filled, addressed to the developer.',
                label: 'What happened, or what would you like to see?',
                placeholder: 'Type details here...',
                send: 'Open email',
                errEmpty: 'Please type a message before sending.'
            },
            modalAddCard: { title: 'Add new word', termLabel: 'Term', defLabel: 'Definition', exampleLabel: 'Example sentence', save: 'Add word', errRequired: 'Please fill in both the term and the definition.', bulkImportLink: 'Paste in multiple words at once instead' },
            modalBulkImport: {
                title: 'Bulk import',
                hint: 'One word per line. Separate the term and definition with a "|", a tab, or " - ".',
                placeholder: 'apple | an apple\nbanana - a banana',
                previewBtn: 'Preview before importing',
                confirmBtn: 'Import',
                errNoneParsed: "Couldn't parse any words from that — check your separators and try again.",
                summary: '{n} words found, ready to import.',
                summaryWithSkipped: '{n} words found, ready to import ({skipped} line(s) skipped — no separator found).',
                importedToast: 'Imported {n} words 🎉'
            },
            modalAddDeck: { title: 'Create deck', nameLabel: 'Deck name', namePlaceholder: 'e.g. Social Studies, Biology', errRequired: 'Please name your deck.', errExists: 'A deck with this name already exists.' },
            s5: {
                title: 'Vocabulary', deckLabel: 'Deck:', progressCount: '{current} / {total} words',
                term: 'Term', hintTap: 'Tap to reveal meaning', meaning: 'Meaning',
                example: 'Example: {ex}', noExample: 'No example sentence',
                gradeAgain: 'Again', gradeHard: 'Hard', gradeGood: 'Good', gradeEasy: 'Easy',
                nothingDueTitle: 'Nothing due for review right now', nothingDueHint: 'Nice work! Come back when the schedule says these are due again, or review the whole deck anyway.',
                newCardCapHint: "You've hit today's new-card limit ({n}). More tomorrow!",
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
                coStudyToggleLabel: "Share that you're on this flight (no names, no chat)",
                coStudyCountActive: '🟢 {n} other(s) on the same flight as you right now',
                coStudyCountAlone: "You're the only one on this flight so far — invite a friend to join you",
                coStudyUnavailable: "This feature isn't available right now",
                flightPickerLabel: 'Choose your flight',
                flightMinutes: '{n} min',
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
                themeLight: 'Light', themeDark: 'Dark', themePaper: 'Paper', themeNight: 'Night', themeSystem: 'Follow system',
                dailyGoal: 'Daily study goal (hours)', examDate: 'Exam date',
                pomodoroSection: 'Focus timer (Pomodoro)',
                focusMin: 'Focus length (min)', shortBreakMin: 'Short break (min)',
                longBreakMin: 'Long break (min)', cycles: 'Cycles before long break',
                flashcardsSection: 'Flashcards', newCardsPerDay: 'New cards per day',
                soundSection: 'Sound', soundEnabled: 'Enable notification sound',
                accountSection: 'Account', renameBtn: 'Edit profile (name/photo)',
                switchProfile: 'Switch profile', logout: 'Log out',
                historySection: 'Reading history', historyBtn: "See what you've finished",
                feedbackSection: 'Feedback', reportBtn: 'Report a bug / suggestion'
            },
            streak: {
                freezeUsedToast: 'Used {n} freeze day(s) — {left} left this month. Your streak is still intact.'
            },
            errors: {
                storageUnavailable: "This browser can't persist data here (e.g. private browsing). Changes will be lost when you close this tab.",
                corruptData: 'Your saved data was corrupted, so a fresh start was loaded automatically.',
                setGoalMin: 'Come on, set at least 1 minute! 🎯',
                stopTimerFirst: 'Please stop the timer before editing the goal.'
            },
            aria: {
                closeDialog: 'Close dialog', openSettings: 'Open settings', openSearch: 'Search', openWeakDecks: 'Weak spots', openStats: 'Weekly stats',
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
