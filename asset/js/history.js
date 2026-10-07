const LS_INVOICES_KEY = 'qlcp_invoices';
let currentStatusFilter = 'all';
let searchTerm = '';
let invoiceIdForCancel = null;

const methodLabel = { cash: 'Tiền mặt', transfer: 'Chuyển khoản', card: 'Thẻ ATM' };
const methodBadgeClass = { cash: 'badge-cash', transfer: 'badge-transfer', card: 'badge-card' };

function loadInvoices() {
    try { return JSON.parse(localStorage.getItem(LS_INVOICES_KEY)) || []; }
    catch (e) { return []; }
}
function saveInvoices(list) { localStorage.setItem(LS_INVOICES_KEY, JSON.stringify(list)); }
function fmtMoney(n) { return `${Math.round(n).toLocaleString('vi-VN')} đ`; }
function fmtDateTime(iso) {
    const d = new Date(iso);
    return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function render() {
    const all = loadInvoices().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    let list = all;
    if (currentStatusFilter !== 'all') list = list.filter(i => i.status === currentStatusFilter);
    if (searchTerm.trim()) {
        const kw = searchTerm.trim().toLowerCase();
        list = list.filter(i => i.id.toLowerCase().includes(kw) || i.tableName.toLowerCase().includes(kw));
    }

    document.getElementById('invoiceCountLabel').innerText = `Tổng cộng ${list.length} hóa đơn`;

    const tbody = document.getElementById('invoiceTableBody');
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8"><div class="empty-table-state">Không có hóa đơn phù hợp.</div></td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(inv => {
        const itemsSummary = inv.items.map(it => `${it.name} x${it.qty}`).join(', ');
        const statusBadge = inv.status === 'active'
            ? `<span class="badge badge-active">Hiệu lực</span>`
            : `<span class="badge badge-cancelled">Đã hủy</span>${inv.cancelReason ? `<div class="cancel-reason-note">Lý do: ${escapeHtml(inv.cancelReason)}</div>` : ''}`;

        return `
            <tr>
                <td><b>${inv.id}</b></td>
                <td>${inv.tableName}</td>
                <td>${fmtDateTime(inv.createdAt)}</td>
                <td style="max-width:220px;">
                    <span style="cursor:pointer; color:#7a5c3e; text-decoration:underline;" onclick="openDetailModal('${inv.id}')">${escapeHtml(itemsSummary)}</span>
                </td>
                <td><span class="badge ${methodBadgeClass[inv.paymentMethod]}">${methodLabel[inv.paymentMethod] || inv.paymentMethod}</span></td>
                <td><b>${fmtMoney(inv.total)}</b></td>
                <td>${statusBadge}</td>
                <td>
                    <div style="display:flex; gap:6px;">
                        <button class="btn-outline" style="padding:6px 10px; font-size:12px;" onclick="openDetailModal('${inv.id}')">Xem</button>
                        ${inv.status === 'active' ? `<button class="btn-danger" style="padding:6px 10px; font-size:12px;" onclick="openCancelModal('${inv.id}')">Xóa</button>` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.innerText = str;
    return div.innerHTML;
}

// ---- Lọc trạng thái + tìm kiếm ----
document.getElementById('statusFilterBar').addEventListener('click', (e) => {
    const btn = e.target.closest('.topnav-item');
    if (!btn) return;
    document.querySelectorAll('#statusFilterBar .topnav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentStatusFilter = btn.dataset.status;
    render();
});
document.getElementById('searchBox').addEventListener('input', (e) => {
    searchTerm = e.target.value;
    render();
});

// ---- Modal xóa hóa đơn ----
function openCancelModal(invoiceId) {
    const inv = loadInvoices().find(i => i.id === invoiceId);
    if (!inv) return;
    invoiceIdForCancel = invoiceId;
    document.getElementById('cancelModalInvoiceId').innerText = inv.id;
    document.getElementById('cancelModalTotal').innerText = fmtMoney(inv.total);
    document.getElementById('cancelReasonInput').value = '';
    document.getElementById('btnConfirmCancel').disabled = true;
    document.getElementById('cancelModal').classList.add('active');
}
function closeCancelModal() {
    document.getElementById('cancelModal').classList.remove('active');
    invoiceIdForCancel = null;
}
document.getElementById('cancelReasonInput').addEventListener('input', (e) => {
    document.getElementById('btnConfirmCancel').disabled = e.target.value.trim().length === 0;
});
function confirmCancelInvoice() {
    const reason = document.getElementById('cancelReasonInput').value.trim();
    if (!invoiceIdForCancel || !reason) return;

    const list = loadInvoices();
    const inv = list.find(i => i.id === invoiceIdForCancel);
    if (!inv) return;
    inv.status = 'cancelled';
    inv.cancelReason = reason;
    inv.cancelledAt = new Date().toISOString();
    saveInvoices(list);

    closeCancelModal();
    render();
}

// ---- Modal chi tiết hóa đơn ----
function openDetailModal(invoiceId) {
    const inv = loadInvoices().find(i => i.id === invoiceId);
    if (!inv) return;
    document.getElementById('detailModalTitle').innerText = `Hóa đơn ${inv.id}`;
    document.getElementById('detailModalMeta').innerText = `${inv.tableName} • ${fmtDateTime(inv.createdAt)} • ${methodLabel[inv.paymentMethod] || inv.paymentMethod}`;
    document.getElementById('detailModalItems').innerHTML = inv.items.map(it => `
        <tr>
            <td>${escapeHtml(it.name)}</td>
            <td>${it.qty}</td>
            <td>${fmtMoney(it.price * it.qty)}</td>
        </tr>
    `).join('') + `
        <tr><td colspan="2" style="text-align:right; font-weight:700;">Tổng cộng</td><td style="font-weight:700;">${fmtMoney(inv.total)}</td></tr>
    `;
    const noteEl = document.getElementById('detailModalCancelNote');
    noteEl.innerHTML = inv.status === 'cancelled'
        ? `<div class="cancel-reason-note" style="margin-bottom:16px;">Đã hủy lúc ${fmtDateTime(inv.cancelledAt)} — Lý do: ${escapeHtml(inv.cancelReason || '')}</div>`
        : '';
    document.getElementById('detailModal').classList.add('active');
}
function closeDetailModal() {
    document.getElementById('detailModal').classList.remove('active');
}

// Tự cập nhật nếu có hóa đơn mới / thay đổi ở tab khác
window.addEventListener('storage', (e) => {
    if (e.key === LS_INVOICES_KEY) render();
});

render();
