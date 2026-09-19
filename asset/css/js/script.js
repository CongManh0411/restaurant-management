// ============================================================
// 1) NẠP SIDEBAR DÙNG CHUNG TỪ sidebar.html
//    Mọi trang (Menu.html, Table.html, Revenue.html...) đều
//    chạy đoạn này để lấy sidebar giống nhau, không cần copy-paste.
// ============================================================
fetch('sidebar.html')
    .then(res => res.text())
    .then(html => {
        document.getElementById('sidebar-container').innerHTML = html;
        // Sau khi sidebar đã có trong trang, mới gắn sự kiện click cho nó
        initSidebarNav();
    })
    .catch(err => console.error('Không tải được sidebar.html:', err));

function initSidebarNav() {
    const sidebarTabs = document.querySelectorAll('.sidebar-menu .tab');
    const views = document.querySelectorAll('.view-panel');

    // Đánh dấu active đúng trang hiện tại, dựa vào <body data-page="...">
    const currentPage = document.body.dataset.page;
    sidebarTabs.forEach(tab => {
        if (tab.dataset.view === currentPage) {
            tab.classList.add('active');
        }
    });

    sidebarTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            sidebarTabs.forEach(t => t.classList.remove('active'));
            views.forEach(v => v.classList.remove('active'));

            tab.classList.add('active');
            const targetView = document.getElementById('view-' + tab.dataset.view);
            if (targetView) targetView.classList.add('active');
        });
    });
}

// ============================================================
// 2) TOPNAV TRONG TRANG MENU (Sửa món / Thêm món / Định mức)
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
