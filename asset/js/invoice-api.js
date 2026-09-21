// ============================================================
// invoice-api.js — LỚP DỮ LIỆU HÓA ĐƠN (NƠI DUY NHẤT CẦN SỬA KHI CÓ BACKEND)
// ------------------------------------------------------------
// Dùng chung cho History.html và Revenue.html (và Pay.html nếu muốn:
// gọi InvoiceAPI.createInvoice(...) thay vì tự ghi localStorage).
// Thứ tự nạp: auth.js -> common.js -> invoice-api.js -> history.js / revenue.js
//
// Giống MenuAPI / AuthAPI: history.js và revenue.js chỉ gọi qua object
// InvoiceAPI bên dưới, không đụng trực tiếp vào localStorage. Khi có
// backend thật, chỉ cần vào ĐÚNG các hàm trong object này: xoá phần
// "BẢN DEMO", mở comment phần "BẢN BACKEND" — không phải sửa file khác.
//
// Dạng 1 hóa đơn:
//   { id, tableName, createdAt (ISO), paymentMethod ('cash'|'transfer'|'card'),
//     items: [{ name, qty, price }], total,
//     status ('active'|'cancelled'), cancelReason?, cancelledAt? }
// ============================================================

// ---- LƯU DỮ LIỆU DEMO VÀO localStorage ----
// GIỮ NGUYÊN tên key cũ ('qlcp_invoices') vì trang Thanh toán đang ghi hóa
// đơn vào đúng key này. Khi có backend thật, xoá cả khối này.
const INVOICE_STORAGE_KEY = 'qlcp_invoices';

function readInvoicesFromStorage() {
    try {
        return JSON.parse(localStorage.getItem(INVOICE_STORAGE_KEY)) || [];
    } catch (err) {
        console.error('Không đọc được dữ liệu hóa đơn demo:', err);
        return [];
    }
}

function writeInvoicesToStorage(list) {
    try {
        localStorage.setItem(INVOICE_STORAGE_KEY, JSON.stringify(list));
    } catch (err) {
        console.error('Không lưu được dữ liệu hóa đơn demo:', err);
    }
}

const InvoiceAPI = {
    // Lấy danh sách hóa đơn. Có thể lọc theo khoảng thời gian:
    //   getInvoices()                  -> tất cả
    //   getInvoices({ from, to })      -> from/to là đối tượng Date (bao gồm 2 đầu)
    async getInvoices({ from, to } = {}) {
        // ---- BẢN DEMO ----
        let list = readInvoicesFromStorage();
        if (from || to) {
            list = list.filter(inv => {
                const t = new Date(inv.createdAt);
                return (!from || t >= from) && (!to || t <= to);
            });
        }
        return list;

        // ---- BẢN BACKEND ----
        // const params = new URLSearchParams();
        // if (from) params.set('from', from.toISOString());
        // if (to) params.set('to', to.toISOString());
        // const res = await fetch(`/api/invoices?${params}`);
        // if (!res.ok) throw new Error('Không tải được hóa đơn');
        // return await res.json();
    },

    // Tạo hóa đơn mới (dành cho trang Thanh toán). invoice = 1 hóa đơn đầy đủ như mô tả ở đầu file.
    async createInvoice(invoice) {
        // ---- BẢN DEMO ----
        const list = readInvoicesFromStorage();
        list.push(invoice);
        writeInvoicesToStorage(list);
        return invoice;

        // ---- BẢN BACKEND ----
        // const res = await fetch('/api/invoices', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(invoice),
        // });
        // if (!res.ok) throw new Error('Không tạo được hóa đơn');
        // return await res.json();
    },

    // Hủy ("xóa") hóa đơn kèm lý do. Hóa đơn không bị xoá hẳn, chỉ đổi status -> 'cancelled'.
    async cancelInvoice(id, reason) {
        // ---- BẢN DEMO ----
        const list = readInvoicesFromStorage();
        const inv = list.find(i => i.id === id);
        if (!inv) throw new Error('Không tìm thấy hóa đơn để hủy');
        if (inv.status === 'cancelled') throw new Error('Hóa đơn này đã được hủy trước đó');
        inv.status = 'cancelled';
        inv.cancelReason = reason;
        inv.cancelledAt = new Date().toISOString();
        writeInvoicesToStorage(list);
        return inv;

        // ---- BẢN BACKEND ----
        // const res = await fetch(`/api/invoices/${encodeURIComponent(id)}/cancel`, {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ reason }),
        // });
        // if (!res.ok) throw new Error('Không hủy được hóa đơn');
        // return await res.json();
    },

    // Đăng ký hàm callback được gọi khi dữ liệu hóa đơn thay đổi ở nơi khác
    // (vd: trang Thanh toán ở tab khác vừa tạo hóa đơn). Các trang dùng nó để tự tải lại.
    subscribe(callback) {
        // ---- BẢN DEMO ---- (sự kiện 'storage' chỉ bắn ở các tab KHÁC cùng trình duyệt)
        window.addEventListener('storage', (e) => {
            if (e.key === INVOICE_STORAGE_KEY) callback();
        });

        // ---- BẢN BACKEND ----
        // Dùng polling (setInterval(callback, 30000)) hoặc WebSocket/SSE nếu backend hỗ trợ.
    },
};