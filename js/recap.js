/**
 * recap.js
 * A personal, shareable "progress card" — a canvas-rendered image a
 * learner can post to their own Instagram/Line story. This exists because
 * Gen Z learners respond to "recap culture" (Spotify Wrapped, Duolingo's
 * year-in-review) far better than to gamified competition, and it's a
 * genuinely safe fit for this app's "never compare to other users" rule:
 * every number on the card is the learner's own, there is no ranking, no
 * other person's name or number ever appears on it, and sharing it is
 * entirely the learner's choice — nothing here is posted automatically or
 * pushed to any feed by the app itself.
 *
 * Deliberately built with the plain Canvas 2D API rather than a library
 * like html2canvas: this app has no bundler and loads nothing from a CDN
 * except a couple of Google Fonts, so a hand-drawn canvas keeps the same
 * "zero dependencies" footprint as everything else here.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};
    const U = TFS.Utils;
    const I18n = TFS.I18n;
    const State = TFS.State;

    const W = 1080, H = 1920;

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    function collectRecapData() {
        const s = State.get();
        const subject = s.plan.subject ? TFS.Data.getSubject(s.plan.subject) : null;
        const progress = subject ? (s.syllabusProgress[subject.id] || {}) : {};
        const total = subject ? subject.topics.length : 0;
        const completed = Object.keys(progress).length;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

        const weekly = TFS.Stats ? TFS.Stats.weeklyComparison() : { thisWeekSeconds: 0 };
        const bestTime = TFS.Stats ? TFS.Stats.bestTimeOfDay() : null;

        return {
            subjectName: subject ? I18n.pick(subject.name) : null,
            percent, streak: s.streak.current,
            weekSeconds: weekly.thisWeekSeconds,
            bestTimeKey: bestTime
        };
    }

    async function ensureFontsReady() {
        try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) { /* draw with whatever's available */ }
    }

    function drawTextCentered(ctx, text, cx, y, font, color) {
        ctx.font = font;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(text, cx, y);
    }

    async function render(canvas) {
        await ensureFontsReady();
        const data = collectRecapData();
        const ctx = canvas.getContext('2d');

        // Background: the same diagonal brand-blue gradient as the app icon.
        const grad = ctx.createLinearGradient(0, 0, W, H);
        grad.addColorStop(0, '#0058bc');
        grad.addColorStop(1, '#141e40');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // Header: small book glyph + app name.
        const cx = W / 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(cx - 55, 150); ctx.lineTo(cx, 118); ctx.lineTo(cx + 55, 150);
        ctx.moveTo(cx, 118); ctx.lineTo(cx, 178);
        ctx.moveTo(cx - 55, 150); ctx.lineTo(cx - 55, 178); ctx.lineTo(cx, 205);
        ctx.moveTo(cx + 55, 150); ctx.lineTo(cx + 55, 178); ctx.lineTo(cx, 205);
        ctx.stroke();
        drawTextCentered(ctx, 'The Focused Scholar', cx, 270, '600 34px "Plus Jakarta Sans", sans-serif', 'rgba(255,255,255,0.85)');

        // Streak — the headline number.
        drawTextCentered(ctx, '🔥', cx, 480, '120px sans-serif', '#ffffff');
        drawTextCentered(ctx, String(data.streak), cx, 640, '800 190px "Plus Jakarta Sans", sans-serif', '#ffffff');
        drawTextCentered(ctx, I18n.t('recap.streakLabel'), cx, 700, '500 40px "Kanit", sans-serif', 'rgba(255,255,255,0.85)');

        // Stats card.
        const cardX = 90, cardY = 800, cardW = W - 180, cardH = 560;
        ctx.fillStyle = 'rgba(255,255,255,0.96)';
        roundRect(ctx, cardX, cardY, cardW, cardH, 48);
        ctx.fill();

        const rows = [];
        rows.push({ label: I18n.t('recap.weekLabel'), value: U.formatSecondsToHHMM(data.weekSeconds) });
        if (data.subjectName) rows.push({ label: data.subjectName, value: data.percent + '%' });
        if (data.bestTimeKey) rows.push({ label: I18n.t('recap.bestTimeLabel'), value: I18n.t('stats.bucket.' + data.bestTimeKey) });

        const rowH = cardH / Math.max(rows.length, 1);
        rows.forEach((row, i) => {
            const rowCenterY = cardY + rowH * i + rowH / 2;
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.font = '500 38px "Kanit", sans-serif';
            ctx.fillStyle = '#44474a';
            ctx.fillText(row.label, cardX + 56, rowCenterY, cardW - 320);
            ctx.textAlign = 'right';
            ctx.font = '800 56px "Plus Jakarta Sans", sans-serif';
            ctx.fillStyle = '#0058bc';
            ctx.fillText(row.value, cardX + cardW - 56, rowCenterY);
            if (i > 0) {
                ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(cardX + 56, cardY + rowH * i); ctx.lineTo(cardX + cardW - 56, cardY + rowH * i); ctx.stroke();
            }
        });

        // Footer: a one-line note that this is personal, not a competition,
        // plus the date — never another user's name or number anywhere here.
        drawTextCentered(ctx, I18n.t('recap.footerLine'), cx, 1620, '500 34px "Kanit", sans-serif', 'rgba(255,255,255,0.85)');
        drawTextCentered(ctx, I18n.formatDate(new Date()), cx, 1690, '400 30px "Kanit", sans-serif', 'rgba(255,255,255,0.6)');
        drawTextCentered(ctx, 'smartstudy', cx, 1840, '600 30px "Plus Jakarta Sans", sans-serif', 'rgba(255,255,255,0.5)');
    }

    // ---------------------------------------------------------------- UI

    const recapModal = document.getElementById('recapModal');
    const recapCanvas = document.getElementById('recapCanvas');
    const recapShareBtn = document.getElementById('recapShareBtn');
    const recapDownloadBtn = document.getElementById('recapDownloadBtn');

    function canvasToBlob(canvas) {
        return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    }

    document.getElementById('openRecapBtn').addEventListener('click', async () => {
        TFS.Modal.close('statsModal');
        setTimeout(async () => {
            TFS.Modal.open(recapModal);
            await render(recapCanvas);
            // Web Share API (with file support) works on most mobile browsers
            // and is the direct route to "share to Instagram/Line"; offered
            // only when the platform actually supports sharing files, with
            // download always available as the universal fallback.
            recapShareBtn.hidden = !(navigator.canShare && navigator.share);
        }, 200);
    });

    document.getElementById('closeRecapBtn').addEventListener('click', () => TFS.Modal.close(recapModal));

    recapShareBtn.addEventListener('click', async () => {
        try {
            const blob = await canvasToBlob(recapCanvas);
            const file = new File([blob], 'smartstudy-progress.png', { type: 'image/png' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: I18n.t('modalRecap.title') });
            } else {
                TFS.Toast.warn(I18n.t('recap.shareUnsupported'));
            }
        } catch (e) {
            if (e && e.name !== 'AbortError') { console.warn('[recap] share failed', e); TFS.Toast.error(I18n.t('recap.shareFailed')); }
        }
    });

    recapDownloadBtn.addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = recapCanvas.toDataURL('image/png');
        a.download = 'smartstudy-progress.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
    });

})(window);
