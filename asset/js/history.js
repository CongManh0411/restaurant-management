// ============================================================
// history.js — LOGIC RIÊNG CỦA TRANG LỊCH SỬ HÓA ĐƠN (chỉ nạp trong History.html)
// Thứ tự nạp: auth.js -> common.js -> invoice-api.js -> history.js
//   - Dữ liệu lấy/sửa qua InvoiceAPI (invoice-api.js)
//   - fmtMoney() và escapeHtml() nằm ở common.js (dùng chung)
// ============================================================

let allInvoices = []; // cache danh sách hóa đơn (mới nhất trước) — lọc/tìm kiếm chạy trên cache này
let currentStatusFilter = 'all';
let searchTerm = '';
let invoiceIdForCancel = null;
let latestRequestId = 0; // chống "kết quả cũ về trễ ghi đè kết quả mới" khi tải lại liên tiếp

const methodLabel = { cash: 'Tiền mặt', transfer: 'Chuyển khoản', card: 'Thẻ ATM' };
const methodBadgeClass = { cash: 'badge-cash', transfer: 'badge-transfer', card: 'badge-card' };

const tableBodyEl = document.getElementById('invoiceTableBody');

function fmtDateTime(iso) {
    const d = new Date(iso);
    return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ============================================================
// 1) TẢI DỮ LIỆU (qua InvoiceAPI) — có trạng thái "đang tải" và "lỗi"
// ============================================================
function showTableMessage(text) {
    tableBodyEl.innerHTML = `<tr><td colspan="8"><div class="empty-table-state">${escapeHtml(text)}</div></td></tr>`;
}

// silent = true: tải lại ngầm (không nháy chữ "Đang tải...") — dùng sau khi hủy hóa đơn / khi tab khác thay đổi dữ liệu
async function reloadInvoices({ silent = false } = {}) {
    const requestId = ++latestRequestId;
    if (!silent) showTableMessage('Đang tải hóa đơn...');

    try {
        const list = await InvoiceAPI.getInvoices();
        if (requestId !== latestRequestId) return; // đã có lần tải mới hơn, bỏ kết quả này
        allInvoices = [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        render();
    } catch (err) {
        if (requestId !== latestRequestId) return;
        console.error('Không tải được hóa đơn:', err);
        document.getElementById('invoiceCountLabel').innerText = '';
        showTableMessage('Không tải được hóa đơn. Vui lòng tải lại trang.');
    }
}

// ============================================================
// 2) VẼ BẢNG (chạy đồng bộ trên cache allInvoices — dùng cho lọc + tìm kiếm)
//    Mọi giá trị chèn vào HTML đều qua escapeHtml(); nút thao tác dùng
//    data-action/data-id (không dùng onclick="..." gắn chuỗi id vào HTML nữa).
// ============================================================
function render() {
    let list = allInvoices;
    if (currentStatusFilter !== 'all') list = list.filter(i => i.status === currentStatusFilter);
    if (searchTerm.trim()) {
        const kw = searchTerm.trim().toLowerCase();
        list = list.filter(i => String(i.id).toLowerCase().includes(kw) || String(i.tableName).toLowerCase().includes(kw));
    }

    document.getElementById('invoiceCountLabel').innerText = `Tổng cộng ${list.length} hóa đơn`;

    if (list.length === 0) {
        showTableMessage('Không có hóa đơn phù hợp.');
        return;
    }

    tableBodyEl.innerHTML = list.map(inv => {
        const id = escapeHtml(inv.id);
        const itemsSummary = (inv.items || []).map(it => `${it.name} x${it.qty}`).join(', ');
        const statusBadge = inv.status === 'active'
            ? `<span class="badge badge-active">Hiệu lực</span>`
            : `<span class="badge badge-cancelled">Đã hủy</span>${inv.cancelReason ? `<div class="cancel-reason-note">Lý do: ${escapeHtml(inv.cancelReason)}</div>` : ''}`;
        const methodClass = methodBadgeClass[inv.paymentMethod] || '';
        const methodText = methodLabel[inv.paymentMethod] || inv.paymentMethod;

        return `
            <tr>
                <td><b>${id}</b></td>
                <td>${escapeHtml(inv.tableName)}</td>
                <td>${fmtDateTime(inv.createdAt)}</td>
                <td style="max-width:220px;">
                    <span style="cursor:pointer; color:#7a5c3e; text-decoration:underline;" data-action="detail" data-id="${id}">${escapeHtml(itemsSummary)}</span>
                </td>
                <td><span class="badge ${methodClass}">${escapeHtml(methodText)}</span></td>
                <td><b>${fmtMoney(inv.total)}</b></td>
                <td>${statusBadge}</td>
                <td>
                    <div style="display:flex; gap:6px;">
                        <button class="btn-outline" style="padding:6px 10px; font-size:12px;" data-action="detail" data-id="${id}">Xem</button>
                        ${inv.status === 'active' ? `<button class="btn-danger" style="padding:6px 10px; font-size:12px;" data-action="cancel" data-id="${id}">Xóa</button>` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Bấm vào chữ tóm tắt món / nút Xem / nút Xóa trong bảng (gắn 1 lần cho cả tbody)
tableBodyEl.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    if (el.dataset.action === 'detail') openDetailModal(el.dataset.id);
    else if (el.dataset.action === 'cancel') openCancelModal(el.dataset.id);
});

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

// ============================================================
// 3) MODAL XÓA (HỦY) HÓA ĐƠN
//    closeCancelModal() và confirmCancelInvoice() được gọi từ History.html
//    (onclick) nên PHẢI giữ là hàm toàn cục, không đổi tên.
// ============================================================
function openCancelModal(invoiceId) {
    const inv = allInvoices.find(i => i.id === invoiceId);
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

async function confirmCancelInvoice() {
    const reason = document.getElementById('cancelReasonInput').value.trim();
    if (!invoiceIdForCancel || !reason) return;

    // Khoá nút trong lúc chờ API để tránh bấm trùng
    const confirmBtn = document.getElementById('btnConfirmCancel');
    confirmBtn.disabled = true;

    try {
        await InvoiceAPI.cancelInvoice(invoiceIdForCancel, reason);
        closeCancelModal();
        await reloadInvoices({ silent: true });
    } catch (err) {
        console.error('Không hủy được hóa đơn:', err);
        alert('Có lỗi xảy ra, không hủy được hóa đơn. Vui lòng thử lại.');
        confirmBtn.disabled = false; // giữ modal mở để người dùng bấm lại
    }
}

// ============================================================
// 4) MODAL CHI TIẾT HÓA ĐƠN
//    closeDetailModal() được gọi từ History.html (onclick) — giữ là hàm toàn cục.
// ============================================================
function openDetailModal(invoiceId) {
    const inv = allInvoices.find(i => i.id === invoiceId);
    if (!inv) return;
    document.getElementById('detailModalTitle').innerText = `Hóa đơn ${inv.id}`;
    document.getElementById('detailModalMeta').innerText = `${inv.tableName} • ${fmtDateTime(inv.createdAt)} • ${methodLabel[inv.paymentMethod] || inv.paymentMethod}`;
    document.getElementById('detailModalItems').innerHTML = (inv.items || []).map(it => `
        <tr>
            <td>${escapeHtml(it.name)}</td>
            <td>${escapeHtml(it.qty)}</td>
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

// ============================================================
// 5) KHỞI ĐỘNG TRANG
// ============================================================
// Tự cập nhật nếu có hóa đơn mới / thay đổi ở nơi khác (vd: tab Thanh toán)
InvoiceAPI.subscribe(() => reloadInvoices({ silent: true }));

reloadInvoices();