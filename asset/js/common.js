// ============================================================
// NẠP ICON FONT "Remix Icon" (dùng cho icon đăng xuất và các icon
// khác sau này trong sidebar). Chỉ cần sửa version ở link CDN
// bên dưới nếu muốn cập nhật — không cần sửa <head> của từng trang.
// ============================================================
(function loadRemixIconFont() {
    if (document.querySelector('link[data-remixicon]')) return; // tránh nạp trùng
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/remixicon@4.3.0/fonts/remixicon.css';
    link.dataset.remixicon = 'true';
    document.head.appendChild(link);
})();
 
// ============================================================
// 1) NẠP SIDEBAR DÙNG CHUNG TỪ sidebar.html
//    Mọi trang (Menu.html, Table.html, Revenue.html...) đều
//    chạy đoạn này để lấy sidebar giống nhau, không cần copy-paste.
// ============================================================
// ============================================================
// 0) AuthAPI / UserAPI / PHÂN QUYỀN (ROLE_LABELS, PAGES_BY_ROLE)
//    đã chuyển hết sang auth.js — đó mới là nơi DUY NHẤT cần sửa
//    khi nối backend thật cho đăng nhập/phân quyền.
//    auth.js PHẢI được nạp TRƯỚC script.js trên mọi trang, script.js
//    bên dưới chỉ ĐỌC lại các biến/hàm đó để vẽ sidebar.
// ============================================================
 
// Sidebar cần profile ở 2 chỗ (hiển thị tên/chức vụ + phân quyền) nên chỉ gọi UserAPI 1 lần.
let profilePromise = null;
function getProfileOnce() {
    if (!profilePromise) profilePromise = UserAPI.getProfile();
    return profilePromise;
}
 
fetch('sidebar.html')
    .then(res => res.text())
    .then(html => {
        document.getElementById('sidebar-container').innerHTML = html;
        // Sau khi sidebar đã có trong trang: gắn nút đăng xuất, đổ thông tin người dùng,
        // rồi vẽ menu theo vai trò (vẽ xong mới đánh dấu mục active — nằm trong initSidebarMenu)
        initSidebarLogout();
        initSidebarProfile();
        initSidebarMenu();
    })
    .catch(err => console.error('Không tải được sidebar.html:', err));
 
// ============================================================
// 1b) MOBILE: thanh topbar (nút ☰) + sidebar dạng drawer
//     Chạy trên mọi trang, không phụ thuộc sidebar đã tải xong hay
//     chưa — vì nút bấm chỉ tìm sidebar (.sidebar) tại thời điểm click.
// ============================================================
function initMobileNav() {
    const main = document.querySelector('.main');
    if (!main || document.querySelector('.mobile-topbar')) return; // trang không có .main, hoặc đã khởi tạo rồi
 
    // Thanh topbar: nút mở menu + tên trang (lấy từ <title>)
    const topbar = document.createElement('div');
    topbar.className = 'mobile-topbar';
    topbar.innerHTML = `
        <button type="button" class="sidebar-toggle-btn" id="sidebarToggleBtn" aria-label="Mở menu">
            <i class="ri-menu-line"></i>
        </button>
        <span class="mobile-topbar-title">${document.title}</span>
    `;
    main.prepend(topbar);
 
    // Lớp phủ tối, bấm vào để đóng sidebar
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.id = 'sidebarOverlay';
    document.body.appendChild(overlay);
 
    const openSidebar = () => {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) sidebar.classList.add('open');
        overlay.classList.add('active');
    };
 
    const closeSidebar = () => {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) sidebar.classList.remove('open');
        overlay.classList.remove('active');
    };
 
    document.getElementById('sidebarToggleBtn').addEventListener('click', () => {
        const sidebar = document.querySelector('.sidebar');
        const isOpen = sidebar && sidebar.classList.contains('open');
        if (isOpen) closeSidebar(); else openSidebar();
    });
 
    overlay.addEventListener('click', closeSidebar);
 
    // Bấm chọn 1 mục trong sidebar (Bàn/Menu/Doanh thu...) thì tự đóng drawer lại
    document.addEventListener('click', (e) => {
        if (e.target.closest('.sidebar-menu .tab')) closeSidebar();
    });
 
    // Xoay ngang <-> dọc hoặc resize cửa sổ qua breakpoint desktop: đảm bảo
    // sidebar/overlay không bị kẹt ở trạng thái "đang mở" khi quay lại màn lớn
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) closeSidebar();
    });
}
 
initMobileNav();
 
function initSidebarNav() {
    const sidebarTabs = document.querySelectorAll('.sidebar-menu .tab');
    // Body mỗi trang phải có data-page="xxx" khớp với data-view="xxx" tương ứng
    const currentPage = document.body.dataset.page;
 
    sidebarTabs.forEach(tab => {
        if (tab.dataset.view === currentPage) {
            tab.classList.add('active');
        }
    });
    // Không cần addEventListener click nữa — vì giờ sidebar là <a href>,
    // trình duyệt tự chuyển trang thật khi bấm vào.
}
 
// Gắn sự kiện cho nút "Đăng xuất" ở đáy sidebar
function initSidebarLogout() {
    const btnLogout = document.getElementById('btnLogout');
    if (!btnLogout) return;
 
    btnLogout.addEventListener('click', async () => {
        if (!confirm('Bạn có chắc muốn đăng xuất?')) return;
        await AuthAPI.logout();
    });
}
 
// Đổ logo + tên + chức vụ thật vào sidebar (thay cho "Tên"/"Chức vụ" mặc định trong HTML)
async function initSidebarProfile() {
    const logoEl = document.getElementById('shopLogo');
    const nameEl = document.getElementById('userName');
    const roleEl = document.getElementById('userRole');
    if (!logoEl && !nameEl && !roleEl) return; // trang này không có sidebar dạng chuẩn
 
    try {
        const profile = await getProfileOnce();
        if (logoEl && profile.shopLogoUrl) logoEl.src = profile.shopLogoUrl;
        if (nameEl && profile.name) nameEl.textContent = profile.name;
        if (roleEl && profile.role) roleEl.textContent = profile.role;
    } catch (err) {
        console.error('Không tải được thông tin người dùng:', err);
        // Giữ nguyên "Tên"/"Chức vụ" mặc định trong HTML nếu lỗi
    }
}
 
// Vẽ các mục menu vào sidebar từ mảng menuItems ({ path, label, view, id }).
// Giống <Sidebar menuItems={...} /> trong React: đưa danh sách vào, hàm tự vẽ ra từng liên kết.
function renderSidebarMenu(menuItems) {
    const menuEl = document.getElementById('sidebarMenu');
    if (!menuEl) return;
    menuEl.innerHTML = ''; // chỉ dùng để xóa nội dung cũ, không chèn HTML mới
 
    menuItems.forEach(item => {
        const link = document.createElement('a');
        link.className = 'tab';
        link.href = item.path;
        link.dataset.view = item.view;
        link.textContent = item.label;
        if (item.id) link.id = item.id;
        menuEl.appendChild(link);
    });
}
 
// Chọn danh sách menu theo vai trò đang đăng nhập, vẽ ra sidebar rồi đánh dấu mục đang active.
//  - Nếu trang hiện tại không nằm trong menu của vai trò thì chuyển về mục đầu tiên của menu đó
//    (ví dụ thu ngân gõ thẳng Menu.html -> về Pay.html).
//  - Nếu chưa biết vai trò (chưa có roleKey / lỗi) thì hiện menu quản lý như trước đây, không chuyển trang.
// Lưu ý: đây chỉ là ẩn/hiện trên giao diện — quyền thật sự vẫn phải kiểm tra ở backend.
async function initSidebarMenu() {
    if (!document.getElementById('sidebarMenu')) return; // trang không có sidebar dạng chuẩn
 
    let roleKey = null;
    try {
        const profile = await getProfileOnce();
        roleKey = profile && profile.roleKey;
    } catch (err) {
        console.error('Không lấy được vai trò người dùng:', err);
    }
 
    const knownRole = Object.prototype.hasOwnProperty.call(PAGES_BY_ROLE, roleKey);
    if (!knownRole) console.warn('Chưa biết vai trò người dùng — hiển thị menu quản lý mặc định.');
    const menuItems = knownRole ? PAGES_BY_ROLE[roleKey] : PAGES_BY_ROLE.manager;
 
    renderSidebarMenu(menuItems);
    initSidebarNav();
 
    const currentPage = document.body.dataset.page;
    const homePage = menuItems[0].path;
    const alreadyAtHome = window.location.pathname.endsWith(homePage);
    if (knownRole && currentPage && !alreadyAtHome && !menuItems.some(item => item.view === currentPage)) {
        window.location.replace(homePage);
    }
}
