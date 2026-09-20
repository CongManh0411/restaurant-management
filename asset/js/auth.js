// ============================================================
// auth.js — ĐĂNG NHẬP & PHÂN QUYỀN (nơi DUY NHẤT cần sửa khi nối backend)
// ------------------------------------------------------------
// File này phải được nạp TRƯỚC script.js trên MỌI trang (kể cả
// Login.html). Nó tự làm 2 việc, không cần gọi gì thêm:
//   1) Nếu đang ở Login.html: gắn sự kiện cho form đăng nhập.
//   2) Nếu đang ở trang khác: chặn ngay nếu chưa đăng nhập, hoặc
//      nếu vai trò hiện tại không được phép xem trang này.
//
// script.js (vẽ sidebar) đọc dữ liệu từ PAGES_BY_ROLE và UserAPI
// bên dưới — không định nghĩa lại ở đó.
// ============================================================

// ---- 1) VAI TRÒ NÀO ĐƯỢC VÀO TRANG NÀO + MENU SIDEBAR ----
// Đây là bảng phân quyền DUY NHẤT của toàn bộ web.
//   path  = tên file trang sẽ mở khi bấm vào sidebar
//   label = chữ hiển thị trên sidebar
//   view  = PHẢI khớp với data-page="..." trên thẻ <body> của trang đó
//           (dùng để: tô mục đang active + kiểm tra có được phép vào trang không)
//   id    = (không bắt buộc) id cho thẻ <a>, để CSS/JS khác trỏ vào nếu cần
//
// Mục ĐẦU TIÊN trong mảng của mỗi vai trò = trang mặc định sau khi đăng
// nhập, và cũng là trang sẽ tự chuyển về nếu vai trò đó lỡ vào nhầm trang
// (gõ thẳng URL, bấm nút back...).
//
// ==> THÊM TRANG MỚI SAU NÀY: chỉ cần thêm 1 dòng vào đúng vai trò được
//     phép xem trang đó. Trang sẽ tự xuất hiện trên sidebar CỦA VAI TRÒ ĐÓ
//     và tự được phép truy cập — không cần sửa gì ở file khác.
// ==> THÊM VAI TRÒ MỚI (vd: 'staff' cho Nhân viên order): thêm 1 khoá mới
//     vào ROLE_LABELS và PAGES_BY_ROLE, rồi thêm tài khoản demo tương ứng
//     ở DEMO_ACCOUNTS bên dưới.
const ROLE_LABELS = {
    manager: 'Quản lý',
    cashier: 'Thu ngân',
};

const PAGES_BY_ROLE = {
    manager: [
        { path: 'Table.html',   label: 'Bàn',        view: 'tables' },
        { path: 'Menu.html',    label: 'Menu',       view: 'menu',    id: 'navMenu' },
        { path: 'Revenue.html', label: 'Doanh thu',  view: 'revenue', id: 'navRevenue' },
        { path: 'History.html', label: 'Lịch sử',    view: 'history', id: 'navHistory' },
        { path: 'Staff.html',   label: 'Nhân viên',  view: 'staff',   id: 'navStaff' },
        { path: 'warehouse.html',  label: 'Kho',       view: 'warehouse', id: 'navWarehouse' },
    ],
    cashier: [
        // Thu ngân chỉ có đúng 1 mục trong sidebar: Thanh toán.
        { path: 'Pay.html',     label: 'Thanh toán', view: 'pay',     id: 'navPay' },
    ],
};

// ---- 2) TÀI KHOẢN DEMO (CHỈ DÙNG KHI CHƯA CÓ BACKEND — xoá cả khối
//         DEMO_ACCOUNTS này khi nối API đăng nhập thật) ----
// Khớp với phần "Tài khoản thử" hiển thị trên Login.html.
const DEMO_ACCOUNTS = [
    { username: 'quanly',  password: '123456', roleKey: 'manager', name: 'Nguyễn Văn A' },
    { username: 'thungan', password: '123456', roleKey: 'cashier', name: 'Trần Thị B' },
];

// ---- 3) NƠI LƯU PHIÊN ĐĂNG NHẬP (BẢN DEMO: localStorage) ----
const AUTH_STORAGE_KEY = 'coffee_auth_session_v1'; // lưu { roleKey, name }
// BẢN BACKEND: thường sẽ lưu 1 "token" thay vì lưu thẳng roleKey/name,
// ví dụ localStorage.setItem('token', data.token) — xem gợi ý trong
// AuthAPI.login()/getSession() bên dưới.

// ---- 4) AuthAPI — NƠI DUY NHẤT CẦN SỬA KHI CÓ BACKEND THẬT ----
// Toàn bộ phần còn lại của file (chặn trang, form đăng nhập, sidebar ở
// script.js) chỉ gọi qua các hàm của AuthAPI, không đụng trực tiếp vào
// localStorage. Vì vậy khi có backend, chỉ cần sửa ĐÚNG các hàm trong
// object này.
const AuthAPI = {
    // Gọi khi bấm nút "Đăng nhập". Trả về { roleKey, name } nếu đúng,
    // ném lỗi (throw) nếu sai tài khoản/mật khẩu.
    async login(username, password) {
        // ---- BẢN DEMO ----
        const acc = DEMO_ACCOUNTS.find(
            a => a.username === username.trim() && a.password === password
        );
        if (!acc) throw new Error('Sai tên đăng nhập hoặc mật khẩu.');
        const session = { roleKey: acc.roleKey, name: acc.name };
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
        return session;

        // ---- BẢN BACKEND ----
        // const res = await fetch('/api/auth/login', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ username, password }),
        // });
        // if (!res.ok) throw new Error('Sai tên đăng nhập hoặc mật khẩu.');
        // const data = await res.json(); // kỳ vọng trả về { token, roleKey, name }
        // localStorage.setItem('token', data.token);
        // return data;
    },

    // Đăng xuất — được gọi từ nút "Đăng xuất" ở đáy sidebar (xem script.js)
    async logout() {
        // ---- BẢN DEMO ----
        localStorage.removeItem(AUTH_STORAGE_KEY);

        // ---- BẢN BACKEND ----
        // try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (err) {}
        // localStorage.removeItem('token');

        window.location.href = 'Login.html';
    },

    // Đọc phiên đăng nhập hiện tại (đồng bộ — không chờ mạng), dùng để
    // chặn trang ngay khi tải trang, tránh nháy nội dung trước khi đá về
    // Login.html. Trả về null nếu chưa đăng nhập.
    getSession() {
        // ---- BẢN DEMO ----
        try {
            const raw = localStorage.getItem(AUTH_STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (err) {
            return null;
        }

        // ---- BẢN BACKEND ----
        // Token không tự nói lên vai trò/tên người dùng, nên bản backend
        // thường cần lưu tạm { roleKey, name } lúc login (như DEMO ở trên)
        // để đọc đồng bộ ở đây, còn quyền THẬT SỰ vẫn phải được kiểm tra
        // lại ở server cho từng API — phần chặn trang ở đây chỉ để tránh
        // hiện nhầm giao diện, không thay được bảo mật phía backend.
    },
};

// Thông tin hiển thị trên sidebar: logo quán + tên/chức vụ người đang
// đăng nhập. script.js gọi UserAPI.getProfile() (qua getProfileOnce())
// để đổ dữ liệu này vào sidebar.
const UserAPI = {
    async getProfile() {
        // ---- BẢN DEMO ----
        const session = AuthAPI.getSession();
        const roleKey = session ? session.roleKey : null;
        return {
            shopLogoUrl: 'asset/images/images.jpg',
            name: (session && session.name) || 'Người dùng',
            role: ROLE_LABELS[roleKey] || '—',
            roleKey,
        };

        // ---- BẢN BACKEND ----
        // const res = await fetch('/api/me'); // hoặc /api/auth/me tuỳ backend đặt tên
        // if (!res.ok) throw new Error('Không tải được thông tin người dùng');
        // return await res.json(); // kỳ vọng { shopLogoUrl, name, role, roleKey }
    },
};

// ============================================================
// 5) CHẶN TRUY CẬP TRANG KHI CHƯA ĐĂNG NHẬP HOẶC SAI VAI TRÒ
// ------------------------------------------------------------
// Chạy NGAY khi auth.js được nạp (không chờ DOMContentLoaded), vì
// vậy auth.js phải được đặt TRƯỚC script.js trong <body>. Trang
// Login.html có data-page="login" nên không bị chặn ở đây.
// ============================================================
(function guardPage() {
    const currentPage = document.body && document.body.dataset.page;
    if (!currentPage || currentPage === 'login') return; // trang đăng nhập / trang không cần bảo vệ

    const session = AuthAPI.getSession();
    if (!session) {
        window.location.replace('Login.html');
        return;
    }

    const allowedPages = PAGES_BY_ROLE[session.roleKey];
    if (!allowedPages) {
        // Vai trò lạ (dữ liệu hỏng) -> coi như chưa đăng nhập hợp lệ
        window.location.replace('Login.html');
        return;
    }

    const isAllowed = allowedPages.some(p => p.view === currentPage);
    if (!isAllowed) {
        // Đăng nhập rồi nhưng vai trò này không được xem trang hiện tại
        // -> đưa về trang mặc định của vai trò đó (không văng ra ngoài).
        window.location.replace(allowedPages[0].path);
    }
})();

// ============================================================
// 6) XỬ LÝ FORM ĐĂNG NHẬP — chỉ chạy khi trang có #loginForm
//    (tức là chỉ có tác dụng trên Login.html, các trang khác bỏ qua)
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    if (!form) return;

    // Nếu đã đăng nhập sẵn mà lại mở Login.html -> vào thẳng trang mặc định
    const existing = AuthAPI.getSession();
    if (existing && PAGES_BY_ROLE[existing.roleKey]) {
        window.location.replace(PAGES_BY_ROLE[existing.roleKey][0].path);
        return;
    }

    const userEl = document.getElementById('username');
    const passEl = document.getElementById('password');
    const errEl = document.getElementById('loginError');
    const toggleBtn = document.getElementById('togglePass');
    const submitBtn = form.querySelector('.login-btn');

    // Nút "Hiện/Ẩn" mật khẩu
    if (toggleBtn && passEl) {
        toggleBtn.addEventListener('click', () => {
            const showing = passEl.type === 'text';
            passEl.type = showing ? 'password' : 'text';
            toggleBtn.textContent = showing ? 'Hiện' : 'Ẩn';
            toggleBtn.setAttribute('aria-label', showing ? 'Hiện mật khẩu' : 'Ẩn mật khẩu');
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (errEl) errEl.hidden = true;
        if (submitBtn) submitBtn.disabled = true;

        try {
            const session = await AuthAPI.login(userEl.value, passEl.value);
            const home = PAGES_BY_ROLE[session.roleKey]
                ? PAGES_BY_ROLE[session.roleKey][0].path
                : 'Login.html';
            window.location.href = home;
        } catch (err) {
            if (errEl) {
                errEl.textContent = err.message || 'Đăng nhập thất bại. Vui lòng thử lại.';
                errEl.hidden = false;
            }
            if (submitBtn) submitBtn.disabled = false;
        }
    });
});
