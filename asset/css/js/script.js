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
// 0) LỚP DỮ LIỆU "AuthAPI" / "UserAPI" — NƠI DUY NHẤT CẦN SỬA
//    KHI CÓ BACKEND (giống cách MenuAPI đang làm cho phần menu)
// ============================================================
const AuthAPI = {
    async logout() {
        // ---- BẢN DEMO ----
        console.log('Đăng xuất (demo) — chưa có backend nên chỉ quay về trang đăng nhập.');
        window.location.href = 'Login.html'; // đổi lại đúng tên file trang đăng nhập của bạn nếu khác
 
        // ---- BẢN BACKEND ----
        // const res = await fetch('/api/auth/logout', { method: 'POST' });
        // if (!res.ok) throw new Error('Đăng xuất thất bại');
        // localStorage.removeItem('token'); // hoặc xoá cookie phiên đăng nhập tuỳ cách bạn lưu
        // window.location.href = 'Login.html';
    },
};
 
// Thông tin hiển thị trên sidebar: logo quán + tên/chức vụ người đang đăng nhập
const UserAPI = {
    async getProfile() {
        // ---- BẢN DEMO ----
        return {
            shopLogoUrl: 'asset/images.jpg',
            name: 'Nguyễn Văn A',
            role: 'Nhân viên phục vụ',
        };
 
        // ---- BẢN BACKEND ----
        // const res = await fetch('/api/me'); // hoặc /api/auth/me tuỳ backend đặt tên
        // if (!res.ok) throw new Error('Không tải được thông tin người dùng');
        // return await res.json(); // kỳ vọng trả về { shopLogoUrl, name, role }
    },
};
 
fetch('sidebar.html')
    .then(res => res.text())
    .then(html => {
        document.getElementById('sidebar-container').innerHTML = html;
        // Sau khi sidebar đã có trong trang, đánh dấu đúng mục đang active
        initSidebarNav();
        initSidebarLogout();
        initSidebarProfile();
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
        const profile = await UserAPI.getProfile();
        if (logoEl && profile.shopLogoUrl) logoEl.src = profile.shopLogoUrl;
        if (nameEl && profile.name) nameEl.textContent = profile.name;
        if (roleEl && profile.role) roleEl.textContent = profile.role;
    } catch (err) {
        console.error('Không tải được thông tin người dùng:', err);
        // Giữ nguyên "Tên"/"Chức vụ" mặc định trong HTML nếu lỗi
    }
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
 
        // Mỗi lần chuyển sang tab "Thêm món" đều về chế độ thêm mới mặc định;
        // openEditItemForm() sẽ tự đổ lại dữ liệu sửa ngay sau lệnh click này.
        if (tab.dataset.action === 'add' && typeof resetAddFormToAddMode === 'function') {
            resetAddFormToAddMode();
        }
    });
});
 
// ============================================================
// 3) LỚP DỮ LIỆU "MenuAPI" — NƠI DUY NHẤT CẦN SỬA KHI CÓ BACKEND
//    ------------------------------------------------------------
//    Toàn bộ phần giao diện bên dưới (render, sự kiện click...) chỉ
//    gọi các hàm của MenuAPI, không đụng trực tiếp vào mảng dữ liệu.
//    Vì vậy khi có backend thật, bạn chỉ cần vào ĐÚNG các hàm trong
//    object này, xoá phần "BẢN DEMO", mở comment phần "BẢN BACKEND"
//    (đã viết sẵn fetch mẫu cho từng hàm) — không phải sửa gì ở
//    phần render/UI phía dưới.
// ============================================================
 
// ---- LƯU DỮ LIỆU DEMO VÀO localStorage ----
// Vì các trang chuyển bằng <a href> (load lại trang thật), biến JS thường sẽ
// mất dữ liệu khi rời trang Menu. 3 hàm dưới đây giúp dữ liệu demo (món đã
// thêm/sửa/xoá, công thức đã lưu) được giữ lại khi quay lại trang Menu.
// Khi có backend thật, phần này không còn cần thiết nữa — có thể xoá cả khối.
const MENU_STORAGE_KEY = 'coffee_menu_data_v1';
const RECIPE_STORAGE_KEY = 'coffee_menu_recipes_v1';
const NEXT_ID_STORAGE_KEY = 'coffee_menu_next_id_v1';
 
function loadFromStorage(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
        console.error(`Không đọc được dữ liệu demo (${key}):`, err);
        return fallback;
    }
}
 
function saveToStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
        console.error(`Không lưu được dữ liệu demo (${key}):`, err);
    }
}
 
function persistMenuData() {
    saveToStorage(MENU_STORAGE_KEY, sampleMenuData);
    saveToStorage(NEXT_ID_STORAGE_KEY, sampleNextId);
}
 
function persistRecipes() {
    saveToStorage(RECIPE_STORAGE_KEY, sampleRecipes);
}
 
// Dữ liệu demo mặc định — chỉ dùng lần đầu tiên (khi localStorage còn trống).
// Khi có backend thì xoá cả defaultMenuData lẫn 3 biến sampleMenuData/sampleNextId/sampleRecipes.
const defaultMenuData = [
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
            { id: 4, name: "Trà sữa trân châu", desc: "Trân châu đen", price: 35000, hasRecipe: false },
            { id: 5, name: "Trà sữa matcha", desc: "", price: 39000, hasRecipe: false },
        ]
    },
    {
        category: "Bánh",
        items: [
            { id: 6, name: "Bánh croissant", desc: "", price: 22000, hasRecipe: false },
        ]
    },
];
 
const sampleMenuData = loadFromStorage(MENU_STORAGE_KEY, defaultMenuData);
let sampleNextId = loadFromStorage(NEXT_ID_STORAGE_KEY, 7); // dùng để demo tạo id mới khi Thêm món (không cần khi có backend, server sẽ tự sinh id)
const sampleRecipes = loadFromStorage(RECIPE_STORAGE_KEY, {}); // { [itemId]: [{ name, qty, unit }, ...] } — kho công thức demo
 
const MenuAPI = {
    // Lấy toàn bộ danh mục + món
    async getMenu() {
        // ---- BẢN DEMO ----
        return JSON.parse(JSON.stringify(sampleMenuData));
 
        // ---- BẢN BACKEND ----
        // const res = await fetch('/api/menu');
        // if (!res.ok) throw new Error('Không tải được menu');
        // return await res.json();
    },
 
    // Thêm món mới. payload = { category, newCategory, name, price }
    async addItem(payload) {
        // ---- BẢN DEMO ----
        const categoryName = payload.newCategory || payload.category;
        const newItem = {
            id: sampleNextId++,
            name: payload.name,
            desc: '',
            price: Number(payload.price) || 0,
            hasRecipe: false,
        };
        let categoryObj = sampleMenuData.find(c => c.category === categoryName);
        if (!categoryObj) {
            categoryObj = { category: categoryName, items: [] };
            sampleMenuData.push(categoryObj);
        }
        categoryObj.items.push(newItem);
        persistMenuData();
        return newItem;
 
        // ---- BẢN BACKEND ----
        // const res = await fetch('/api/menu', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(payload),
        // });
        // if (!res.ok) throw new Error('Không thêm được món');
        // return await res.json();
    },
 
    // Sửa món đã có. id = id món cần sửa, payload = { category, newCategory, name, price }
    async updateItem(id, payload) {
        // ---- BẢN DEMO ----
        let target = null;
        let oldCategoryObj = null;
        sampleMenuData.forEach(cat => {
            const found = cat.items.find(it => String(it.id) === String(id));
            if (found) {
                target = found;
                oldCategoryObj = cat;
            }
        });
        if (!target) throw new Error('Không tìm thấy món để sửa');
 
        target.name = payload.name;
        target.price = Number(payload.price) || 0;
 
        // Nếu người dùng đổi sang danh mục khác (hoặc gõ danh mục mới) thì chuyển món sang danh mục đó
        const categoryName = payload.newCategory || payload.category;
        if (categoryName && oldCategoryObj && categoryName !== oldCategoryObj.category) {
            oldCategoryObj.items = oldCategoryObj.items.filter(it => it !== target);
            let newCategoryObj = sampleMenuData.find(c => c.category === categoryName);
            if (!newCategoryObj) {
                newCategoryObj = { category: categoryName, items: [] };
                sampleMenuData.push(newCategoryObj);
            }
            newCategoryObj.items.push(target);
            // Xoá danh mục cũ nếu không còn món nào
            for (let i = sampleMenuData.length - 1; i >= 0; i--) {
                if (sampleMenuData[i].items.length === 0) sampleMenuData.splice(i, 1);
            }
        }
 
        persistMenuData();
        return target;
 
        // ---- BẢN BACKEND ----
        // const res = await fetch(`/api/menu/${id}`, {
        //     method: 'PUT',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(payload),
        // });
        // if (!res.ok) throw new Error('Không sửa được món');
        // return await res.json();
    },
 
    // Xoá món theo id
    async deleteItem(id) {
        // ---- BẢN DEMO ----
        sampleMenuData.forEach(cat => {
            cat.items = cat.items.filter(it => String(it.id) !== String(id));
        });
        delete sampleRecipes[id];
        persistMenuData();
        persistRecipes();
        return true;
 
        // ---- BẢN BACKEND ----
        // const res = await fetch(`/api/menu/${id}`, { method: 'DELETE' });
        // if (!res.ok) throw new Error('Không xoá được món');
        // return true;
    },
 
    // Ẩn/hiện món theo id
    async toggleHideItem(id) {
        // ---- BẢN DEMO ----
        let target = null;
        sampleMenuData.forEach(cat => {
            const found = cat.items.find(it => String(it.id) === String(id));
            if (found) target = found;
        });
        if (target) target.hidden = !target.hidden;
        persistMenuData();
        return target;
 
        // ---- BẢN BACKEND ----
        // const res = await fetch(`/api/menu/${id}/hide`, { method: 'PATCH' });
        // if (!res.ok) throw new Error('Không cập nhật được trạng thái ẩn/hiện');
        // return await res.json();
    },
 
    // Lấy công thức (định mức nguyên liệu) của 1 món
    async getRecipe(id) {
        // ---- BẢN DEMO ----
        return sampleRecipes[id] ? JSON.parse(JSON.stringify(sampleRecipes[id])) : [];
 
        // ---- BẢN BACKEND ----
        // const res = await fetch(`/api/menu/${id}/recipe`);
        // if (!res.ok) throw new Error('Không tải được công thức');
        // return await res.json();
    },
 
    // Lưu công thức (định mức nguyên liệu) của 1 món. rows = [{ name, qty, unit }, ...]
    async saveRecipe(id, rows) {
        // ---- BẢN DEMO ----
        sampleRecipes[id] = rows;
        let target = null;
        sampleMenuData.forEach(cat => {
            const found = cat.items.find(it => String(it.id) === String(id));
            if (found) target = found;
        });
        const hasData = rows.length > 0 && rows.every(r => r.name && r.qty && r.unit);
        if (target) target.hasRecipe = hasData;
        persistRecipes();
        persistMenuData();
        return true;
 
        // ---- BẢN BACKEND ----
        // const res = await fetch(`/api/menu/${id}/recipe`, {
        //     method: 'PUT',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(rows),
        // });
        // if (!res.ok) throw new Error('Không lưu được công thức');
        // return true;
    },
};
 
// ============================================================
// 4) RENDER DANH SÁCH MÓN (tab Sửa món)
//    Render dùng createElement thay vì innerHTML để an toàn hơn
//    (tránh lỗi XSS khi dữ liệu món có thể chứa ký tự đặc biệt).
// ============================================================
 
let currentMenuData = []; // cache dữ liệu menu đang hiển thị, dùng chung cho tab Sửa món + Định mức
 
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
    actionsEl.appendChild(createActionButton('btn-outline', 'edit', item.id, 'Sửa'));
    actionsEl.appendChild(createActionButton('btn-outline', 'ingredient', item.id, 'Định mức'));
    actionsEl.appendChild(createActionButton('btn-outline', 'hide', item.id, item.hidden ? 'Hiện' : 'Ẩn'));
    actionsEl.appendChild(createActionButton('btn-danger', 'delete', item.id, 'Xóa'));
    rightEl.appendChild(actionsEl);
 
    itemEl.appendChild(leftEl);
    itemEl.appendChild(rightEl);
 
    if (item.hidden) itemEl.style.opacity = '0.5';
 
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
    if (!container) return;
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
 
// Tải lại menu từ MenuAPI và render lại cả tab Sửa món + dropdown tab Định mức
async function reloadMenu() {
    const container = document.getElementById('menuCategoryList');
    if (!container) return; // trang này không có bảng menu (không phải Menu.html)
 
    // Hiện trạng thái "đang tải" thay vì để trống trong lúc chờ dữ liệu
    container.innerHTML = '';
    const loadingEl = document.createElement('div');
    loadingEl.className = 'menu-loading';
    loadingEl.textContent = 'Đang tải menu...';
    container.appendChild(loadingEl);
 
    try {
        currentMenuData = await MenuAPI.getMenu();
        renderMenu(currentMenuData);
        populateCategorySelect();
        await refreshRecipeItemOptions();
    } catch (err) {
        console.error('Không tải được menu:', err);
        container.innerHTML = '';
        const errorEl = document.createElement('div');
        errorEl.className = 'menu-error-state';
        errorEl.textContent = 'Không tải được menu. Vui lòng tải lại trang.';
        container.appendChild(errorEl);
    }
}
 
function attachMenuItemEvents() {
    document.querySelectorAll('#menuCategoryList button[data-action]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const action = btn.dataset.action;
            const id = btn.dataset.id;
 
            if (action === 'delete') {
                if (!confirm('Xoá món này?')) return;
                await MenuAPI.deleteItem(id);
                await reloadMenu();
            } else if (action === 'hide') {
                await MenuAPI.toggleHideItem(id);
                await reloadMenu();
            } else if (action === 'ingredient') {
                document.querySelector('.topnav-item[data-action="ingredients"]').click();
                await selectRecipeItem(id);
            } else if (action === 'edit') {
                openEditItemForm(id);
            }
        });
    });
}
 
// ============================================================
// 5) FORM "THÊM MÓN"
// ============================================================
 
const addItemFormEl = document.querySelector('.add-item-form');
const itemCategorySelectEl = document.getElementById('itemCategory');
 
// Đổ danh mục hiện có vào <select> của form Thêm món
function populateCategorySelect() {
    if (!itemCategorySelectEl) return;
    const categories = currentMenuData.map(c => c.category);
    itemCategorySelectEl.innerHTML =
        '<option value="">-- Chọn danh mục --</option>' +
        categories.map(c => `<option value="${c}">${c}</option>`).join('');
}
 
// Đưa form về chế độ "Thêm món" mặc định (xoá id đang sửa, đổi lại tiêu đề/nút)
function resetAddFormToAddMode() {
    if (!addItemFormEl) return;
    addItemFormEl.reset();
    const editIdInput = document.getElementById('editItemId');
    if (editIdInput) editIdInput.value = '';
    const headerH2 = document.querySelector('#panel-add .menu-page-header h2');
    if (headerH2) headerH2.textContent = 'Thêm món mới';
    const submitBtn = addItemFormEl.querySelector('.btn-submit');
    if (submitBtn) submitBtn.textContent = 'Thêm món + danh mục (nếu có)';
}
 
// Mở tab "Thêm món" ở chế độ Sửa, đổ sẵn dữ liệu món đang chọn vào form
function openEditItemForm(id) {
    if (!addItemFormEl) return;
    const item = getFlatMenuItems().find(it => String(it.id) === String(id));
    if (!item) return;
 
    document.querySelector('.topnav-item[data-action="add"]').click(); // sẽ tự gọi resetAddFormToAddMode()
 
    const editIdInput = document.getElementById('editItemId');
    if (editIdInput) editIdInput.value = item.id;
    if (itemCategorySelectEl) itemCategorySelectEl.value = item.category;
    document.getElementById('itemPrice').value = item.price;
    document.getElementById('itemName').value = item.name;
 
    const headerH2 = document.querySelector('#panel-add .menu-page-header h2');
    if (headerH2) headerH2.textContent = 'Sửa món';
    const submitBtn = addItemFormEl.querySelector('.btn-submit');
    if (submitBtn) submitBtn.textContent = 'Lưu thay đổi';
}
 
if (addItemFormEl) {
    addItemFormEl.addEventListener('submit', async (e) => {
        e.preventDefault();
 
        const editId = document.getElementById('editItemId') ? document.getElementById('editItemId').value : '';
        const category = itemCategorySelectEl.value;
        const newCategory = document.getElementById('newCategory').value.trim();
        const price = document.getElementById('itemPrice').value;
        const name = document.getElementById('itemName').value.trim();
 
        if (!name || !price || (!category && !newCategory)) {
            alert('Vui lòng nhập tên món, giá và chọn (hoặc tạo) danh mục.');
            return;
        }
 
        try {
            if (editId) {
                await MenuAPI.updateItem(editId, { category, newCategory, name, price });
            } else {
                await MenuAPI.addItem({ category, newCategory, name, price });
            }
            resetAddFormToAddMode();
            await reloadMenu();
            document.querySelector('.topnav-item[data-action="edit"]').click();
        } catch (err) {
            console.error('Không lưu được món:', err);
            alert('Có lỗi xảy ra, không lưu được món. Vui lòng thử lại.');
        }
    });
}
 
// ============================================================
// 6) TAB "ĐỊNH MỨC NGUYÊN LIỆU"
//    - Đổ danh sách món (từ currentMenuData) vào <select>
//    - Nguyên liệu của món đang chọn lấy qua MenuAPI.getRecipe()
//    - Lưu qua MenuAPI.saveRecipe()
// ============================================================
 
const recipeSelectEl = document.getElementById('recipeItemSelect');
const ingredientListEl = document.getElementById('ingredientList');
const recipeStatusEl = document.getElementById('recipeStatus');
const btnAddIngredientEl = document.getElementById('btnAddIngredient');
const btnSaveRecipeEl = document.getElementById('btnSaveRecipe');
 
let activeRecipeRows = []; // nguyên liệu (chưa lưu) của món đang chọn trên form
 
// Lấy toàn bộ món (mọi danh mục) thành 1 mảng phẳng cho <select>
function getFlatMenuItems() {
    const flat = [];
    currentMenuData.forEach(category => {
        category.items.forEach(item => {
            flat.push({ ...item, category: category.category });
        });
    });
    return flat;
}
 
function initIngredientsPanel() {
    if (!recipeSelectEl) return; // panel chưa có trong trang này
 
    recipeSelectEl.addEventListener('change', () => {
        selectRecipeItem(recipeSelectEl.value);
    });
 
    btnAddIngredientEl.addEventListener('click', () => {
        if (!recipeSelectEl.value) return;
        addIngredientRow();
    });
 
    btnSaveRecipeEl.addEventListener('click', () => {
        if (!recipeSelectEl.value) return;
        saveRecipe(recipeSelectEl.value);
    });
}
 
// Đổ lại danh sách món vào <select> của tab Định mức (gọi mỗi khi menu thay đổi)
async function refreshRecipeItemOptions() {
    if (!recipeSelectEl) return;
    const items = getFlatMenuItems();
    const keepSelected = recipeSelectEl.value;
 
    recipeSelectEl.innerHTML = items
        .map(item => `<option value="${item.id}">${item.name}</option>`)
        .join('');
 
    if (!items.length) return;
 
    const stillExists = items.some(it => String(it.id) === String(keepSelected));
    const targetId = stillExists ? keepSelected : items[0].id;
    recipeSelectEl.value = targetId;
    await selectRecipeItem(targetId);
}
 
// Chọn 1 món trong dropdown + tải công thức của món đó từ MenuAPI
async function selectRecipeItem(id) {
    if (!recipeSelectEl) return;
    recipeSelectEl.value = id;
    activeRecipeRows = await MenuAPI.getRecipe(id);
    renderIngredientList();
}
 
// Tạo 1 input trong dòng nguyên liệu (tên / định lượng / đơn vị)
function createIngredientInput(className, type, value, placeholder) {
    const input = document.createElement('input');
    input.className = className;
    input.type = type;
    input.value = value;
    input.placeholder = placeholder;
    return input;
}
 
// Tạo 1 dòng nguyên liệu (ingredient-row)
function createIngredientRowEl(row, index) {
    const rowEl = document.createElement('div');
    rowEl.className = 'ingredient-row';
    rowEl.dataset.index = index;
 
    const nameInput = createIngredientInput('ing-name', 'text', row.name, 'Tên nguyên liệu');
    const qtyInput = createIngredientInput('ing-qty', 'number', row.qty, 'Định lượng');
    const unitInput = createIngredientInput('ing-unit', 'text', row.unit, 'Đơn vị (g, ml, phần...)');
 
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-remove';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => removeIngredientRow(index));
 
    rowEl.appendChild(nameInput);
    rowEl.appendChild(qtyInput);
    rowEl.appendChild(unitInput);
    rowEl.appendChild(removeBtn);
 
    return rowEl;
}
 
function renderIngredientList() {
    ingredientListEl.innerHTML = ''; // chỉ dùng để xóa nội dung cũ, không chèn HTML mới
 
    if (!activeRecipeRows.length) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'ingredient-empty';
        emptyEl.textContent = 'Chưa có nguyên liệu nào cho món này.';
        ingredientListEl.appendChild(emptyEl);
    } else {
        activeRecipeRows.forEach((row, i) => {
            ingredientListEl.appendChild(createIngredientRowEl(row, i));
        });
    }
 
    updateRecipeStatus();
}
 
function addIngredientRow() {
    activeRecipeRows.push({ name: '', qty: '', unit: '' });
    renderIngredientList();
}
 
function removeIngredientRow(index) {
    activeRecipeRows.splice(index, 1);
    renderIngredientList();
}
 
// Đọc lại giá trị hiện tại trên form (người dùng có thể vừa gõ, chưa lưu)
function readIngredientRowsFromDOM() {
    return Array.from(ingredientListEl.querySelectorAll('.ingredient-row')).map(row => ({
        name: row.querySelector('.ing-name').value.trim(),
        qty: row.querySelector('.ing-qty').value.trim(),
        unit: row.querySelector('.ing-unit').value.trim(),
    }));
}
 
function updateRecipeStatus() {
    const hasData = activeRecipeRows.length > 0 && activeRecipeRows.every(r => r.name && r.qty && r.unit);
    recipeStatusEl.textContent = hasData ? 'Đã định mức' : 'Chưa định mức';
    recipeStatusEl.classList.toggle('done', hasData);
}
 
async function saveRecipe(itemId) {
    activeRecipeRows = readIngredientRowsFromDOM();
    await MenuAPI.saveRecipe(itemId, activeRecipeRows);
    updateRecipeStatus();
 
    // Đồng bộ badge "Chưa định mức" ở tab Sửa món (không rời khỏi tab Định mức)
    currentMenuData = await MenuAPI.getMenu();
    renderMenu(currentMenuData);
 
    alert('Đã lưu công thức món!');
}
 
// ============================================================
// 8) TÌM KIẾM MÓN (tab "Sửa món")
// ============================================================
 
// Lọc dữ liệu menu theo tên món (không phân biệt hoa/thường), giữ nguyên cấu trúc danh mục
function filterMenuData(data, keyword) {
    if (!keyword) return data;
    const lowerKeyword = keyword.trim().toLowerCase();
    if (!lowerKeyword) return data;
    return data
        .map(cat => ({
            category: cat.category,
            items: cat.items.filter(it => it.name.toLowerCase().includes(lowerKeyword)),
        }))
        .filter(cat => cat.items.length > 0);
}
 
function initMenuSearch() {
    const searchInput = document.getElementById('menuSearchInput');
    if (!searchInput) return; // trang này không có ô tìm kiếm (không phải Menu.html)
 
    searchInput.addEventListener('input', () => {
        const filtered = filterMenuData(currentMenuData, searchInput.value);
        renderMenu(filtered);
    });
}
 
// ============================================================
// 9) KHỞI ĐỘNG TRANG
// ============================================================
initIngredientsPanel();
initMenuSearch();
reloadMenu();