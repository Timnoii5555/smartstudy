/**
 * data/airports.js
 * A curated set of real Thailand airports (id, IATA code, city name in
 * TH/EN, real coordinates) — grounds the flight visual's departure point
 * (js/geo.js, js/focus.js) in real geography instead of always assuming
 * Bangkok, so "use my location" and the boarding pass's distance field mean
 * something real.
 *
 * Not a full worldwide database on purpose: every learner using this app is
 * preparing for a Thai university entrance exam, so a focused, hand-checked
 * list of real Thai airports is more reliable than a huge bundled dataset
 * this project — which deliberately has no build step (see js/utils.js's
 * header) — has no good way to fetch or verify automatically. A learner
 * whose device reports a location outside Thailand still gets a real
 * result: whichever of these is nearest, however far that ends up being.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};

    TFS.AIRPORTS = [
        { id: 'bkk', code: 'BKK', name: { th: 'สุวรรณภูมิ (กรุงเทพฯ)', en: 'Suvarnabhumi (Bangkok)' }, latlng: [13.6900, 100.7501] },
        { id: 'dmk', code: 'DMK', name: { th: 'ดอนเมือง (กรุงเทพฯ)', en: 'Don Mueang (Bangkok)' }, latlng: [13.9126, 100.6067] },
        { id: 'cnx', code: 'CNX', name: { th: 'เชียงใหม่', en: 'Chiang Mai' }, latlng: [18.7669, 98.9626] },
        { id: 'cei', code: 'CEI', name: { th: 'เชียงราย', en: 'Chiang Rai' }, latlng: [19.9523, 99.8828] },
        { id: 'hgn', code: 'HGN', name: { th: 'แม่ฮ่องสอน', en: 'Mae Hong Son' }, latlng: [19.3013, 97.9757] },
        { id: 'nnt', code: 'NNT', name: { th: 'น่าน', en: 'Nan' }, latlng: [18.8078, 100.7827] },
        { id: 'ths', code: 'THS', name: { th: 'สุโขทัย', en: 'Sukhothai' }, latlng: [17.2384, 99.8177] },
        { id: 'uth', code: 'UTH', name: { th: 'อุดรธานี', en: 'Udon Thani' }, latlng: [17.3864, 102.7881] },
        { id: 'kkc', code: 'KKC', name: { th: 'ขอนแก่น', en: 'Khon Kaen' }, latlng: [16.4666, 102.7838] },
        { id: 'loe', code: 'LOE', name: { th: 'เลย', en: 'Loei' }, latlng: [17.4392, 101.7222] },
        { id: 'sno', code: 'SNO', name: { th: 'สกลนคร', en: 'Sakon Nakhon' }, latlng: [17.1953, 104.1178] },
        { id: 'kop', code: 'KOP', name: { th: 'นครพนม', en: 'Nakhon Phanom' }, latlng: [17.3836, 104.6428] },
        { id: 'ubp', code: 'UBP', name: { th: 'อุบลราชธานี', en: 'Ubon Ratchathani' }, latlng: [15.2513, 104.8703] },
        { id: 'roi', code: 'ROI', name: { th: 'ร้อยเอ็ด', en: 'Roi Et' }, latlng: [16.1467, 103.7749] },
        { id: 'bfv', code: 'BFV', name: { th: 'บุรีรัมย์', en: 'Buriram' }, latlng: [15.2286, 103.2519] },
        { id: 'nak', code: 'NAK', name: { th: 'นครราชสีมา', en: 'Nakhon Ratchasima' }, latlng: [14.9536, 102.0819] },
        { id: 'tdx', code: 'TDX', name: { th: 'ตราด', en: 'Trat' }, latlng: [12.2728, 102.3189] },
        { id: 'utp', code: 'UTP', name: { th: 'อู่ตะเภา (พัทยา)', en: 'U-Tapao (Pattaya)' }, latlng: [12.6799, 101.0050] },
        { id: 'hhq', code: 'HHQ', name: { th: 'หัวหิน', en: 'Hua Hin' }, latlng: [12.6360, 99.9535] },
        { id: 'urt', code: 'URT', name: { th: 'สุราษฎร์ธานี', en: 'Surat Thani' }, latlng: [9.1327, 99.1352] },
        { id: 'usm', code: 'USM', name: { th: 'เกาะสมุย', en: 'Koh Samui' }, latlng: [9.5478, 100.0625] },
        { id: 'cjm', code: 'CJM', name: { th: 'ชุมพร', en: 'Chumphon' }, latlng: [10.7112, 99.3617] },
        { id: 'nst', code: 'NST', name: { th: 'นครศรีธรรมราช', en: 'Nakhon Si Thammarat' }, latlng: [8.5397, 99.9469] },
        { id: 'hkt', code: 'HKT', name: { th: 'ภูเก็ต', en: 'Phuket' }, latlng: [8.1132, 98.3169] },
        { id: 'kbv', code: 'KBV', name: { th: 'กระบี่', en: 'Krabi' }, latlng: [8.0991, 98.9862] },
        { id: 'unn', code: 'UNN', name: { th: 'ระนอง', en: 'Ranong' }, latlng: [9.7779, 98.5858] },
        { id: 'tst', code: 'TST', name: { th: 'ตรัง', en: 'Trang' }, latlng: [7.5089, 99.6167] },
        { id: 'hdy', code: 'HDY', name: { th: 'หาดใหญ่', en: 'Hat Yai' }, latlng: [6.9333, 100.3931] },
        { id: 'naw', code: 'NAW', name: { th: 'นราธิวาส', en: 'Narathiwat' }, latlng: [6.5198, 101.7434] }
    ];

})(window);
