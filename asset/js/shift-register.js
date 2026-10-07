// ============================================================
// shift-register.js — ĐĂNG KÝ CA LÀM (Thu ngân) — chạy trên Schedule.html
// ------------------------------------------------------------
// Thu ngân tick các KHUNG GIỜ TRỐNG mình rảnh trong 14 ngày tới; bấm "Gửi đăng ký" thì hệ thống TỰ XẾP
// vào lịch chung 'coffee_shifts_v1' (cùng nơi Quản lý xếp ở trang Lịch ca), theo quy tắc:
//   - Mỗi người tối đa 1 ca / ngày.
//   - Mỗi khung giờ chỉ nhận tối đa MAX_CASHIER_PER_SLOT thu ngân (đã đủ thì báo "đã đủ người").
//   - Không đăng ký được ca đã bắt đầu / đã qua. Ca do Quản lý xếp thì khóa, không tự sửa.
//   - Bỏ tick ca mình đã đăng ký (chưa bắt đầu) = hủy đăng ký.
// Ca đăng ký có cờ registered:true. Nếu chưa có lịch thật (đang xem lịch mẫu) thì lịch mẫu được lưu lại làm nền.
// ============================================================
(function () {
    'use strict';
    const C = window.Cashier;
    const session = AuthAPI.getSession();
    if (!session || session.roleKey !== 'cashier') return;

    const SHIFTS_KEY = 'coffee_shifts_v1', STAFF_KEY = 'coffee_staff_v1';
    const SLOTS = [
        { key: 'sang', label: 'Ca sáng', start: '06:30', end: '14:00' },
        { key: 'chieu', label: 'Ca chiều', start: '11:00', end: '19:00' },
        { key: 'toi', label: 'Ca tối', start: '17:00', end: '22:00' }
    ];
    const MAX_CASHIER_PER_SLOT = 1;
    const DAYS_AHEAD = 14;
    const DOW = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

    const pad = n => String(n).padStart(2, '0');
    const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const toMin = h => { const [a, b] = String(h).split(':').map(Number); return a * 60 + (b || 0); };
    const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
    const mondayOf = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };

    function loadStaff() {
        try { const s = JSON.parse(localStorage.getItem(STAFF_KEY)); if (Array.isArray(s) && s.length) return s; } catch (e) {}
        return [{ id: 1, fullName: 'Nguyễn Văn A', role: 'Quản lý' }, { id: 2, fullName: 'Phạm Văn D', role: 'Bếp' }, { id: 3, fullName: 'Lê Văn C', role: 'Phục vụ' }, { id: 4, fullName: 'Trần Thị B', role: 'Thu ngân' }];
    }
    // Lịch mẫu — giống demoShifts trong schedule.js, dùng làm nền khi chưa có lịch thật
    function demoShifts(staff) {
        const patterns = [{ days: [0, 1, 2, 4, 5], start: '06:30', end: '14:00' }, { days: [1, 2, 3, 5, 6], start: '11:00', end: '19:00' }, { days: [0, 2, 3, 4, 6], start: '17:00', end: '22:00' }];
        const base = mondayOf(new Date()), out = []; let id = 1;
        for (let w = -1; w <= 1; w++) for (let d = 0; d < 7; d++) {
            const key = dateKey(addDays(base, w * 7 + d));
            staff.forEach((s, idx) => { const p = patterns[idx % 3]; if (p.days.includes(d)) out.push({ id: id++, staffId: s.id, date: key, start: p.start, end: p.end }); });
        }
        return out;
    }
    function loadShifts() {
        try { const raw = localStorage.getItem(SHIFTS_KEY); if (raw !== null) { const s = JSON.parse(raw); if (Array.isArray(s)) return s; } } catch (e) {}
        return demoShifts(loadStaff());
    }
    const saveShifts = l => { try { localStorage.setItem(SHIFTS_KEY, JSON.stringify(l)); return true; } catch (e) { alert('Không lưu được lịch.'); return false; } };
    const nextId = l => l.reduce((m, s) => Math.max(m, Number(s.id) || 0), 0) + 1;

    const myId = () => {
        const staff = loadStaff();
        if (session.staffId != null && staff.some(s => String(s.id) === String(session.staffId))) return session.staffId;
        const s = staff.find(x => x.fullName === session.name); return s ? s.id : null;
    };
    const slotOf = sh => SLOTS.find(s => s.start === sh.start && s.end === sh.end);
    const started = (key, slot) => new Date(`${key}T${slot.start}:00`).getTime() <= Date.now();

    function build() {
        const app = document.getElementById('schedule-app'); if (!app || document.getElementById('regPanel')) return;
        const sec = document.createElement('section');
        sec.className = 'cs-panel reg-panel'; sec.id = 'regPanel';
        const anchor = document.getElementById('schMe');
        anchor ? anchor.insertAdjacentElement('afterend', sec) : app.appendChild(sec);
        sec.addEventListener('click', e => {
            if (e.target.id === 'regSubmit') submit();
            else if (e.target.id === 'regToggle') { sec.classList.toggle('collapsed'); renderRegBody(); }
        });
        render();
    }

    let collapsed = false;
    function renderRegBody() { collapsed = document.getElementById('regPanel').classList.contains('collapsed'); render(); }

    function render() {
        const sec = document.getElementById('regPanel'); if (!sec) return;
        const id = myId(), shifts = loadShifts(), today = new Date();
        const head = `<h3 style="display:flex;justify-content:space-between;align-items:center;gap:8px">Đăng ký ca <button type="button" class="cs-btn line" id="regToggle" style="padding:6px 12px;font-size:12px">${collapsed ? 'Mở' : 'Thu gọn'}</button></h3>`;
        if (collapsed) { sec.innerHTML = head; return; }
        if (id == null) { sec.innerHTML = head + '<p class="cs-note">Không tìm thấy tài khoản của bạn trong danh sách nhân viên nên chưa đăng ký ca được.</p>'; return; }
        let html = head + `<p class="cs-note" style="margin:0 0 12px">Tick những khung giờ bạn rảnh rồi bấm <b>Gửi đăng ký</b> — hệ thống tự xếp vào lịch chung (tối đa 1 ca/ngày, mỗi khung giờ ${MAX_CASHIER_PER_SLOT} thu ngân). Bỏ tick ca đã đăng ký để hủy.</p><div class="reg-days">`;
        for (let i = 0; i < DAYS_AHEAD; i++) {
            const d = addDays(today, i), key = dateKey(d);
            const mine = shifts.find(s => String(s.staffId) === String(id) && s.date === key);
            const mineSlot = mine && slotOf(mine);
            html += `<div class="reg-day ${i === 0 ? 'today' : ''}"><div class="reg-day-h">${DOW[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}${i === 0 ? ' (hôm nay)' : ''}</div>`;
            SLOTS.forEach(sl => {
                const isMine = mineSlot && mineSlot.key === sl.key;
                const lockedByManager = isMine && !mine.registered;
                const otherMine = mine && !isMine;               // đã có ca khác trong ngày
                const taken = shifts.filter(s => s.date === key && s.start === sl.start && s.end === sl.end && String(s.staffId) !== String(id) && staffRole(s.staffId) === 'Thu ngân').length >= MAX_CASHIER_PER_SLOT;
                const past = started(key, sl);
                const disabled = past || lockedByManager || (!isMine && (otherMine || taken));
                const note = lockedByManager ? 'Quản lý xếp' : past ? 'đã qua' : otherMine ? 'đã có ca khác' : (!isMine && taken) ? 'đã đủ người' : '';
                html += `<label class="reg-slot ${disabled ? 'locked' : ''}"><input type="checkbox" data-date="${key}" data-slot="${sl.key}" ${isMine ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
                    <span>${sl.label} <small>${sl.start}–${sl.end}${note ? ' • ' + note : ''}</small></span></label>`;
            });
            html += '</div>';
        }
        html += '</div><div style="margin-top:12px"><button type="button" class="cs-btn" id="regSubmit">Gửi đăng ký</button> <span class="cs-msg ok" id="regMsg" hidden></span></div>';
        sec.innerHTML = html;
    }
    const staffRole = sid => { const s = loadStaff().find(x => String(x.id) === String(sid)); return s ? s.role : ''; };

    function submit() {
        const id = myId(); if (id == null) return;
        let shifts = loadShifts(), added = 0, removed = 0; const skipped = [];
        document.querySelectorAll('#regPanel input[type=checkbox]:not(:disabled)').forEach(cb => {
            const key = cb.dataset.date, sl = SLOTS.find(s => s.key === cb.dataset.slot);
            const mine = shifts.find(s => String(s.staffId) === String(id) && s.date === key);
            const isMineSlot = mine && mine.start === sl.start && mine.end === sl.end;
            if (cb.checked && !isMineSlot) {
                if (started(key, sl)) return;
                if (mine) { skipped.push(`${key}: đã có ca khác`); return; }
                const full = shifts.filter(s => s.date === key && s.start === sl.start && s.end === sl.end && staffRole(s.staffId) === 'Thu ngân').length >= MAX_CASHIER_PER_SLOT;
                if (full) { skipped.push(`${key} ${sl.label}: đã đủ người`); return; }
                shifts.push({ id: nextId(shifts), staffId: id, date: key, start: sl.start, end: sl.end, registered: true }); added++;
            } else if (!cb.checked && isMineSlot && mine.registered && !started(key, sl)) {
                shifts = shifts.filter(s => s !== mine); removed++;
            }
        });
        if (added || removed) { if (!saveShifts(shifts)) return; }
        // hiển thị kết quả rồi tải lại lịch
        sessionStorage.setItem('regResult', `Đã xếp ${added} ca, hủy ${removed} ca${skipped.length ? ` • bỏ qua ${skipped.length} (${skipped.slice(0, 3).join('; ')}${skipped.length > 3 ? '…' : ''})` : ''}.`);
        window.location.reload();
    }

    function init() {
        build();
        const r = sessionStorage.getItem('regResult');
        if (r) { sessionStorage.removeItem('regResult'); const m = document.getElementById('regMsg'); if (m) { m.textContent = r; m.hidden = false; } }
    }
    // Chạy ngay nếu trang đã tải xong (file này được nạp bằng document.write trong Schedule.html)
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
