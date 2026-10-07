// ============================================================
// schedule.js — LỊCH CA LÀM (Schedule.html) — Phục vụ & Bếp CHỈ XEM
// ------------------------------------------------------------
// - Khối "Ca của tôi": ca kế tiếp, giờ làm tuần này, lương dự kiến.
// - Đầu trang: hôm nay ai ĐANG TRONG CA, ai CHƯA VÀO CA (đã tới giờ mà chưa chấm công).
// - Bảng tuần (máy tính) / danh sách theo ngày (điện thoại). Hàng của mình luôn nằm đầu, có nhãn "Bạn".
// - Giờ làm THẬT lấy từ chấm công 'coffee_timesheet_v1' (timesheet.js ghi) cho vai trò Phục vụ:
//   vào muộn, chưa vào ca, nghỉ sớm, không chấm công. Vai trò chưa có chấm công (Bếp) và lịch mẫu
//   thì tính theo lịch đã xếp (và trường "leftAt" nếu quản lý ghi).
//
// DỮ LIỆU (quản lý ghi, trang này chỉ ĐỌC) — 'coffee_shifts_v1':
//   { id, staffId, date: '2026-10-05', start: '17:00', end: '22:00', leftAt: '19:30' (không bắt buộc) }
// Nếu key này CHƯA tồn tại, trang dùng lịch MẪU (không ghi vào localStorage).
// ============================================================
(function () {
    'use strict';

    const SHIFTS_KEY = 'coffee_shifts_v1';
    const STAFF_KEY = 'coffee_staff_v1';
    const TIMESHEET_KEY = 'coffee_timesheet_v1';
    const DAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];
    const FALLBACK_RATE = 21000; // trùng HOURLY_RATE trong timesheet.js

    const $ = id => document.getElementById(id);
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const pad = n => String(n).padStart(2, '0');

    // ---------- Chặn người chưa đăng nhập / không phải Phục vụ hoặc Bếp ----------
    const session = AuthAPI.getSession();
    if (!session) { window.location.replace('Login.html'); return; }
    if (session.roleKey !== 'waiter' && session.roleKey !== 'kitchen' && session.roleKey !== 'cashier') {
        const pages = PAGES_BY_ROLE[session.roleKey];
        window.location.replace(pages ? pages[0].path : 'Login.html');
        return;
    }

    // ---------- Tiện ích ngày giờ ----------
    const toMin = hhmm => { const [h, m] = String(hhmm).split(':').map(Number); return (h || 0) * 60 + (m || 0); };
    const minOfMs = ms => { const d = new Date(ms); return d.getHours() * 60 + d.getMinutes(); };
    const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const fmtDate = d => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    const parseKey = k => new Date(k + 'T00:00:00');
    function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
    function mondayOf(d) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
    const dayIdx = d => (d.getDay() + 6) % 7;
    const fmtClock = min => { const h = Math.floor(min / 60), m = min % 60; return m ? `${h}h${pad(m)}` : `${h}h`; };
    function fmtDur(min) {
        min = Math.max(0, Math.round(min));
        const h = Math.floor(min / 60), m = min % 60;
        if (h && m) return `${h}h${pad(m)}`;
        if (h) return `${h}h`;
        return `${m} phút`;
    }
    const fmtMoney = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ';
    const rate = () => (window.WaiterTimesheet && window.WaiterTimesheet.HOURLY_RATE) || FALLBACK_RATE;

    // ---------- Dữ liệu ----------
    function loadStaff() {
        try { const s = JSON.parse(localStorage.getItem(STAFF_KEY)); if (Array.isArray(s) && s.length) return s; } catch (e) {}
        return [
            { id: 1, fullName: 'Nguyễn Văn A', role: 'Quản lý' },
            { id: 2, fullName: 'Phạm Văn D', role: 'Bếp' },
            { id: 3, fullName: 'Lê Văn C', role: 'Phục vụ' },
            { id: 4, fullName: 'Trần Thị B', role: 'Thu ngân' }
        ];
    }

    function demoShifts(staff) {
        const patterns = [
            { days: [0, 1, 2, 4, 5], start: '06:30', end: '14:00' },
            { days: [1, 2, 3, 5, 6], start: '11:00', end: '19:00' },
            { days: [0, 2, 3, 4, 6], start: '17:00', end: '22:00' }
        ];
        const base = mondayOf(new Date());
        const todayKey = dateKey(new Date());
        const out = [];
        let id = 1;
        for (let w = -1; w <= 1; w++) {
            for (let d = 0; d < 7; d++) {
                const key = dateKey(addDays(base, w * 7 + d));
                staff.forEach((s, idx) => {
                    const p = patterns[idx % 3];
                    if (!p.days.includes(d)) return;
                    const shift = { id: id++, staffId: s.id, date: key, start: p.start, end: p.end };
                    if (idx === 0 && key === todayKey) shift.leftAt = '11:15';
                    out.push(shift);
                });
            }
        }
        return out;
    }

    function loadShifts(staff) {
        try {
            const raw = localStorage.getItem(SHIFTS_KEY);
            if (raw !== null) { const s = JSON.parse(raw); if (Array.isArray(s)) return { shifts: s, demo: false }; }
        } catch (e) {}
        return { shifts: demoShifts(staff), demo: true };
    }

    function loadTimesheet() {
        try { const t = JSON.parse(localStorage.getItem(TIMESHEET_KEY)); return Array.isArray(t) ? t : []; } catch (e) { return []; }
    }

    let weekStart = mondayOf(new Date());
    let staff = [], shifts = [], timesheet = [], isDemo = false;

    function refreshData() {
        staff = loadStaff().filter(x => x.role !== 'Quản lý'); // chỉ hiện người làm tại quán, giống trang xếp ca
        timesheet = loadTimesheet();
        const r = loadShifts(staff);
        shifts = r.shifts;
        isDemo = r.demo;
    }

    // Mình là ai trong danh sách nhân viên (theo id, không có thì theo họ tên)
    function meId() {
        if (session.staffId != null && staff.some(s => String(s.id) === String(session.staffId))) return String(session.staffId);
        const s = staff.find(x => x.fullName === session.name);
        return s ? String(s.id) : null;
    }

    // ---------- Tính trạng thái 1 ca ----------
    // state: future | upcoming (chưa tới giờ) | working | done | left (nghỉ sớm)
    //        | noshow (đã tới giờ mà chưa chấm công, hôm nay) | absent (ngày đã qua, không có chấm công)
    // tracked = người này có chấm công thật (Phục vụ, không phải lịch mẫu); rec = bản ghi chấm công của ngày đó.
    function evalShift(sh, todayKey, nowMin, rec, tracked) {
        const st = toMin(sh.start), en = toMin(sh.end);
        let end = en;
        if (sh.leftAt) end = Math.min(end, Math.max(toMin(sh.leftAt), st));
        let inMin = null;
        if (rec) {
            inMin = minOfMs(rec.clockIn);
            if (rec.clockOut) end = Math.min(end, Math.max(minOfMs(rec.clockOut), st));
        }
        const early = end < en;
        const from = inMin !== null ? Math.max(st, inMin) : st;
        let late = inMin !== null ? Math.max(0, inMin - st) : 0;
        const isToday = sh.date === todayKey;
        let state, worked = 0;

        if (sh.date > todayKey) state = 'future';
        else if (isToday && nowMin < st) state = 'upcoming';
        else if (tracked && !rec) {
            if (isToday && nowMin < en) { state = 'noshow'; late = Math.floor(nowMin - st); }
            else state = 'absent';
        } else {
            const cur = isToday ? Math.min(nowMin, end) : end;
            worked = Math.max(0, cur - from);
            state = (isToday && nowMin < end) ? 'working' : (early ? 'left' : 'done');
        }
        return { st, en, end, early, late, state, worked: Math.floor(worked), total: en - st };
    }

    function evalFor(sh, todayKey, nowMin) {
        const s = staff.find(x => String(x.id) === String(sh.staffId));
        const tracked = !isDemo && !!s && s.role === 'Phục vụ';
        const rec = timesheet.find(r => String(r.staffId) === String(sh.staffId) && r.date === sh.date);
        return evalShift(sh, todayKey, nowMin, rec, tracked);
    }

    // Dòng chữ mô tả trạng thái ca (dùng cho cả bảng và danh sách điện thoại)
    function metaOf(e) {
        const lateTxt = e.late >= 1 ? ` · vào muộn ${fmtDur(e.late)}` : '';
        switch (e.state) {
            case 'working': return { text: `Đang làm · ${fmtDur(e.worked)} / ${fmtDur(e.total)}${lateTxt}`, warn: e.late >= 1 };
            case 'done': return { text: (e.worked >= e.total ? `Đã làm đủ ${fmtDur(e.worked)}` : `Đã làm ${fmtDur(e.worked)} / ${fmtDur(e.total)}`) + lateTxt, warn: e.late >= 1 };
            case 'left': return { text: `Nghỉ sớm lúc ${fmtClock(e.end)} · làm ${fmtDur(e.worked)} / ${fmtDur(e.total)}`, warn: true };
            case 'upcoming': return { text: 'Chưa tới ca', warn: false };
            case 'noshow': return { text: `Chưa vào ca · trễ ${fmtDur(e.late)}`, warn: true };
            case 'absent': return { text: 'Không có chấm công', warn: true };
            default: return { text: '', warn: false };
        }
    }

    // ---------- Vẽ giao diện ----------
    function renderMe(todayKey, nowMin) {
        const box = $('schMe');
        const id = meId();
        if (!id) { box.hidden = true; return; }
        box.hidden = false;
        const mine = shifts.filter(sh => String(sh.staffId) === id);

        // Ca kế tiếp: ca đang làm / chưa vào / sắp tới, sớm nhất
        const upcoming = mine
            .map(sh => ({ sh, e: evalFor(sh, todayKey, nowMin) }))
            .filter(x => ['working', 'noshow', 'upcoming', 'future'].includes(x.e.state))
            .sort((a, b) => a.sh.date === b.sh.date ? a.e.st - b.e.st : (a.sh.date < b.sh.date ? -1 : 1));
        const nx = upcoming[0];
        if (nx) {
            const tomorrow = dateKey(addDays(new Date(), 1));
            const d = parseKey(nx.sh.date);
            const when = nx.sh.date === todayKey ? 'Hôm nay' : nx.sh.date === tomorrow ? 'Ngày mai' : `${DAY_LABELS[dayIdx(d)]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
            $('schMeNext').textContent = `${when} · ${fmtClock(nx.e.st)} – ${fmtClock(nx.e.en)}`;
            $('schMeNextSub').textContent = nx.e.state === 'working' ? 'Bạn đang trong ca' : nx.e.state === 'noshow' ? 'Đã tới giờ, bạn chưa vào ca' : `Dài ${fmtDur(nx.e.total)}`;
        } else {
            $('schMeNext').textContent = 'Chưa có ca sắp tới';
            $('schMeNextSub').textContent = 'Quản lý chưa xếp thêm ca cho bạn';
        }

        // Tổng giờ của tuần đang xem
        const keys = Array.from({ length: 7 }, (_, i) => dateKey(addDays(weekStart, i)));
        let totalMin = 0, doneMin = 0;
        mine.filter(sh => keys.includes(sh.date)).forEach(sh => {
            const e = evalFor(sh, todayKey, nowMin);
            totalMin += e.total; doneMin += e.worked;
        });
        $('schMeHours').textContent = totalMin ? fmtDur(totalMin) : '0 giờ';
        $('schMeHoursSub').textContent = totalMin ? `Đã làm ${fmtDur(doneMin)}` : 'Tuần này bạn không có ca';
        $('schMePay').textContent = fmtMoney(totalMin * rate() / 60);
    }

    function renderNow(todayKey, nowMin) {
        const byId = new Map(staff.map(s => [String(s.id), s]));
        const today = shifts
            .filter(sh => sh.date === todayKey && byId.has(String(sh.staffId)))
            .map(sh => ({ s: byId.get(String(sh.staffId)), e: evalFor(sh, todayKey, nowMin) }));
        const sortBy = (a, b) => a.e.st - b.e.st;
        const working = today.filter(x => x.e.state === 'working').sort(sortBy);
        const waiting = today.filter(x => x.e.state === 'upcoming' || x.e.state === 'noshow').sort(sortBy);

        $('schInShift').innerHTML = working.length ? working.map(x => `
            <div class="sch-person">
                <b>${esc(x.s.fullName)}</b>
                <span>${fmtClock(x.e.st)} – ${fmtClock(x.e.en)} · đã làm ${fmtDur(x.e.worked)}${x.e.late >= 1 ? ` · vào muộn ${fmtDur(x.e.late)}` : ''}</span>
            </div>`).join('') : '<div class="sch-none">Hiện chưa có ai trong ca.</div>';

        $('schUpcoming').innerHTML = waiting.length ? waiting.map(x => `
            <div class="sch-person">
                <b>${esc(x.s.fullName)}</b>
                ${x.e.state === 'noshow'
                    ? `<span class="warn">${fmtClock(x.e.st)} – ${fmtClock(x.e.en)} · đã trễ ${fmtDur(x.e.late)}, chưa vào ca</span>`
                    : `<span>${fmtClock(x.e.st)} – ${fmtClock(x.e.en)} · còn ${fmtDur(x.e.st - nowMin)} nữa tới ca</span>`}
            </div>`).join('') : '<div class="sch-none">Không có ai đang chờ vào ca hôm nay.</div>';
    }

    function shiftHtml(e) {
        const m = metaOf(e);
        const meta = m.text ? `<div class="sch-meta${m.warn ? ' warn' : ''}">${esc(m.text)}</div>` : '';
        const bar = e.state === 'working' ? `<div class="sch-bar"><i style="width:${Math.min(100, e.worked / e.total * 100).toFixed(1)}%"></i></div>` : '';
        return `<div class="sch-shift st-${e.state}">
            <div class="sch-time">${fmtClock(e.st)} – ${fmtClock(e.en)} <small>(${fmtDur(e.total)})</small></div>
            ${meta}${bar}
        </div>`;
    }

    function orderedStaff() {
        const id = meId();
        return staff.slice().sort((a, b) => (String(b.id) === id) - (String(a.id) === id)); // mình lên đầu, còn lại giữ thứ tự
    }

    function renderTable(todayKey, nowMin) {
        const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
        const id = meId();

        const head = `<thead><tr><th class="sch-staffcol">Nhân viên</th>${days.map((d, i) => `
            <th class="${dateKey(d) === todayKey ? 'today' : ''}">${DAY_LABELS[i]}<small>${fmtDate(d)}</small></th>`).join('')}<th class="sch-total">Tổng giờ</th></tr></thead>`;

        const rows = orderedStaff().map(s => {
            const isMe = String(s.id) === id;
            let total = 0;
            const cells = days.map(d => {
                const key = dateKey(d);
                const mine = shifts
                    .filter(sh => String(sh.staffId) === String(s.id) && sh.date === key)
                    .sort((a, b) => toMin(a.start) - toMin(b.start));
                mine.forEach(sh => { total += toMin(sh.end) - toMin(sh.start); });
                return `<td class="${key === todayKey ? 'today' : ''}">${mine.map(sh => shiftHtml(evalFor(sh, todayKey, nowMin))).join('')}</td>`;
            }).join('');
            return `<tr class="${isMe ? 'me' : ''}"><th class="sch-staffcol"><b>${esc(s.fullName)}</b>${isMe ? ' <span class="sch-me-tag">Bạn</span>' : ''}<small>${esc(s.role || '')}</small></th>${cells}<td class="sch-total">${total ? fmtDur(total) : '—'}</td></tr>`;
        }).join('');

        $('schTable').innerHTML = head + `<tbody>${rows || '<tr><td colspan="9" class="sch-none">Chưa có nhân viên.</td></tr>'}</tbody>`;
    }

    // Danh sách theo ngày (hiện trên điện thoại thay cho bảng rộng)
    function renderList(todayKey, nowMin) {
        const id = meId();
        const byId = new Map(staff.map(s => [String(s.id), s]));
        $('schList').innerHTML = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((d, i) => {
            const key = dateKey(d);
            const items = shifts
                .filter(sh => sh.date === key && byId.has(String(sh.staffId)))
                .sort((a, b) => (String(b.staffId) === id) - (String(a.staffId) === id) || toMin(a.start) - toMin(b.start))
                .map(sh => {
                    const e = evalFor(sh, todayKey, nowMin), m = metaOf(e), isMe = String(sh.staffId) === id;
                    return `<div class="sch-li st-${e.state}${isMe ? ' me' : ''}">
                        <div><b>${esc(byId.get(String(sh.staffId)).fullName)}</b>${isMe ? ' <span class="sch-me-tag">Bạn</span>' : ''}</div>
                        <div class="sch-li-time">${fmtClock(e.st)} – ${fmtClock(e.en)} <small>(${fmtDur(e.total)})</small></div>
                        ${m.text ? `<div class="sch-meta${m.warn ? ' warn' : ''}">${esc(m.text)}</div>` : ''}
                    </div>`;
                }).join('');
            return `<section class="sch-day${key === todayKey ? ' today' : ''}">
                <h4>${DAY_LABELS[i]} <small>${fmtDate(d)}</small></h4>
                ${items || '<div class="sch-none">Không có ca.</div>'}
            </section>`;
        }).join('');
    }

    function renderLabels() {
        const mid = addDays(weekStart, 3);
        $('schMonthLabel').textContent = `Tháng ${mid.getMonth() + 1}/${mid.getFullYear()}`;
        $('schRangeLabel').textContent = `${fmtDate(weekStart)} – ${fmtDate(addDays(weekStart, 6))}`;
        $('schDemo').hidden = !isDemo;
        const pick = $('schPick');
        if (pick && document.activeElement !== pick) pick.value = dateKey(weekStart);
    }

    function render() {
        const now = new Date();
        const todayKey = dateKey(now);
        const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
        renderLabels();
        renderMe(todayKey, nowMin);
        renderNow(todayKey, nowMin);
        renderTable(todayKey, nowMin);
        renderList(todayKey, nowMin);
    }

    function init() {
        refreshData();
        $('schPrev').addEventListener('click', () => { weekStart = addDays(weekStart, -7); render(); });
        $('schNext').addEventListener('click', () => { weekStart = addDays(weekStart, 7); render(); });
        $('schThisWeek').addEventListener('click', () => { weekStart = mondayOf(new Date()); render(); });
        $('schPick').addEventListener('change', e => {
            if (!e.target.value) return;
            weekStart = mondayOf(parseKey(e.target.value));
            render();
        });
        setInterval(() => { refreshData(); render(); }, 10000);
        window.addEventListener('storage', e => { if (e.key === SHIFTS_KEY || e.key === STAFF_KEY || e.key === TIMESHEET_KEY) { refreshData(); render(); } });
        render();
    }

    init();
})();