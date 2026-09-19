
// ============================================================
// 1) NẠP SIDEBAR DÙNG CHUNG TỪ sidebar.html
//    Mọi trang (Menu.html, Table.html, Revenue.html...) đều
//    chạy đoạn này để lấy sidebar giống nhau, không cần copy-paste.
// ============================================================
fetch('sidebar.html')
    .then(res => res.text())
    .then(html => {
        document.getElementById('sidebar-container').innerHTML = html;
        // Sau khi sidebar đã có trong trang, đánh dấu đúng mục đang active
        initSidebarNav();
    })
    .catch(err => console.error('Không tải được sidebar.html:', err));
 
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
 
// ============================================================
// 2) TOPNAV TRONG TRANG MENU (Sửa món / Thêm món / Định mức)
//    Đoạn này chỉ có tác dụng trên trang Menu.html (có .topnav)
// ============================================================
const tabs = document.querySelectorAll('.topnav-item');
const panels = document.querySelectorAll('.tab-panel');
 
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
 
        tab.classList.add('active');
        const targetPanel = document.getElementById('panel-' + tab.dataset.action);
        if (targetPanel) targetPanel.classList.add('active');
    });
});