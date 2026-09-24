
/* =========================================
   1. DỮ LIỆU STATE (BẮT ĐẦU TẤT CẢ BÀN ĐỀU TRỐNG)
   ========================================== */
let tables = [
    { id: 1, name: "Bàn 01", status: "empty", time: "", total: 0, items: [] },
    { id: 2, name: "Bàn 02", status: "empty", time: "", total: 0, items: [] },
    { id: 3, name: "Bàn 03", status: "empty", time: "", total: 0, items: [] },
    { id: 4, name: "Bàn 04", status: "empty", time: "", total: 0, items: [] },
    { id: 5, name: "Bàn 05", status: "empty", time: "", total: 0, items: [] },
    { id: 6, name: "Bàn 06", status: "empty", time: "", total: 0, items: [] },
    { id: 7, name: "Bàn 07", status: "empty", time: "", total: 0, items: [] },
    { id: 8, name: "Bàn 08", status: "empty", time: "", total: 0, items: [] }
];
 
// ---- LƯU TRẠNG THÁI BÀN + ĐƠN CHỜ THANH TOÁN (localStorage) để trang Thanh toán đọc được ----
const TABLES_KEY = 'coffee_tables_v1';
const PENDING_KEY = 'coffee_pending_orders_v1';
(function loadSavedTables() {
    try { const s = JSON.parse(localStorage.getItem(TABLES_KEY)); if (Array.isArray(s)) tables = s; } catch (e) {} // cho phép danh sách rỗng: quản lý có thể xóa hết bàn
    // Chuẩn hóa dữ liệu cũ (trước khi có "Xác nhận"): bỏ trạng thái 'pending' (gộp về occupied),
    // đảm bảo mỗi món có lineId riêng + cờ confirmed để biết món nào đã khóa.
    tables.forEach(t => {
        if (t.status === 'pending') t.status = 'occupied';
        if (Array.isArray(t.items)) {
            t.items.forEach(i => {
                if (!i.lineId) i.lineId = genLineId();
                if (typeof i.confirmed !== 'boolean') i.confirmed = false;
            });
        }
    });
})();
function genLineId() { return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function saveTables() { try { localStorage.setItem(TABLES_KEY, JSON.stringify(tables)); } catch (e) {} }
function readPending() { try { return JSON.parse(localStorage.getItem(PENDING_KEY)) || []; } catch (e) { return []; } }
// Chỉ gửi cho Thu Ngân những món ĐÃ XÁC NHẬN (món nháp chưa xác nhận thì thu ngân chưa thấy)
function upsertPending(table) {
    const list = readPending().filter(o => o.tableId !== table.id);
    const confirmedItems = table.items.filter(i => i.confirmed);
    if (confirmedItems.length > 0) {
        list.push({ tableId: table.id, tableName: table.name, createdAt: new Date().toISOString(),
                    items: confirmedItems.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity })) });
    }
    try { localStorage.setItem(PENDING_KEY, JSON.stringify(list)); } catch (e) {}
}
 
const menuList = [
    { id: 1, name: "Cà Phê Sữa", category: "cafe", price: 30000, desc: "Cà phê đậm đà pha sữa đặc" },
    { id: 2, name: "Cafe Pha Phin", category: "cafe", price: 20000, desc: "Cà phê nguyên chất pha truyền thống" },
    { id: 3, name: "Bạc Xỉu", category: "cafe", price: 30000, desc: "Nhiều sữa ít cà phê thơm béo" },
    { id: 4, name: "Trà Đào", category: "tea", price: 30000, desc: "Trà đào thanh mát kèm miếng đào giòn" },
    { id: 5, name: "Trà Dâu Tằm", category: "tea", price: 30000, desc: "Trà trái cây chua ngọt dịu mát" },
    { id: 6, name: "Trà Sữa Full Topping", category: "milktea", price: 37000, desc: "Trân châu, thạch, phô mai" },
    { id: 7, name: "CoCa / Sting", category: "soft", price: 12000, desc: "Nước ngọt ướp lạnh" }
];
 
let selectedTableId = null;
let currentFilterCategory = "all";
let currentFilterTable = "all";
 
/* ==========================================
   2. KHỞI TẠO VÀ SIDEBAR (CÓ LOGO & NGUYỄN VĂN A)
   ========================================== */
document.addEventListener("DOMContentLoaded", function () {
    // renderSidebar() bo: dung sidebar chung cua web
    renderTablesGrid();
    renderMenuGrid();
    try { history.replaceState(null, ''); } catch (e) {}
});
 
// Nút Back của trình duyệt / điện thoại: đang ở màn gọi món thì quay về sơ đồ bàn (không rời trang)
window.addEventListener('popstate', function () {
    const menuView = document.getElementById('view-menu');
    if (menuView && menuView.classList.contains('active')) showTablesView();
});
 
// Quản lý thêm/sửa/xóa bàn hoặc thu ngân thanh toán ở tab khác -> nạp lại danh sách bàn
window.addEventListener('storage', function (e) {
    if (e.key !== TABLES_KEY) return;
    try { const s = JSON.parse(e.newValue); if (Array.isArray(s)) tables = s; } catch (err) { return; }
    if (selectedTableId && !tables.some(t => t.id === selectedTableId)) {
        alert('Bàn này vừa bị quản lý xóa. Quay lại sơ đồ bàn.');
        showTablesView();
        return;
    }
    renderTablesGrid();
    if (selectedTableId) {
        const menuView = document.getElementById('view-menu');
        if (menuView && menuView.classList.contains('active')) renderBillItems();
    }
});
 
function renderSidebar() {
    const sidebarContainer = document.getElementById('sidebar-container');
    if (sidebarContainer) {
        sidebarContainer.innerHTML = `
          <div class="sidebar">
            <div>
              <div class="sidebar-shop">
                <!-- Dùng link ảnh trực tuyến chuẩn -->
                <img src="1789716083932_1879050153056141676_1879050153056141676_9966c9be3f358047073be69d8b6d4485.jpg" alt="Coffee Logo" class="shop-logo">
              </div>
              <div class="sidebar-user">
                <div class="user-role">Nhân viên Phục vụ</div>
                <div class="user-name">Nguyễn Văn A</div>
                <div class="user-sub">Ca làm việc</div>
              </div>
              <div class="sidebar-menu">
                <button id="btn-view-tables" class="active" onclick="switchView('view-tables')">
                  <i class="fa-solid fa-utensils"></i> Sơ đồ bàn
                </button>
                <button id="btn-view-menu" onclick="switchView('view-menu')">
                  <i class="fa-solid fa-mug-hot"></i> Menu gọi món
                </button>
              </div>
            </div>
            <div class="sidebar-footer">
              <button class="logout-btn"><i class="fa-solid fa-right-from-bracket"></i> Đăng xuất</button>
            </div>
          </div>
        `;
    }
}
 
function switchView(viewId) {
    document.querySelectorAll('.view-panel').forEach(panel => panel.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
 
    document.querySelectorAll('.sidebar-menu button').forEach(btn => btn.classList.remove('active'));
    if (viewId === 'view-tables') document.getElementById('btn-view-tables')?.classList.add('active');
    if (viewId === 'view-menu') document.getElementById('btn-view-menu')?.classList.add('active');
}
 
/* ==========================================
   3. XỬ LÝ SƠ ĐỒ BÀN
   ========================================== */
function renderTablesGrid() {
    const grid = document.getElementById('tablesGrid');
    if (!grid) return;
 
    const filtered = tables.filter(t => currentFilterTable === 'all' || t.status === currentFilterTable);
 
    if (filtered.length === 0) {
        grid.innerHTML = `<div class="tables-empty">${tables.length === 0
            ? 'Chưa có bàn nào. Vui lòng liên hệ Quản lý để thêm bàn.'
            : 'Không có bàn nào ở trạng thái này.'}</div>`;
        return;
    }
 
    grid.innerHTML = filtered.map(t => {
        const statusText = t.status === 'occupied' ? "Đang phục vụ" : "Bàn trống";
 
        return `
            <div class="table-card ${t.status}" onclick="selectTable(${t.id})">
                <div class="table-card-name">${t.name}</div>
                <div class="table-card-status">${statusText}</div>
                ${t.time ? `<div class="table-card-time"><i class="fa-regular fa-clock"></i> Vào lúc: ${t.time}</div>` : ''}
            </div>
        `;
    }).join('');
}
 
function filterTables(status) {
    currentFilterTable = status;
    document.querySelectorAll('#view-tables .topnav-item').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    renderTablesGrid();
}
 
function selectTable(tableId) {
    selectedTableId = tableId;
    const table = tables.find(t => t.id === tableId);
 
    switchView('view-menu');
    try { history.pushState({ view: 'menu' }, ''); } catch (e) {} // để nút Back của trình duyệt cũng quay về sơ đồ bàn
 
    document.getElementById('no-table-warning').style.display = 'none';
    document.getElementById('order-screen').style.display = 'block';
 
    document.getElementById('currentTableTitle').innerText = table.name;
    document.getElementById('currentInvoiceId').innerText = `Mã HD: #HD-00${table.id}`;
 
    renderBillItems();
}
 
// ---- Quay lại sơ đồ bàn (nút "Quay lại sơ đồ bàn" ở màn gọi món) ----
function showTablesView() {
    selectedTableId = null;
    switchView('view-tables');
    renderTablesGrid(); // cập nhật trạng thái bàn vừa gọi món / báo thu ngân
}
 
function backToTables() {
    // Đã có mục history do selectTable đẩy vào -> history.back() sẽ kích hoạt popstate và gọi showTablesView()
    if (history.state && history.state.view === 'menu') history.back();
    else showTablesView();
}
 
/* ==========================================
   4. MENU DẠNG DÒNG ADMIN VÀ HÓA ĐƠN
   ========================================== */
function renderMenuGrid() {
    const grid = document.getElementById('menuGrid');
    if (!grid) return;
 
    const filtered = menuList.filter(m => currentFilterCategory === 'all' || m.category === currentFilterCategory);
 
    grid.innerHTML = filtered.map(m => `
        <div class="menu-item">
            <div class="menu-item-info">
                <div class="menu-item-name">${m.name}</div>
                <div class="menu-item-desc">${m.desc}</div>
            </div>
            <div class="menu-item-action">
                <span class="menu-item-price">${m.price.toLocaleString()} đ</span>
                <button class="btn-add-item" onclick="addToBill(${m.id})">+ Thêm</button>
            </div>
        </div>
    `).join('');
}
 
function filterCategory(cat) {
    currentFilterCategory = cat;
    document.querySelectorAll('#view-menu .topnav-item').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    renderMenuGrid();
}
 
function addToBill(menuId) {
    if (!selectedTableId) return alert("Vui lòng chọn bàn trước!");
 
    const table = tables.find(t => t.id === selectedTableId);
    const menuItem = menuList.find(m => m.id === menuId);
 
    if (table.status === 'empty') {
        table.status = 'occupied';
        const now = new Date();
        table.time = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
        renderTablesGrid();
    }
 
    // Chỉ cộng dồn vào dòng CÙNG món và CHƯA xác nhận. Món đã khóa (confirmed) luôn tạo dòng mới riêng.
    const existItem = table.items.find(i => i.id === menuId && !i.confirmed);
    if (existItem) {
        existItem.quantity++;
    } else {
        table.items.push({ lineId: genLineId(), id: menuItem.id, name: menuItem.name, price: menuItem.price, quantity: 1, confirmed: false });
    }
 
    saveTables();
    renderBillItems();
}
 
function updateQuantity(lineId, delta) {
    if (!selectedTableId) return;
    const table = tables.find(t => t.id === selectedTableId);
    const item = table.items.find(i => i.lineId === lineId);
    if (!item || item.confirmed) return; // món đã Xác nhận (khóa) thì không cho sửa +/- nữa
 
    item.quantity += delta;
    if (item.quantity <= 0) {
        table.items = table.items.filter(i => i.lineId !== lineId);
    }
    saveTables();
    renderBillItems();
}
 
function renderBillItems() {
    if (!selectedTableId) return;
    const table = tables.find(t => t.id === selectedTableId);
    const container = document.getElementById('billItems');
    const totalEl = document.getElementById('totalAmount');
    const actionsContainer = document.getElementById('billActions');
 
    if (table.items.length === 0) {
        container.innerHTML = `<div class="bill-empty">Chưa chọn món nào</div>`;
        totalEl.innerText = '0 đ';
        actionsContainer.innerHTML = `<button class="btn-submit" disabled>Xác nhận</button>`;
        return;
    }
 
    let total = 0;
    container.innerHTML = table.items.map(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        // Món đã Xác nhận: khóa +/-, chỉ hiện số lượng kèm icon khóa. Món nháp: vẫn sửa được như cũ.
        const qtyControl = item.confirmed
            ? `<span class="qty-locked" title="Đã gửi Thu Ngân, không sửa được nữa"><i class="fa-solid fa-lock"></i>${item.quantity}</span>`
            : `<div class="qty-control">
                    <button class="btn-qty" onclick="updateQuantity('${item.lineId}', -1)">-</button>
                    <span class="qty-value">${item.quantity}</span>
                    <button class="btn-qty" onclick="updateQuantity('${item.lineId}', 1)">+</button>
                </div>`;
        return `
            <div class="bill-item-row">
                <div>
                    <div class="bill-item-name">${item.name}${item.confirmed ? ' <span class="bill-item-tag">(đã gửi)</span>' : ''}</div>
                    <div class="bill-item-meta">${item.price.toLocaleString()} đ x ${item.quantity} = ${itemTotal.toLocaleString()} đ</div>
                </div>
                ${qtyControl}
            </div>
        `;
    }).join('');
 
    table.total = total;
    totalEl.innerText = `${total.toLocaleString()} đ`;
 
    // Còn món nháp (chưa xác nhận) thì mới cho bấm Xác nhận; không thì disable để tránh gửi rỗng.
    const hasUnconfirmed = table.items.some(i => !i.confirmed);
    actionsContainer.innerHTML = hasUnconfirmed
        ? `<button class="btn-submit" onclick="confirmOrder()">Xác nhận</button>`
        : `<button class="btn-submit" disabled>Xác nhận</button>`;
}
 
// Khóa toàn bộ món đang nháp lại và gửi (cập nhật) hóa đơn cho Thu Ngân
function confirmOrder() {
    if (!selectedTableId) return;
    const table = tables.find(t => t.id === selectedTableId);
    const unconfirmed = table.items.filter(i => !i.confirmed);
    if (unconfirmed.length === 0) return;
 
    unconfirmed.forEach(i => i.confirmed = true);
    upsertPending(table);
    saveTables();
    renderBillItems();
    alert(`Đã gửi món cho Thu Ngân - ${table.name}!`);
}
