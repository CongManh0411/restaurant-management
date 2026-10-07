// ============================================================
// timesheet.js — CHẤM CÔNG & GIAO CA CỦA NHÂN VIÊN PHỤC VỤ
// ------------------------------------------------------------
// Luồng: đăng nhập (tự ghi GIỜ VÀO) -> làm việc -> bấm "Giao ca" ở sidebar -> hiện NGÀY CÔNG HÔM NAY
//        (giờ vào, giờ ra, tổng giờ, tiền) + nút "Xác nhận" -> bấm Xác nhận là hết ca, quay lại màn hình
//        nhân viên -> cuối cùng nhân viên tự bấm "Đăng xuất".
//
// - Giờ vào: ghi ở lần đầu nhân viên mở trang sau khi đăng nhập trong ngày (session hiện chỉ lưu {roleKey, name}
//   nên chưa có giờ đăng nhập thật; khi có backend hãy ghi giờ này ngay lúc login).
// - Giờ ra: đúng lúc bấm "Xác nhận". Mỗi ngày chỉ có 1 lần giao ca; sau khi Xác nhận là hết.
// - Tiền = số phút làm x lương/giờ (đổi HOURLY_RATE bên dưới). Chỉ hiện tiền của chính người đang đăng nhập.
// - Giờ ra này cũng được trang Lịch ca làm đọc: giao ca sớm hơn giờ đăng ký thì bảng tự hiện "Nghỉ sớm".
//
// DỮ LIỆU — localStorage key 'coffee_timesheet_v1', mảng:
//   { staffId: 3, date: '2026-10-05', clockIn: 1790000000000, clockOut: 1790018000000 | null }  (mili-giây)
// Khi nối backend: thay load()/save() và nơi ghi giờ vào bằng API; nên để backend tự tính tiền.
// ============================================================
(function () {
    'use strict';
    if (window.WaiterTimesheet) return;

    const HOURLY_RATE = 21000; // đồng / giờ — mức chung cho cả quán
    const TS_KEY = 'coffee_timesheet_v1';
    const STAFF_KEY = 'coffee_staff_v1';
    const SHIFTS_KEY = 'coffee_shifts_v1';

    const $ = id => document.getElementById(id);
    const pad = n => String(n).padStart(2, '0');
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const fmtDate = d => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    const fmtTime = ms => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
    const fmtMoney = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ';
    const toMin = hhmm => { const [h, m] = String(hhmm).split(':').map(Number); return (h || 0) * 60 + (m || 0); };
    const fmtClockMin = min => { const h = Math.floor(min / 60), m = min % 60; return m ? `${h}h${pad(m)}` : `${h}h`; };
    function fmtLong(min) {
        const h = Math.floor(min / 60), m = min % 60;
        if (h && m) return `${h} giờ ${m} phút`;
        if (h) return `${h} giờ`;
        return `${m} phút`;
    }

    // ---------- Dữ liệu ----------
    function load() {
        try { const t = JSON.parse(localStorage.getItem(TS_KEY)); return Array.isArray(t) ? t : []; } catch (e) { return []; }
    }
    function save(list) { try { localStorage.setItem(TS_KEY, JSON.stringify(list)); } catch (e) {} }

    function currentStaff() {
        const session = AuthAPI.getSession();
        if (!session) return null;
        let staff = [];
        try { staff = JSON.parse(localStorage.getItem(STAFF_KEY)) || []; } catch (e) {}
        if (!Array.isArray(staff) || !staff.length) {
            staff = [{ id: 1, fullName: 'Nguyễn Văn A' }, { id: 2, fullName: 'Phạm Văn D' }, { id: 3, fullName: 'Lê Văn C' }]; // giống staff.js
        }
        const me = session.staffId != null ? staff.find(s => String(s.id) === String(session.staffId)) : staff.find(s => s.fullName === session.name);
        return me ? { id: me.id, name: me.fullName } : { id: session.staffId != null ? session.staffId : session.name, name: session.name };
    }

    function todayRecord() {
        const me = currentStaff();
        if (!me) return null;
        const today = dateKey(new Date());
        return load().find(r => String(r.staffId) === String(me.id) && r.date === today) || null;
    }

    // Ghi GIỜ VÀO nếu hôm nay chưa có bản ghi (đã có — kể cả đã giao ca — thì giữ nguyên, mỗi ngày 1 lần)
    function recordClockIn() {
        const me = currentStaff();
        if (!me) return null;
        const list = load();
        const today = dateKey(new Date());
        let rec = list.find(r => String(r.staffId) === String(me.id) && r.date === today);
        if (!rec) {
            rec = { staffId: me.id, date: today, clockIn: Date.now(), clockOut: null };
            list.push(rec);
            save(list);
        }
        return rec;
    }

    // Ca đã xếp của 1 người trong 1 ngày (quản lý xếp ở Shifts.html)
    function shiftsOf(staffId, date) {
        try {
            const raw = JSON.parse(localStorage.getItem(SHIFTS_KEY));
            if (Array.isArray(raw)) return raw.filter(s => String(s.staffId) === String(staffId) && s.date === date).sort((a, b) => toMin(a.start) - toMin(b.start));
        } catch (e) {}
        return [];
    }
    const at = (date, hhmm) => new Date(`${date}T${hhmm}:00`).getTime();

    // CHỈ tính lương phần giờ có mặt NẰM TRONG ca đã xếp. Có mặt ngoài ca (vào sớm, ở lại muộn, không có ca) không tính.
    function calc(rec, nowMs) {
        const end = rec.clockOut || nowMs;
        const minutes = Math.max(0, Math.floor((end - rec.clockIn) / 60000));
        const mine = shiftsOf(rec.staffId, rec.date);
        let paid = 0;
        mine.forEach(s => {
            const a = Math.max(rec.clockIn, at(rec.date, s.start)), b = Math.min(end, at(rec.date, s.end));
            if (b > a) paid += Math.floor((b - a) / 60000);
        });
        const late = mine.length ? Math.max(0, Math.floor((rec.clockIn - at(rec.date, mine[0].start)) / 60000)) : 0;
        return { minutes, paid, late, outside: Math.max(0, minutes - paid), hasShift: mine.length > 0, pay: Math.round(paid * HOURLY_RATE / 60), end };
    }

    function registeredText(me, date) {
        try {
            const raw = JSON.parse(localStorage.getItem(SHIFTS_KEY));
            if (Array.isArray(raw)) {
                const mine = raw.filter(s => String(s.staffId) === String(me.id) && s.date === date)
                    .sort((a, b) => toMin(a.start) - toMin(b.start))
                    .map(s => `${fmtClockMin(toMin(s.start))} – ${fmtClockMin(toMin(s.end))}`);
                if (mine.length) return mine.join(', ');
            }
        } catch (e) {}
        return 'Không có ca đăng ký';
    }

    // ---------- Nút ở sidebar ----------
    function refreshButton() {
        const btn = $('navHandover');
        if (!btn) return;
        const rec = todayRecord();
        const done = !!(rec && rec.clockOut);
        btn.textContent = done ? 'Đã giao ca' : 'Giao ca';
    }

    // ---------- Popup ngày công ----------
    let timer = null;

    function closeModal() {
        const m = $('hoBackdrop');
        if (m) m.classList.remove('active');
        const nb = $('navHandover'); if (nb) nb.classList.remove('active');
        if (timer) { clearInterval(timer); timer = null; }
    }

    function renderModal() {
        const me = currentStaff();
        const rec = todayRecord();
        const body = $('hoBody');
        if (!me || !rec || !body) return;
        const now = Date.now();
        const c = calc(rec, now);
        const done = !!rec.clockOut;
        const today = new Date();

        body.innerHTML = `
            ${done ? `<div class="ho-done"><i class="ri-checkbox-circle-line"></i> Bạn đã giao ca lúc ${fmtTime(rec.clockOut)}. Hết ca hôm nay.</div>` : ''}
            ${c.hasShift ? '' : '<div class="wp-warn">Hôm nay bạn không có ca đã xếp nên chưa tính lương. Liên hệ Quản lý nếu có nhầm lẫn.</div>'}
            <dl class="ho-rows">
                <div><dt>Nhân viên</dt><dd>${esc(me.name)}</dd></div>
                <div><dt>Ngày</dt><dd>${fmtDate(today)}</dd></div>
                <div><dt>Ca đăng ký</dt><dd>${esc(registeredText(me, rec.date))}</dd></div>
                <div><dt>Giờ vào ca</dt><dd>${fmtTime(rec.clockIn)}</dd></div>
                <div><dt>Giờ ra ca</dt><dd>${done ? fmtTime(rec.clockOut) : fmtTime(now) + ' <small>(bây giờ)</small>'}</dd></div>
                <div><dt>Có mặt</dt><dd>${fmtLong(c.minutes)}</dd></div>
                ${c.late > 0 ? `<div><dt>Đi muộn</dt><dd>${fmtLong(c.late)}</dd></div>` : ''}
                <div><dt>Giờ tính lương (trong ca)</dt><dd>${fmtLong(c.paid)}</dd></div>
                ${c.outside > 0 ? `<div><dt>Ngoài ca (không tính lương)</dt><dd>${fmtLong(c.outside)}</dd></div>` : ''}
                <div><dt>Lương mỗi giờ</dt><dd>${fmtMoney(HOURLY_RATE)}</dd></div>
            </dl>
            <div class="ho-total"><span>Tiền công hôm nay</span><b>${fmtMoney(c.pay)}</b></div>`;
        $('hoConfirm').hidden = done;
        $('hoCloseBtn').hidden = !done;
    }

    function buildModal() {
        if ($('hoBackdrop')) return;
        const wrap = document.createElement('div');
        wrap.className = 'ho-backdrop';
        wrap.id = 'hoBackdrop';
        wrap.innerHTML = `
            <div class="ho-modal" role="dialog" aria-label="Giao ca">
                <div class="ho-head">
                    <h3>Giao ca — ngày công hôm nay</h3>
                    <button type="button" class="ho-x" id="hoX" aria-label="Đóng">&times;</button>
                </div>
                <div class="ho-body" id="hoBody"></div>
                <div class="ho-foot">
                    <button type="button" class="ho-btn primary" id="hoConfirm">Xác nhận</button>
                    <button type="button" class="ho-btn" id="hoCloseBtn" hidden>Đóng</button>
                </div>
            </div>`;
        document.body.appendChild(wrap);

        $('hoX').addEventListener('click', closeModal);
        $('hoCloseBtn').addEventListener('click', closeModal);
        wrap.addEventListener('click', e => { if (e.target === wrap) closeModal(); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

        // Xác nhận = giao ca: chốt giờ ra, hết ca, thoát popup về lại màn hình nhân viên
        $('hoConfirm').addEventListener('click', () => {
            const me = currentStaff();
            const list = load();
            const today = dateKey(new Date());
            const rec = list.find(r => String(r.staffId) === String(me.id) && r.date === today);
            let busy = 0;
            try { busy = (JSON.parse(localStorage.getItem('coffee_tables_v1')) || []).filter(t => t.status !== 'empty').length; } catch (err) {}
            if (busy && !window.confirm(`Còn ${busy} bàn đang có khách hoặc chưa thanh toán. Vẫn giao ca?`)) return;
            if (rec && !rec.clockOut) { rec.clockOut = Date.now(); save(list); }
            closeModal();
            refreshButton();
        });
    }

    function openHandover() {
        recordClockIn(); // phòng khi chưa có bản ghi hôm nay
        buildModal();
        renderModal();
        $('hoBackdrop').classList.add('active');
        const nb = $('navHandover'); if (nb) nb.classList.add('active');
        if (timer) clearInterval(timer);
        timer = setInterval(renderModal, 1000); // giờ ra "bây giờ", tổng giờ và tiền chạy theo thời gian thực
    }

    window.WaiterTimesheet = { recordClockIn, openHandover, refreshButton, todayRecord, HOURLY_RATE };
})();