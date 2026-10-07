// shifts.js — XẾP LỊCH CA (Shifts.html, vai trò Quản lý). Ghi 'coffee_shifts_v1' cho trang Lịch ca làm của nhân viên đọc.
// Ca: { id, staffId, date: 'YYYY-MM-DD', start: 'HH:MM', end: 'HH:MM' }. Kiểm tra: giờ trong 6h30–22h, kết thúc sau bắt đầu, không trùng ca khác của cùng người.
(function () {
    'use strict';
    const SHIFTS_KEY = 'coffee_shifts_v1', STAFF_KEY = 'coffee_staff_v1';
    const OPEN = 6 * 60 + 30, CLOSE = 22 * 60;
    const DAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];
    const $ = id => document.getElementById(id);
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const pad = n => String(n).padStart(2, '0');
    const toMin = h => { const [a, b] = String(h).split(':').map(Number); return (a || 0) * 60 + (b || 0); };
    const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const fmtDate = d => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
    const mondayOf = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
    const clock = m => { const h = Math.floor(m / 60), r = m % 60; return r ? `${h}h${pad(r)}` : `${h}h`; };
    const hours = m => (m / 60).toFixed(m % 60 ? 1 : 0) + 'h';

    function loadStaff() {
        let s = [];
        try { s = JSON.parse(localStorage.getItem(STAFF_KEY)); } catch (e) {}
        if (!Array.isArray(s) || !s.length) s = [{ id: 1, fullName: 'Nguyễn Văn A', role: 'Quản lý' }, { id: 2, fullName: 'Phạm Văn D', role: 'Bếp' }, { id: 3, fullName: 'Lê Văn C', role: 'Phục vụ' }, { id: 4, fullName: 'Trần Thị B', role: 'Thu ngân' }];
        return s.filter(x => x.role !== 'Quản lý'); // chỉ xếp ca cho nhân viên làm tại quán
    }
    const loadShifts = () => { try { const s = JSON.parse(localStorage.getItem(SHIFTS_KEY)); return Array.isArray(s) ? s : []; } catch (e) { return []; } };
    function saveShifts(list) {
        try { localStorage.setItem(SHIFTS_KEY, JSON.stringify(list)); return true; }
        catch (e) { alert('Không lưu được lịch. Kiểm tra lại trình duyệt rồi thử lại.'); return false; }
    }
    const nextId = list => list.reduce((m, s) => Math.max(m, Number(s.id) || 0), 0) + 1;
    const overlap = (a, b) => toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end);

    let weekStart = mondayOf(new Date()), staff = [], shifts = [], ed = null;

    function render() {
        staff = loadStaff(); shifts = loadShifts();
        const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
        const today = dateKey(new Date());
        $('shMonth').textContent = `Tháng ${addDays(weekStart, 3).getMonth() + 1}/${addDays(weekStart, 3).getFullYear()}`;
        $('shRange').textContent = `${fmtDate(weekStart)} – ${fmtDate(addDays(weekStart, 6))}`;

        const head = `<thead><tr><th class="sch-staffcol">Nhân viên</th>${days.map((d, i) => `<th class="${dateKey(d) === today ? 'today' : ''}">${DAYS[i]}<small>${fmtDate(d)}</small></th>`).join('')}<th class="shf-total">Tổng giờ</th></tr></thead>`;
        const rows = staff.map(s => {
            let total = 0;
            const cells = days.map(d => {
                const key = dateKey(d);
                const mine = shifts.filter(x => String(x.staffId) === String(s.id) && x.date === key).sort((a, b) => toMin(a.start) - toMin(b.start));
                mine.forEach(x => total += toMin(x.end) - toMin(x.start));
                return `<td class="${key === today ? 'today' : ''}">${mine.map(x => `<button type="button" class="sch-shift shf-shift" data-edit="${x.id}"><span class="sch-time">${clock(toMin(x.start))} – ${clock(toMin(x.end))} <small>(${hours(toMin(x.end) - toMin(x.start))})</small></span></button>`).join('')}<button type="button" class="shf-add" data-staff="${s.id}" data-date="${key}">+ Thêm ca</button></td>`;
            }).join('');
            return `<tr><th class="sch-staffcol"><b>${esc(s.fullName)}</b><small>${esc(s.role || '')}</small></th>${cells}<td class="shf-total">${total ? hours(total) : '—'}</td></tr>`;
        }).join('');
        const foot = `<tfoot><tr><td>Số người / ngày</td>${days.map(d => {
            const key = dateKey(d), ids = new Set(shifts.filter(x => x.date === key).map(x => String(x.staffId)));
            return ids.size ? `<td>${ids.size} người</td>` : '<td class="warn">Chưa có ai</td>';
        }).join('')}<td></td></tr></tfoot>`;
        $('shTable').innerHTML = head + `<tbody>${rows || '<tr><td colspan="9" class="sch-none">Chưa có nhân viên. Thêm ở trang Nhân viên.</td></tr>'}</tbody>` + (staff.length ? foot : '');
    }

    function err(m) { $('shError').textContent = m; $('shError').hidden = !m; }
    function openModal(o) {
        const s = staff.find(x => String(x.id) === String(o.staffId));
        if (!s) return;
        ed = o;
        const d = new Date(o.date + 'T00:00:00');
        $('shTitle').textContent = o.id ? 'Sửa ca' : 'Thêm ca';
        $('shSub').textContent = `${s.fullName} · ${DAYS[(d.getDay() + 6) % 7]} ${fmtDate(d)}`;
        $('shStart').value = o.start || '06:30'; $('shEnd').value = o.end || '14:00';
        $('shDelete').hidden = !o.id; err('');
        $('shModal').classList.add('active'); $('shStart').focus();
    }
    const closeModal = () => { $('shModal').classList.remove('active'); ed = null; };

    function submit(e) {
        e.preventDefault();
        const start = $('shStart').value, end = $('shEnd').value;
        if (!start || !end) return err('Vui lòng nhập giờ bắt đầu và kết thúc.');
        if (toMin(end) <= toMin(start)) return err('Giờ kết thúc phải sau giờ bắt đầu.');
        if (toMin(start) < OPEN || toMin(end) > CLOSE) return err('Ca phải nằm trong giờ mở cửa 6h30 – 22h.');
        const list = loadShifts(), cand = { start, end };
        const clash = list.find(x => x.id !== ed.id && String(x.staffId) === String(ed.staffId) && x.date === ed.date && overlap(x, cand));
        if (clash) return err(`Trùng với ca ${clock(toMin(clash.start))} – ${clock(toMin(clash.end))} của người này.`);
        if (ed.id) { const x = list.find(y => y.id === ed.id); if (x) { x.start = start; x.end = end; } }
        else list.push({ id: nextId(list), staffId: ed.staffId, date: ed.date, start, end });
        if (saveShifts(list)) { closeModal(); render(); }
    }

    function copyPrev() {
        const list = loadShifts(), weekKeys = Array.from({ length: 7 }, (_, i) => dateKey(addDays(weekStart, i)));
        const prev = list.filter(x => weekKeys.includes(dateKey(addDays(new Date(x.date + 'T00:00:00'), 7))));
        if (!prev.length) return alert('Tuần trước chưa có ca nào để sao chép.');
        let added = 0, id = nextId(list);
        prev.forEach(x => {
            const date = dateKey(addDays(new Date(x.date + 'T00:00:00'), 7)), c = { staffId: x.staffId, date, start: x.start, end: x.end };
            if (list.some(y => String(y.staffId) === String(c.staffId) && y.date === date && overlap(y, c))) return;
            list.push({ id: id++, ...c }); added++;
        });
        if (saveShifts(list)) { render(); alert(added ? `Đã sao chép ${added} ca.` : 'Các ca tuần này đã có sẵn, không sao chép thêm.'); }
    }
    function clearWeek() {
        const keys = Array.from({ length: 7 }, (_, i) => dateKey(addDays(weekStart, i)));
        const list = loadShifts(), left = list.filter(x => !keys.includes(x.date));
        if (left.length === list.length) return alert('Tuần này chưa có ca nào.');
        if (confirm(`Xóa ${list.length - left.length} ca của tuần này?`) && saveShifts(left)) render();
    }

    document.addEventListener('DOMContentLoaded', () => {
        render();
        $('shPrev').addEventListener('click', () => { weekStart = addDays(weekStart, -7); render(); });
        $('shNext').addEventListener('click', () => { weekStart = addDays(weekStart, 7); render(); });
        $('shThis').addEventListener('click', () => { weekStart = mondayOf(new Date()); render(); });
        $('shCopy').addEventListener('click', copyPrev);
        $('shClear').addEventListener('click', clearWeek);
        $('shTable').addEventListener('click', e => {
            const a = e.target.closest('[data-staff]'), s = e.target.closest('[data-edit]');
            if (a) openModal({ id: null, staffId: a.dataset.staff, date: a.dataset.date });
            else if (s) { const x = loadShifts().find(y => String(y.id) === s.dataset.edit); if (x) openModal({ ...x }); }
        });
        $('shForm').addEventListener('submit', submit);
        $('shCancel').addEventListener('click', closeModal);
        $('shDelete').addEventListener('click', () => { if (ed && ed.id && saveShifts(loadShifts().filter(x => x.id !== ed.id))) { closeModal(); render(); } });
        $('shModal').addEventListener('click', e => { if (e.target === $('shModal')) closeModal(); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
        window.addEventListener('storage', e => { if (e.key === SHIFTS_KEY || e.key === STAFF_KEY) render(); });
    });
})();