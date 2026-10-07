// ============================================================
// logs.js — NHẬT KÝ THAO TÁC & BÁO CÁO KẾT CA (Logs.html, chỉ Quản lý)
// ------------------------------------------------------------
// Thu ngân tự thực hiện các thao tác nhạy cảm (giảm giá, hủy món, hoàn tiền, thu/chi, chênh lệch kết ca)
// mà KHÔNG cần duyệt; mọi thao tác được ghi vào 'coffee_logs_v1' để Quản lý xem lại ở đây.
// Mục có flag = true là mục "cần chú ý": giảm giá lớn, hủy món đã làm, hoàn tiền, thu/chi lớn, lệch tiền kết ca.
// ============================================================
(function () {
    'use strict';
    const C = window.Cashier;
    const session = AuthAPI.getSession();
    if (!session) { window.location.replace('Login.html'); return; }
    if (session.roleKey !== 'manager') { const p = PAGES_BY_ROLE[session.roleKey]; window.location.replace(p ? p[0].path : 'Login.html'); return; }

    const $ = id => document.getElementById(id);
    const { esc, money, fmtTime, fmtDT } = C;
    const ROLE = { manager: 'Quản lý', waiter: 'Phục vụ', cashier: 'Thu ngân', kitchen: 'Bếp' };
    let tab = 'logs', reportShift = null;

    function fillFilters() {
        const logs = C.read(C.K.LOGS, []);
        $('fType').innerHTML = '<option value="">Tất cả</option>' + Object.entries(C.LOG_TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
        const names = [...new Set(logs.map(l => l.actorName))];
        const cur = $('fWho').value;
        $('fWho').innerHTML = '<option value="">Tất cả</option>' + names.map(n => `<option ${n === cur ? 'selected' : ''}>${esc(n)}</option>`).join('');
    }

    function renderLogs() {
        $('lgTitle').textContent = 'Nhật ký thao tác';
        $('lgFilters').hidden = false;
        $('lgHead').innerHTML = '<tr><th>Thời gian</th><th>Người thực hiện</th><th>Thao tác</th><th>Chi tiết</th><th>Số tiền</th></tr>';
        const type = $('fType').value, who = $('fWho').value, days = Number($('fRange').value), flag = $('fFlag').checked;
        const since = days ? new Date(new Date().setHours(0, 0, 0, 0) - (days - 1) * 86400000).getTime() : 0;
        const list = C.read(C.K.LOGS, []).filter(l => (!type || l.type === type) && (!who || l.actorName === who) && (!flag || l.flag) && new Date(l.time).getTime() >= since).reverse();
        $('lgSub').textContent = `${list.length} thao tác${list.filter(l => l.flag).length ? ` • ${list.filter(l => l.flag).length} mục cần chú ý` : ''}`;
        $('lgBody').innerHTML = list.length ? list.map(l => `<tr>
            <td>${fmtDT(l.time)}</td><td><b>${esc(l.actorName)}</b><br><small>${esc(ROLE[l.role] || l.role)}</small></td>
            <td>${esc(C.LOG_TYPES[l.type] || l.type)}${l.flag ? '<span class="cs-flag">Chú ý</span>' : ''}</td>
            <td style="max-width:420px">${esc(l.text)}</td><td>${l.amount ? money(l.amount) : '—'}</td></tr>`).join('')
            : '<tr><td colspan="5"><div class="empty-table-state">Không có thao tác nào trong bộ lọc này.</div></td></tr>';
        $('lgNote').textContent = 'Thu ngân tự làm các thao tác này (không cần duyệt) — nhật ký là nơi Quản lý kiểm tra lại.';
    }

    function renderShifts() {
        $('lgTitle').textContent = 'Báo cáo kết ca';
        $('lgFilters').hidden = true;
        $('lgHead').innerHTML = '<tr><th>Thu ngân</th><th>Thời gian ca</th><th>Số đơn</th><th>Doanh thu</th><th>Tiền theo sổ</th><th>Tiền đếm</th><th>Chênh lệch</th><th>Lý do</th><th></th></tr>';
        const st = C.shiftStore(), cur = st.current;
        const list = st.history.slice().reverse();
        $('lgSub').textContent = `${list.length} ca đã kết${cur ? ` • đang mở: ${cur.cashierName} (từ ${fmtTime(cur.openedAt)})` : ''}`;
        $('lgBody').innerHTML = list.length ? list.map(s => `<tr>
            <td><b>${esc(s.cashierName)}</b>${s.closedBy && s.closedBy !== s.cashierName ? `<br><small>kết bởi ${esc(s.closedBy)}</small>` : ''}</td>
            <td>${fmtDT(s.openedAt)} → ${fmtTime(s.closedAt)}</td><td>${s.summary.orders}</td><td>${money(s.summary.revenue)}</td>
            <td>${money(s.expectedCash)}</td><td>${money(s.countedCash)}</td>
            <td style="color:${s.diff ? '#b5573c' : '#2c7046'};font-weight:600">${s.diff > 0 ? '+' : ''}${money(s.diff)}</td>
            <td style="max-width:240px">${esc(s.reason || '—')}</td>
            <td><button class="btn-outline" data-rep="${s.id}">Xem</button></td></tr>`).join('')
            : '<tr><td colspan="9"><div class="empty-table-state">Chưa có ca nào được kết.</div></td></tr>';
        $('lgNote').textContent = '';
    }

    function render() { fillFilters(); (tab === 'logs' ? renderLogs : renderShifts)(); }

    document.addEventListener('DOMContentLoaded', () => {
        $('lgTabs').addEventListener('click', e => {
            const b = e.target.closest('[data-tab]'); if (!b) return;
            tab = b.dataset.tab;
            document.querySelectorAll('#lgTabs .topnav-item').forEach(x => x.classList.toggle('active', x === b));
            render();
        });
        ['fType', 'fRange', 'fWho', 'fFlag'].forEach(id => $(id).addEventListener('change', renderLogs));
        $('lgBody').addEventListener('click', e => {
            const b = e.target.closest('[data-rep]'); if (!b) return;
            reportShift = C.shiftStore().history.find(x => x.id === b.dataset.rep);
            if (reportShift) { $('lgReport').innerHTML = C.shiftReportHtml(reportShift); $('lgModal').classList.add('active'); }
        });
        $('lgClose').onclick = () => $('lgModal').classList.remove('active');
        $('lgPrint').onclick = () => { if (reportShift) C.printHtml('Báo cáo kết ca', C.shiftReportHtml(reportShift)); };
        render();
        window.addEventListener('storage', e => { if ([C.K.LOGS, C.K.SHIFT].includes(e.key)) render(); });
    });
})();
