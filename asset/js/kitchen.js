// ============================================================
// kitchen.js — TRANG BẾP (Kitchen.html)
// ------------------------------------------------------------
// Bếp thấy mọi món Phục vụ đã "Xác nhận" (coffee_tables_v1 -> bàn -> items có confirmed = true).
// Các món của CÙNG MỘT BÀN gửi cùng lúc (cùng confirmedAt) được gom thành 1 phiếu.
// Mỗi món có trường kStatus do bếp đặt:
//   'waiting' (chờ làm)  --Nhận làm-->  'making' (đang làm)  --Xong-->  'done' (đã xong, ghi doneAt)
// Phục vụ nhận thông báo (chấm đỏ + toast) ở notifications.js ngay khi món chuyển 'done'.
// Khi Phục vụ thanh toán xong, bàn về trống nên món tự biến mất khỏi Bếp.
//
// Tính năng: gom phiếu theo bàn, nút "tất cả" cho cả phiếu, nhận/xong từng món,
// phiếu đổi vàng (>3 phút) / đỏ (>5 phút), đồng hồ mm:ss cho món đang làm,
// giữ màn hình luôn sáng.
// ============================================================
(function () {
    'use strict';

    const TABLES_KEY = 'coffee_tables_v1';
    const DONE_SHOW_MS = 30 * 60 * 1000; // cột "Đã xong" chỉ giữ 30 phút gần nhất
    const WARN_MS = 3 * 60 * 1000;       // chờ quá 3 phút -> vàng
    const LATE_MS = 5 * 60 * 1000;       // chờ quá 5 phút -> đỏ

    const $ = id => document.getElementById(id);
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function readTables() {
        try { const s = JSON.parse(localStorage.getItem(TABLES_KEY)); return Array.isArray(s) ? s : []; } catch (e) { return []; }
    }
    function writeTables(list) {
        try { localStorage.setItem(TABLES_KEY, JSON.stringify(list)); return true; }
        catch (e) { alert('Không lưu được trạng thái món. Kiểm tra lại trình duyệt rồi thử lại.'); return false; }
    }

    // Gom toàn bộ món đã gửi bếp thành danh sách phẳng
    function collect(now) {
        const out = [];
        readTables().forEach(t => (t.items || []).forEach(i => {
            if (!i.confirmed || !i.kStatus) return;
            if (i.kStatus === 'done' && now - (Number(i.doneAt) || 0) > DONE_SHOW_MS) return;
            out.push({ tableId: t.id, tableName: t.name, lineId: i.lineId, name: i.name, qty: i.quantity, note: i.note || '',
                       status: i.kStatus, since: Number(i.confirmedAt) || now, startedAt: Number(i.startedAt) || 0, doneAt: Number(i.doneAt) || 0 });
        }));
        return out;
    }

    // Gom các món cùng bàn + cùng lúc gửi thành 1 phiếu
    function group(items) {
        const map = new Map();
        items.forEach(x => {
            const key = x.tableId + ':' + x.since;
            if (!map.has(key)) map.set(key, { key, tableId: x.tableId, tableName: x.tableName, since: x.since, doneAt: 0, items: [] });
            const g = map.get(key);
            g.items.push(x);
            g.doneAt = Math.max(g.doneAt, x.doneAt);
        });
        return [...map.values()];
    }

    // Đổi trạng thái nhiều món cùng lúc. Luôn đọc mới từ localStorage trước khi ghi để không đè thay đổi của Phục vụ.
    function setStatus(tableId, lineIds, status) {
        const list = readTables();
        const t = list.find(x => x.id === tableId);
        const items = t ? (t.items || []).filter(i => i.confirmed && lineIds.includes(i.lineId)) : [];
        if (!items.length) { render(); return; } // món vừa bị Phục vụ xóa / bàn đã thanh toán
        const now = Date.now();
        items.forEach(item => {
            item.kStatus = status;
            if (status === 'making') { item.startedAt = now; delete item.doneAt; }
            else if (status === 'done') { if (!item.startedAt) item.startedAt = now; item.doneAt = now; }
            else if (status === 'waiting') { delete item.startedAt; delete item.doneAt; }
        });
        if (writeTables(list)) render();
    }

    // ---------- Hiển thị ----------
    const seenBatches = new Set();   // phiếu đã từng hiện, để biết phiếu nào MỚI
    let firstRender = true;
    let lastSig = '';

    function fmtElapsed(ms) {
        const m = Math.max(0, Math.floor(ms / 60000));
        if (m < 1) return 'vừa gửi';
        if (m < 60) return `${m} phút`;
        return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
    }
    function fmtMMSS(ms) {
        const s = Math.max(0, Math.floor(ms / 1000));
        return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }
    const urgency = ms => ms > LATE_MS ? 'late' : ms > WARN_MS ? 'warn' : '';

    function lineHtml(x, status, multi, now) {
        const timer = status === 'making' && x.startedAt ? `<span class="k-timer" data-start="${x.startedAt}">${fmtMMSS(now - x.startedAt)}</span>` : '';
        let btn = '';
        if (multi && status === 'waiting') btn = `<button type="button" class="k-btn mini" data-table="${x.tableId}" data-lines="${esc(x.lineId)}" data-to="making">Nhận</button>`;
        else if (multi && status === 'making') btn = `<button type="button" class="k-btn mini go" data-table="${x.tableId}" data-lines="${esc(x.lineId)}" data-to="done">Xong</button>`;
        return `<li class="k-line">
            <span class="k-qty">${x.qty}</span>
            <span class="k-name">${esc(x.name)}${x.note ? `<span class="k-note">${esc(x.note)}</span>` : ''}</span>
            ${timer}${btn ? `<span class="k-line-btns">${btn}</span>` : ''}
        </li>`;
    }

    function orderHtml(g, status, now) {
        const isDone = status === 'done';
        const ref = isDone ? g.doneAt : g.since;
        const elapsed = now - ref;
        const urg = isDone ? '' : urgency(elapsed);
        const isNew = !firstRender && !seenBatches.has(g.key) && status === 'waiting';
        const multi = g.items.length > 1;
        const lines = g.items.map(x => x.lineId).join(',');
        const base = `data-table="${g.tableId}" data-lines="${esc(lines)}"`;
        let actions;
        if (status === 'waiting') {
            actions = `<button type="button" class="k-btn primary" ${base} data-to="making">${multi ? `Nhận làm tất cả (${g.items.length})` : 'Nhận làm'}</button>`;
        } else if (status === 'making') {
            actions = `<button type="button" class="k-btn go" ${base} data-to="done">${multi ? `Xong tất cả (${g.items.length})` : 'Xong'}</button>
                       <button type="button" class="k-btn ghost" ${base} data-to="waiting" title="Trả về cột Chờ làm">Trả về chờ</button>`;
        } else {
            actions = `<button type="button" class="k-btn ghost" ${base} data-to="making">Hoàn tác</button>`;
        }
        return `<article class="k-order ${urg}" data-key="${esc(g.key)}">
            <div class="k-order-top">
                <span class="k-table">${esc(g.tableName)}${isNew ? '<span class="k-new">Mới</span>' : ''}</span>
                <span class="k-elapsed" data-ref="${ref}" data-live="${isDone ? 0 : 1}">${isDone ? 'xong ' : ''}${fmtElapsed(elapsed)}${isDone ? ' trước' : ''}</span>
            </div>
            <ul class="k-lines">${g.items.map(x => lineHtml(x, status, multi, now)).join('')}</ul>
            <div class="k-actions">${actions}</div>
        </article>`;
    }

    function render() {
        const now = Date.now();
        const all = collect(now);
        const by = s => all.filter(x => x.status === s);
        const groups = s => group(by(s));
        const waiting = groups('waiting').sort((a, b) => a.since - b.since);
        const making = groups('making').sort((a, b) => a.since - b.since);
        const done = groups('done').sort((a, b) => b.doneAt - a.doneAt);

        const fill = (listId, countId, arr, status, emptyText) => {
            $(listId).innerHTML = arr.length ? arr.map(g => orderHtml(g, status, now)).join('') : `<div class="k-empty">${emptyText}</div>`;
            $(countId).textContent = arr.reduce((n, g) => n + g.items.length, 0);
        };
        fill('kListWaiting', 'kCountWaiting', waiting, 'waiting', 'Không có món nào đang chờ.');
        fill('kListMaking', 'kCountMaking', making, 'making', 'Chưa nhận làm món nào.');
        fill('kListDone', 'kCountDone', done, 'done', 'Chưa có món nào xong.');

        const nW = by('waiting').length, nM = by('making').length;
        $('kSummary').textContent = (nW + nM)
            ? `${nW} món chờ · ${nM} món đang làm · ${waiting.length + making.length} phiếu`
            : 'Hiện không còn món nào cần làm.';

        [...waiting, ...making, ...done].forEach(g => seenBatches.add(g.key));
        firstRender = false;
        lastSig = signature();
    }

    function signature() {
        return JSON.stringify(readTables().map(t => (t.items || []).map(i => [i.lineId, i.confirmed, i.kStatus, i.quantity, i.note])));
    }

    // Mỗi giây: cập nhật đồng hồ và màu phiếu mà không vẽ lại cả bảng
    function tick() {
        const now = Date.now();
        document.querySelectorAll('.k-elapsed').forEach(el => {
            const ref = Number(el.dataset.ref), live = el.dataset.live === '1';
            el.textContent = live ? fmtElapsed(now - ref) : 'xong ' + fmtElapsed(now - ref) + ' trước';
            if (live) {
                const card = el.closest('.k-order'), u = urgency(now - ref);
                card.classList.toggle('warn', u === 'warn');
                card.classList.toggle('late', u === 'late');
            }
        });
        document.querySelectorAll('.k-timer').forEach(el => { el.textContent = fmtMMSS(now - Number(el.dataset.start)); });
    }

    let wakeLock = null;
    async function keepAwake() {
        try { if ('wakeLock' in navigator && document.visibilityState === 'visible') wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}
    }

    document.addEventListener('DOMContentLoaded', () => {
        render();

        document.querySelector('.k-board').addEventListener('click', e => {
            const btn = e.target.closest('button[data-to]');
            if (!btn) return;
            setStatus(Number(btn.dataset.table), btn.dataset.lines.split(','), btn.dataset.to);
        });
        keepAwake();
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { keepAwake(); render(); } });

        // Phục vụ gửi món mới / sửa món ở tab khác -> cập nhật ngay
        window.addEventListener('storage', e => { if (e.key === TABLES_KEY) render(); });
        // Phòng khi sự kiện storage không tới: kiểm tra lại mỗi 3 giây, chỉ vẽ lại khi dữ liệu đổi
        setInterval(() => { if (signature() !== lastSig) render(); }, 3000);
        setInterval(tick, 1000);
        // Cột "Đã xong" tự bỏ món quá 30 phút
        setInterval(render, 60000);
    });
})();