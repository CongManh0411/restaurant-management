const LS_INVOICES_KEY = 'qlcp_invoices';
let currentPeriod = 'today';
let customFrom = null;
let customTo = null;

function loadInvoices() {
    try { return JSON.parse(localStorage.getItem(LS_INVOICES_KEY)) || []; }
    catch (e) { return []; }
}

function fmtMoney(n) { return `${Math.round(n).toLocaleString('vi-VN')} đ`; }

function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d) { const x = new Date(d); x.setHours(23,59,59,999); return x; }

function getPeriodRange(period) {
    const now = new Date();
    if (period === 'today') {
        return { start: startOfDay(now), end: endOfDay(now), label: 'Doanh thu hôm nay' };
    }
    if (period === 'week') {
        const day = now.getDay() === 0 ? 7 : now.getDay(); // Thứ 2 = 1 ... CN = 7
        const monday = new Date(now); monday.setDate(now.getDate() - (day - 1));
        const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
        return { start: startOfDay(monday), end: endOfDay(sunday), label: 'Doanh thu tuần này' };
    }
    if (period === 'month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return { start: startOfDay(start), end: endOfDay(end), label: 'Doanh thu tháng này' };
    }
    if (period === 'quarter') {
        const q = Math.floor(now.getMonth() / 3);
        const start = new Date(now.getFullYear(), q * 3, 1);
        const end = new Date(now.getFullYear(), q * 3 + 3, 0);
        return { start: startOfDay(start), end: endOfDay(end), label: `Doanh thu quý ${q + 1}` };
    }
    if (period === 'year') {
        const start = new Date(now.getFullYear(), 0, 1);
        const end = new Date(now.getFullYear(), 11, 31);
        return { start: startOfDay(start), end: endOfDay(end), label: 'Doanh thu năm nay' };
    }
    // custom
    if (customFrom && customTo) {
        return { start: startOfDay(new Date(customFrom)), end: endOfDay(new Date(customTo)), label: `Doanh thu ${customFrom} → ${customTo}` };
    }
    return { start: startOfDay(now), end: endOfDay(now), label: 'Doanh thu hôm nay' };
}

function render() {
    const { start, end, label } = getPeriodRange(currentPeriod);
    document.getElementById('periodLabel').innerText = label;

    const all = loadInvoices();
    const inRange = all.filter(inv => {
        const t = new Date(inv.createdAt);
        return t >= start && t <= end;
    });

    const active = inRange.filter(i => i.status === 'active');
    const cancelled = inRange.filter(i => i.status === 'cancelled');

    const totalRevenue = active.reduce((s, i) => s + i.total, 0);
    const cancelledTotal = cancelled.reduce((s, i) => s + i.total, 0);

    document.getElementById('statTotalRevenue').innerText = fmtMoney(totalRevenue);
    document.getElementById('statInvoiceCount').innerText = active.length;
    document.getElementById('statAvgInvoice').innerText = fmtMoney(active.length ? totalRevenue / active.length : 0);
    document.getElementById('statCancelled').innerText = `${cancelled.length} hóa đơn — ${fmtMoney(cancelledTotal)}`;

    // Theo phương thức (chỉ tính hóa đơn còn hiệu lực)
    const byMethod = { cash: 0, transfer: 0, card: 0 };
    active.forEach(i => { byMethod[i.paymentMethod] = (byMethod[i.paymentMethod] || 0) + i.total; });
    const maxMethod = Math.max(byMethod.cash, byMethod.transfer, byMethod.card, 1);

    document.getElementById('pmCashAmount').innerText = `${fmtMoney(byMethod.cash)} (${totalRevenue ? Math.round(byMethod.cash / totalRevenue * 100) : 0}%)`;
    document.getElementById('pmTransferAmount').innerText = `${fmtMoney(byMethod.transfer)} (${totalRevenue ? Math.round(byMethod.transfer / totalRevenue * 100) : 0}%)`;
    document.getElementById('pmCardAmount').innerText = `${fmtMoney(byMethod.card)} (${totalRevenue ? Math.round(byMethod.card / totalRevenue * 100) : 0}%)`;
    document.getElementById('pmCashBar').style.width = `${byMethod.cash / maxMethod * 100}%`;
    document.getElementById('pmTransferBar').style.width = `${byMethod.transfer / maxMethod * 100}%`;
    document.getElementById('pmCardBar').style.width = `${byMethod.card / maxMethod * 100}%`;

    // Bảng theo ngày (chỉ tính hóa đơn còn hiệu lực, nhóm theo ngày, mới nhất trước)
    const byDay = {};
    active.forEach(i => {
        const d = new Date(i.createdAt);
        const key = d.toLocaleDateString('vi-VN');
        if (!byDay[key]) byDay[key] = { count: 0, cash: 0, transfer: 0, card: 0, total: 0, sortKey: startOfDay(d).getTime() };
        byDay[key].count++;
        byDay[key][i.paymentMethod] += i.total;
        byDay[key].total += i.total;
    });
    const days = Object.entries(byDay).sort((a, b) => b[1].sortKey - a[1].sortKey);

    const tbody = document.getElementById('dailyTableBody');
    if (days.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="empty-table-state">Chưa có dữ liệu trong khoảng thời gian này.</div></td></tr>`;
    } else {
        tbody.innerHTML = days.map(([date, d]) => `
            <tr>
                <td><b>${date}</b></td>
                <td>${d.count}</td>
                <td>${fmtMoney(d.cash)}</td>
                <td>${fmtMoney(d.transfer)}</td>
                <td>${fmtMoney(d.card)}</td>
                <td><b>${fmtMoney(d.total)}</b></td>
            </tr>
        `).join('');
    }
}

document.getElementById('periodFilterBar').addEventListener('click', (e) => {
    const btn = e.target.closest('.topnav-item');
    if (!btn) return;
    document.querySelectorAll('#periodFilterBar .topnav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPeriod = btn.dataset.period;
    document.getElementById('dateRangeInputs').classList.toggle('active', currentPeriod === 'custom');
    if (currentPeriod !== 'custom') render();
});

document.getElementById('btnApplyRange').addEventListener('click', () => {
    customFrom = document.getElementById('dateFrom').value;
    customTo = document.getElementById('dateTo').value;
    if (!customFrom || !customTo) { alert('Vui lòng chọn đủ Từ ngày và Đến ngày.'); return; }
    render();
});

// Tự cập nhật nếu có hóa đơn mới được tạo ở tab/trang khác (cùng trình duyệt)
window.addEventListener('storage', (e) => {
    if (e.key === LS_INVOICES_KEY) render();
});

render();
