/**
 * data/constellationNames.js
 * 52 calm, short names for the Night theme's weekly constellations
 * (js/gimmicks/night.js) — assigned by week-of-year index (deterministic,
 * never random), so the same week of any given year always gets the same
 * name, matching the phase brief's own requirement.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};

    TFS.CONSTELLATION_NAMES = [
        { th: 'ลมหนาว', en: 'Cold Wind' }, { th: 'ปลายฝน', en: "Rain's End" }, { th: 'คืนยาว', en: 'Long Night' },
        { th: 'ฟ้าใส', en: 'Clear Sky' }, { th: 'เดือนดับ', en: 'New Moon' }, { th: 'แสงแรก', en: 'First Light' },
        { th: 'หมอกบาง', en: 'Thin Mist' }, { th: 'ดาวรุ่ง', en: 'Morning Star' }, { th: 'เงียบงัน', en: 'Quiet Hush' },
        { th: 'ลมโชย', en: 'Gentle Breeze' }, { th: 'ฟ้าเปิด', en: 'Open Sky' }, { th: 'ดึกดื่น', en: 'Deep Night' },
        { th: 'น้ำค้าง', en: 'Dew' }, { th: 'ใบไม้ร่วง', en: 'Falling Leaves' }, { th: 'คืนสงบ', en: 'Calm Night' },
        { th: 'แสงจันทร์', en: 'Moonlight' }, { th: 'ฟ้าคราม', en: 'Azure Sky' }, { th: 'ลมพัดผ่าน', en: 'Passing Wind' },
        { th: 'ดาวไกล', en: 'Distant Star' }, { th: 'คืนหนาว', en: 'Cold Night' }, { th: 'ฟ้าโปร่ง', en: 'Open Air' },
        { th: 'แสงเทียน', en: 'Candlelight' }, { th: 'สายลม', en: 'Wind Stream' }, { th: 'ดาวเหงา', en: 'Lonely Star' },
        { th: 'คืนใส', en: 'Clear Night' }, { th: 'ฟ้าสงบ', en: 'Still Sky' }, { th: 'หยาดฝน', en: 'Raindrop' },
        { th: 'เงาจันทร์', en: 'Moon Shadow' }, { th: 'ลมเย็น', en: 'Cool Wind' }, { th: 'ดาวค้าง', en: 'Lingering Star' },
        { th: 'ฟ้าลึก', en: 'Deep Sky' }, { th: 'คืนพราว', en: 'Glittering Night' }, { th: 'ปลายลม', en: "Wind's End" },
        { th: 'แสงรุ้ง', en: 'Rainbow Light' }, { th: 'ฟ้าจาง', en: 'Fading Sky' }, { th: 'ดาวพราว', en: 'Twinkling Star' },
        { th: 'คืนเงียบ', en: 'Silent Night' }, { th: 'สายหมอก', en: 'Mist Trail' }, { th: 'ลมทะเล', en: 'Sea Breeze' },
        { th: 'ฟ้าสาง', en: 'Dawn Sky' }, { th: 'ดาวโดด', en: 'Solitary Star' }, { th: 'คืนนิ่ง', en: 'Still Night' },
        { th: 'แสงดาว', en: 'Starlight' }, { th: 'ฟ้าหม่น', en: 'Muted Sky' }, { th: 'ลมข้ามฟ้า', en: 'Wind Across the Sky' },
        { th: 'ดาวจาง', en: 'Faint Star' }, { th: 'คืนอุ่น', en: 'Warm Night' }, { th: 'ฟ้าเรียบ', en: 'Smooth Sky' },
        { th: 'เมฆบาง', en: 'Thin Cloud' }, { th: 'ดาวนับ', en: 'Counted Star' }, { th: 'คืนกว้าง', en: 'Wide Night' },
        { th: 'ฟ้าปิด', en: 'Closed Sky' }
    ];

})(window);
