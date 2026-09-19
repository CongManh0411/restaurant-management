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

// ============================================================
// 3) DỮ LIỆU MENU + RENDER DANH SÁCH MÓN (tab Sửa món)
//    Bây giờ dùng mảng cứng để demo giao diện.
//    Sau này chỉ cần sửa bên trong getMenuData() để gọi API thật,
//    toàn bộ phần render bên dưới không cần đổi gì.
//    Render dùng createElement thay vì innerHTML để an toàn hơn
//    (tránh lỗi XSS khi dữ liệu món có thể chứa ký tự đặc biệt).
// ============================================================

const sampleMenuData = [
    {
        category: "Cà phê",
        items: [
            { id: 1, name: "Cà phê sữa đá", desc: "Phin truyền thống", price: 29000, hasRecipe: false },
            { id: 2, name: "Cà phê đen đá", desc: "", price: 25000, hasRecipe: false },
            { id: 3, name: "Cà phê đen", desc: "", price: 25000, hasRecipe: false },
            
        ]
    },
    {
        category: "Trà sữa",
        items: [
            { id: 3, name: "Trà sữa trân châu", desc: "Trân châu đen", price: 35000, hasRecipe: false },
            { id: 4, name: "Trà sữa matcha", desc: "", price: 39000, hasRecipe: false },
        ]
    },
    {
        category: "Bánh",
        items: [
            { id: 5, name: "Bánh croissant", desc: "", price: 22000, hasRecipe: false },
        ]
    },
];

// Nơi duy nhất cần sửa khi có backend
async function getMenuData() {
    // ---- BẢN DEMO (chưa có backend) ----
    return sampleMenuData;

    // ---- BẢN CÓ BACKEND (bật lên khi đã có API) ----
    // const res = await fetch('/api/menu');
    // return await res.json();
}

function formatPrice(price) {
    return price.toLocaleString('vi-VN') + 'đ';
}

// Tạo 1 nút thao tác (Định mức / Ẩn / Xóa)
function createActionButton(className, action, id, text) {
    const btn = document.createElement('button');
    btn.className = className;
    btn.dataset.action = action;
    btn.dataset.id = id;
    btn.textContent = text;
    return btn;
}

// Tạo 1 dòng món (menu-item)
function createMenuItemEl(item) {
    const itemEl = document.createElement('div');
    itemEl.className = 'menu-item';
    itemEl.dataset.itemId = item.id;

    // ---- Cột trái: tên + mô tả ----
    const leftEl = document.createElement('div');

    const nameEl = document.createElement('div');
    nameEl.className = 'menu-item-name';
    nameEl.textContent = item.name;
    leftEl.appendChild(nameEl);

    if (item.desc) {
        const descEl = document.createElement('div');
        descEl.className = 'menu-item-desc';
        descEl.textContent = item.desc;
        leftEl.appendChild(descEl);
    }

    // ---- Cột phải: giá + badge + nút thao tác ----
    const rightEl = document.createElement('div');
    rightEl.className = 'menu-item-right';

    const priceEl = document.createElement('div');
    priceEl.className = 'menu-item-price';
    priceEl.textContent = formatPrice(item.price);
    rightEl.appendChild(priceEl);

    if (!item.hasRecipe) {
        const statusEl = document.createElement('div');
        statusEl.className = 'menu-item-status';
        statusEl.textContent = 'Chưa định mức';
        rightEl.appendChild(statusEl);
    }

    const actionsEl = document.createElement('div');
    actionsEl.className = 'menu-item-actions';
    actionsEl.appendChild(createActionButton('btn-outline', 'ingredient', item.id, 'Định mức'));
    actionsEl.appendChild(createActionButton('btn-outline', 'hide', item.id, 'Ẩn'));
    actionsEl.appendChild(createActionButton('btn-danger', 'delete', item.id, 'Xóa'));
    rightEl.appendChild(actionsEl);

    itemEl.appendChild(leftEl);
    itemEl.appendChild(rightEl);

    return itemEl;
}

// Tạo 1 khối danh mục (menu-category) gồm tiêu đề + các món bên trong
function createCategoryEl(category) {
    const categoryEl = document.createElement('div');
    categoryEl.className = 'menu-category';

    const titleEl = document.createElement('h3');
    titleEl.textContent = category.category;
    categoryEl.appendChild(titleEl);

    category.items.forEach(item => {
        categoryEl.appendChild(createMenuItemEl(item));
    });

    return categoryEl;
}

function renderMenu(data) {
    const container = document.getElementById('menuCategoryList');
    container.innerHTML = ''; // chỉ dùng để xóa nội dung cũ, không chèn HTML mới

    if (!data || data.length === 0) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'menu-empty-state';
        emptyEl.textContent = 'Chưa có món nào. Vào tab "Thêm món" để bắt đầu.';
        container.appendChild(emptyEl);
        return;
    }

    data.forEach(category => {
        container.appendChild(createCategoryEl(category));
    });

    attachMenuItemEvents();
}

function attachMenuItemEvents() {
    document.querySelectorAll('#menuCategoryList button[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            const id = btn.dataset.id;

            if (action === 'delete') {
                // Sau này: fetch(`/api/menu/${id}`, { method: 'DELETE' })
                console.log('Xóa món id =', id);
            } else if (action === 'hide') {
                // Sau này: fetch(`/api/menu/${id}/hide`, { method: 'PATCH' })
                console.log('Ẩn/hiện món id =', id);
            } else if (action === 'ingredient') {
                document.querySelector('.topnav-item[data-action="ingredients"]').click();
                console.log('Khai báo định mức cho món id =', id);
            }
        });
    });
}

// Gọi khi trang load
getMenuData().then(renderMenu);