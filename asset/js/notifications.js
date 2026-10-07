// ============================================================
// notifications.js — THÔNG BÁO MÓN CHO NHÂN VIÊN PHỤC VỤ (Table.html)
// ------------------------------------------------------------
// - (Thu ngân cũng dùng) Thêm nút "Thông báo", "Thanh toán", "Giao ca" vào sidebar của Phục vụ / Thu ngân, có chấm đỏ + số tin mới (giống Zalo/Facebook).
// - Bấm vào: hiện từng bàn đang có món, bàn nào ĐỦ MÓN (mang ra được) / THIẾU mấy món,
//   và từng món đang ở trạng thái: Đã xong / Đang làm / Chờ làm (do BẾP đặt ở trang Kitchen.html, trường kStatus).
// - Dữ liệu lấy từ bàn trong localStorage ('coffee_tables_v1'): mỗi món đã Xác nhận có startAt/readyAt
//   (xem confirmOrder trong table-order.js). Trạng thái được TÍNH từ thời gian hiện tại nên không cần
//   backend; khi nối backend chỉ cần thay readTables() bằng dữ liệu thật (món có trạng thái từ bếp).
// - Bàn tự biến mất khỏi danh sách khi Phục vụ thanh toán xong (bàn về trống).
// ============================================================
(function () {
    'use strict';

    const TABLES_KEY = 'coffee_tables_v1';
    const SEEN_KEY = 'coffee_notif_seen_v1'; // mốc thời gian lần cuối Phục vụ mở xem thông báo

    const $ = id => document.getElementById(id);
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function readTables() {
        try { const s = JSON.parse(localStorage.getItem(TABLES_KEY)); return Array.isArray(s) ? s : []; } catch (e) { return []; }
    }
    function getSeen() { const v = Number(localStorage.getItem(SEEN_KEY)); return v > 0 ? v : null; }
    function setSeen(t) { try { localStorage.setItem(SEEN_KEY, String(t)); } catch (e) {} }

    // ---------- Phân tích trạng thái 1 bàn ----------
    // state món: 'done' (đã xong) | 'making' (đang làm) | 'waiting' (chờ tới lượt)
    function analyzeTable(table, now) {
        const items = (table.items || []).filter(i => i.confirmed); // món nháp chưa Xác nhận thì bếp chưa nhận
        if (!items.length) return null;
        const lines = items.map(i => {
            // Trạng thái do BẾP đặt (kStatus). Món cũ chưa có kStatus thì tính theo readyAt/startAt như trước.
            let state, readyAt = 0;
            if (i.kStatus) { state = i.kStatus; if (state === 'done') readyAt = Number(i.doneAt) || 0; }
            else {
                readyAt = Number(i.readyAt) || 0;
                state = 'done';
                if (readyAt > now) state = (Number(i.startAt) > now) ? 'waiting' : 'making';
            }
            return { id: table.id + ':' + i.lineId, table: table.name, name: i.name, qty: i.quantity, state, readyAt };
        });
        const done = lines.filter(l => l.state === 'done').length;
        return { table, lines, done, total: lines.length, missing: lines.length - done, complete: done === lines.length };
    }

    function analyzeAll(now) {
        return readTables().map(t => analyzeTable(t, now)).filter(Boolean);
    }

    // Số tin mới = số món vừa xong kể từ lần cuối mở thông báo (món cuối cùng của bàn chính là tin "bàn đủ món")
    function countUnread(now, since) {
        let n = 0;
        readTables().forEach(t => (t.items || []).forEach(i => {
            const doneTs = i.kStatus ? (i.kStatus === 'done' ? Number(i.doneAt) || 0 : 0) : Number(i.readyAt) || 0;
            if (i.confirmed && doneTs > since && doneTs <= now) n++;
        }));
        return n;
    }

    // ---------- Toast + tiếng "ting" khi bếp báo xong món ----------
    let knownDone = null; // Set id món đã xong; null = chưa khởi tạo (lần đầu chỉ ghi nhận, không báo)
    function beep() {
        try {
            const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
            const ctx = new C(), o = ctx.createOscillator(), g = ctx.createGain();
            o.type = 'sine'; o.frequency.value = 880; g.gain.value = 0.08;
            o.connect(g); g.connect(ctx.destination); o.start();
            g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
            o.stop(ctx.currentTime + 0.4); o.onended = () => ctx.close();
        } catch (e) {}
    }
    function toast(text) {
        let box = $('notifToasts');
        if (!box) { box = document.createElement('div'); box.id = 'notifToasts'; box.className = 'notif-toasts'; document.body.appendChild(box); }
        const el = document.createElement('div');
        el.className = 'notif-toast'; el.textContent = text;
        box.appendChild(el);
        setTimeout(() => el.remove(), 6000);
    }
    function checkNewlyDone() {
        const now = Date.now(), cur = new Set(), fresh = [];
        analyzeAll(now).forEach(a => a.lines.forEach(l => {
            if (l.state !== 'done') return;
            cur.add(l.id);
            if (knownDone && !knownDone.has(l.id)) fresh.push(l);
        }));
        knownDone = cur;
        if (!fresh.length) return;
        fresh.slice(0, 3).forEach(l => toast(`${l.table}: ${l.name} x${l.qty} đã xong — mang ra được`));
        if (fresh.length > 3) toast(`và ${fresh.length - 3} món khác vừa xong`);
        beep();
    }

    // ---------- Giao diện ----------
    let panelOpen = false;
    let openSeenAt = 0; // mốc "đã xem" TRƯỚC khi mở panel, để đánh dấu bàn nào có tin mới

    function updateBadge() {
        const badge = $('notifBadge');
        if (!badge) return;
        const n = panelOpen ? 0 : countUnread(Date.now(), getSeen() || Date.now());
        badge.hidden = n === 0;
        badge.textContent = n > 99 ? '99+' : String(n);
        const btn = $('navNotif');
        if (btn) btn.classList.toggle('has-new', n > 0);
    }

    const STATE_UI = {
        done:    { icon: 'fa-circle-check', label: 'Đã xong' },
        making:  { icon: 'fa-mug-hot',      label: 'Đang làm' },
        waiting: { icon: 'fa-hourglass-half', label: 'Chờ làm' }
    };

    function renderPanel() {
        const body = $('notifBody');
        if (!body) return;
        const now = Date.now();
        const list = analyzeAll(now);

        const ready = list.filter(a => a.complete).length;
        $('notifSummary').textContent = list.length
            ? `${ready} bàn đủ món · ${list.length - ready} bàn còn thiếu`
            : '';

        if (!list.length) {
            body.innerHTML = '<div class="notif-empty">Chưa có bàn nào gọi món.</div>';
            return;
        }

        // Bàn đủ món lên đầu (để mang ra ngay), sau đó tới bàn còn thiếu — bàn sắp xong nhất lên trước
        list.sort((a, b) => (b.complete - a.complete) || (a.missing - b.missing));

        body.innerHTML = list.map(a => {
            const isNew = a.lines.some(l => l.readyAt > openSeenAt && l.readyAt <= now);
            const chip = a.complete
                ? '<span class="notif-chip ok"><i class="fa-solid fa-check"></i> Đủ món — mang ra được</span>'
                : `<span class="notif-chip warn">Thiếu ${a.missing} món (xong ${a.done}/${a.total})</span>`;
            const rows = a.lines.map(l => {
                const ui = STATE_UI[l.state];
                const extra = '';
                return `<li class="notif-line ${l.state}">
                    <i class="fa-solid ${ui.icon}"></i>
                    <span class="notif-line-name">${esc(l.name)} <small>x${l.qty}</small></span>
                    <span class="notif-line-state">${ui.label}${extra}</span>
                </li>`;
            }).join('');
            return `<section class="notif-card ${a.complete ? 'complete' : 'missing'}">
                <header class="notif-card-head">
                    <b>${esc(a.table.name)}</b>
                    ${isNew ? '<span class="notif-new">Mới</span>' : ''}
                    ${chip}
                </header>
                <ul class="notif-lines">${rows}</ul>
            </section>`;
        }).join('');
    }

    function openPanel() {
        openSeenAt = getSeen() || 0;
        panelOpen = true;
        if ($('navNotif')) $('navNotif').classList.add('active');
        setSeen(Date.now());   // đã xem -> chấm đỏ tắt
        updateBadge();
        renderPanel();
        $('notifBackdrop').classList.add('active');
        $('notifPanel').classList.add('open');
    }

    function closePanel() {
        panelOpen = false;
        if ($('navNotif')) $('navNotif').classList.remove('active');
        setSeen(Date.now());
        $('notifBackdrop').classList.remove('active');
        $('notifPanel').classList.remove('open');
        updateBadge();
    }

    // Nạp timesheet.js khi cần (để không phải sửa thêm Table.html)
    function withTimesheet(cb) {
        if (window.WaiterTimesheet) return cb();
        const sc = document.createElement('script');
        sc.src = 'asset/js/timesheet.js';
        sc.onload = cb;
        document.body.appendChild(sc);
    }

    // Nạp waiter-pay.js khi cần (không phải sửa Table.html)
    function withPay(cb) {
        if (window.WaiterPay) return cb();
        const sc = document.createElement('script');
        sc.src = 'asset/js/waiter-pay.js';
        sc.onload = cb;
        document.body.appendChild(sc);
    }

    // ---------- Gắn vào trang ----------
    let mounted = false;
    function mount() {
        if (mounted) return;
        const menu = $('sidebarMenu');
        if (!menu || !menu.children.length) return; // sidebar chưa vẽ xong — chờ sự kiện 'sidebar-ready'
        const session = (typeof AuthAPI !== 'undefined') ? AuthAPI.getSession() : null;
        if (!session || (session.roleKey !== 'waiter' && session.roleKey !== 'cashier')) return; // Phục vụ và Thu ngân
        mounted = true;

        if (getSeen() === null) setSeen(Date.now()); // lần đầu dùng: chưa có tin cũ nào

        // Các nút này mở bảng/popup (không chuyển trang) nhưng dùng đúng kiểu .tab như menu của Quản lý:
        // bình thường tối, đang mở thì sáng vàng (class active). Lịch ca làm là mục menu thật (xem PAGES_BY_ROLE).
        const makeBtn = (id, cls, html) => {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'tab ' + cls; b.id = id; b.innerHTML = html;
            return b;
        };
        const btn = makeBtn('navNotif', 'nav-notif', 'Thông báo <span class="notif-badge" id="notifBadge" hidden>0</span>');
        const payBtn = makeBtn('navPay', 'nav-pay', 'Thanh toán');
        payBtn.addEventListener('click', () => withPay(() => window.WaiterPay.open()));
        const handBtn = makeBtn('navHandover', 'nav-handover', 'Giao ca');
        handBtn.addEventListener('click', () => withTimesheet(() => window.WaiterTimesheet.openHandover()));
        // Thứ tự: Bàn, Thông báo, Thanh toán, Lịch ca làm, Giao ca
        const shiftLink = menu.querySelector('a[data-view="schedule"]');
        menu.insertBefore(btn, shiftLink);
        menu.insertBefore(payBtn, shiftLink);
        menu.appendChild(handBtn);
        // Vừa vào trang sau khi đăng nhập: tự ghi GIỜ VÀO ca hôm nay
        withTimesheet(() => { window.WaiterTimesheet.recordClockIn(); window.WaiterTimesheet.refreshButton(); });

        const backdrop = document.createElement('div');
        backdrop.className = 'notif-backdrop';
        backdrop.id = 'notifBackdrop';
        const panel = document.createElement('aside');
        panel.className = 'notif-panel';
        panel.id = 'notifPanel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Thông báo món');
        panel.innerHTML = `
            <div class="notif-head">
                <div>
                    <h3>Thông báo món</h3>
                    <div class="notif-summary" id="notifSummary"></div>
                </div>
                <button type="button" class="notif-close" id="notifClose" aria-label="Đóng">&times;</button>
            </div>
            <div class="notif-body" id="notifBody"></div>`;
        document.body.appendChild(backdrop);
        document.body.appendChild(panel);

        btn.addEventListener('click', () => (panelOpen ? closePanel() : openPanel()));
        $('notifClose').addEventListener('click', closePanel);
        backdrop.addEventListener('click', closePanel);
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && panelOpen) closePanel(); });

        checkNewlyDone(); // khởi tạo mốc: món đã xong từ trước không báo lại
        // Cập nhật mỗi giây: số trên chấm đỏ, và danh sách nếu đang mở (đếm ngược "còn Ns", món xong tự đổi trạng thái)
        setInterval(() => {
            checkNewlyDone();
            if (panelOpen) { setSeen(Date.now()); renderPanel(); }
            updateBadge();
        }, 1000);
        // Bếp báo xong món / quản lý sửa bàn ở tab khác -> cập nhật ngay
        window.addEventListener('storage', e => {
            if (e.key !== TABLES_KEY) return;
            if (panelOpen) renderPanel();
            updateBadge();
        });
        updateBadge();
    }

    // Sidebar do common.js nạp bất đồng bộ -> chờ tới khi menu có mục rồi mới thêm nút (không cần sửa common.js)
    mount();
    if (!mounted) {
        const host = document.getElementById('sidebar-container') || document.body;
        const obs = new MutationObserver(() => { mount(); if (mounted) obs.disconnect(); });
        obs.observe(host, { childList: true, subtree: true });
    }
})();