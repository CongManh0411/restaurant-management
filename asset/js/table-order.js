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
 
// ---- LƯU TRẠNG THÁI BÀN (localStorage) để trang Bếp, Thông báo và Thanh toán của Phục vụ đọc được ----
const TABLES_KEY = 'coffee_tables_v1';
// Trạng thái món do BẾP điều khiển (trang Kitchen.html): mỗi món đã xác nhận có kStatus = 'waiting' | 'making' | 'done'
// (kèm startedAt / doneAt). Không còn giả lập theo giờ nữa.
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
 
// ---- MENU: đọc từ trang Menu của Quản lý (cùng key 'coffee_menu_data_v1' với menu.js) ----
// Món Quản lý thêm/sửa/ẩn/xóa ở Menu.html sẽ hiện ngay ở đây. Món bị ẩn không hiện để gọi.
// MENU_KEY, DEFAULT_MENU, itemImage, OPTION_CONFIG: lấy từ menu-data.js
const escHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function loadMenuList() {
    let data = DEFAULT_MENU;
    try { const raw = JSON.parse(localStorage.getItem(MENU_KEY)); if (Array.isArray(raw)) data = raw; } catch (e) {}
    const out = [];
    data.forEach(cat => (cat.items || []).forEach(it => {
        if (it.hidden) return;
        out.push({ id: it.id, name: it.name, category: cat.category, price: Number(it.price) || 0, desc: it.desc || '', img: it.img || '' });
    }));
    return out;
}
let menuList = loadMenuList();
 
let selectedTableId = null;
let currentFilterCategory = "all";
let currentFilterTable = "all";
 
/* ==========================================
   2. KHỞI TẠO VÀ SIDEBAR (CÓ LOGO & NGUYỄN VĂN A)
   ========================================== */
document.addEventListener("DOMContentLoaded", function () {
    // renderSidebar() bo: dung sidebar chung cua web
    renderTablesGrid();
    renderCategoryTabs();
    renderMenuGrid();
    document.getElementById('categoryTabs').addEventListener('click', function (e) {
        const b = e.target.closest('[data-cat]');
        if (!b) return;
        currentFilterCategory = b.dataset.cat;
        renderCategoryTabs();
        renderMenuGrid();
    });
    try { history.replaceState(null, ''); } catch (e) {}
});
 
// Nút Back của trình duyệt / điện thoại: đang ở màn gọi món thì quay về sơ đồ bàn (không rời trang)
window.addEventListener('popstate', function () {
    const menuView = document.getElementById('view-menu');
    if (menuView && menuView.classList.contains('active')) showTablesView();
});
 
// Quản lý sửa menu ở tab khác -> nạp lại danh sách món + danh mục
window.addEventListener('storage', function (e) {
    if (e.key !== MENU_KEY) return;
    menuList = loadMenuList();
    renderCategoryTabs();
    renderMenuGrid();
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
                  <i class="fa-solid fa-mug-hot"></i> Thực đơn gọi món
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
 
    const filtered = tables.filter(t => currentFilterTable === 'all' || (currentFilterTable === 'togo' ? !!t.type : (t.status === currentFilterTable && !t.type)));
 
    if (filtered.length === 0) {
        grid.innerHTML = `<div class="tables-empty">${tables.length === 0
            ? 'Chưa có bàn nào. Vui lòng liên hệ Quản lý để thêm bàn.'
            : 'Không có bàn nào ở trạng thái này.'}</div>`;
        return;
    }
 
    grid.innerHTML = filtered.map(t => {
        const statusText = t.status === 'occupied' ? "Đang phục vụ" : "Bàn trống";
        const typeLine = t.type === 'delivery'
            ? `<div class="table-card-time"><i class="fa-solid fa-motorcycle"></i> ${escHtml(t.customer || 'Giao hàng')}${t.address ? ' — ' + escHtml(t.address) : ''}</div>`
            : (t.type === 'takeaway' ? '<div class="table-card-time"><i class="fa-solid fa-bag-shopping"></i> Mang đi</div>' : '');
 
        return `
            <div class="table-card ${t.status} ${t.type ? 'togo' : ''}" onclick="selectTable(${t.id})">
                <div class="table-card-name">${escHtml(t.name)}</div>
                ${typeLine}
                <div class="table-card-status">${statusText}</div>
                ${t.time ? `<div class="table-card-time"><i class="fa-regular fa-clock"></i> Vào lúc: ${t.time}</div>` : ''}
            </div>
        `;
    }).join('');
}
 
function filterTables(status) {
    currentFilterTable = status;
    document.querySelectorAll('#view-tables .topnav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.status === status));
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
    document.getElementById('currentInvoiceId').innerText = table.type ? (table.type === 'delivery' ? 'Giao hàng' : 'Mang đi') : `Mã HD: #HD-00${table.id}`;
 
    renderBillItems();
}
 
// ---- Quay lại sơ đồ bàn (nút "Quay lại sơ đồ bàn" ở màn gọi món) ----
function showTablesView() {
    // Đơn mang đi / giao hàng chưa có món nào -> bỏ luôn, khỏi để lại đơn rỗng
    const cur = tables.find(t => t.id === selectedTableId);
    if (cur && cur.type && !(cur.items || []).length) { tables = tables.filter(t => t !== cur); saveTables(); }
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
let orderSearchKw = '';
const normVN = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
function renderMenuGrid() {
    const grid = document.getElementById('menuGrid');
    if (!grid) return;
    const kw = normVN(orderSearchKw.trim());
    const filtered = menuList.filter(m => (currentFilterCategory === 'all' || m.category === currentFilterCategory)
        && (!kw || normVN(m.name + ' ' + m.desc + ' ' + m.category).includes(kw)));
    if (!filtered.length) { grid.innerHTML = '<div class="menu-empty-state">' + (kw ? 'Không tìm thấy món phù hợp.' : 'Chưa có món nào trong danh mục này. Liên hệ Quản lý để thêm món.') + '</div>'; return; }
    grid.innerHTML = filtered.map(m => `
        <div class="menu-item">
            <img class="menu-item-img" src="${itemImage(m, m.category)}" alt="${escHtml(m.name)}">
            <div class="menu-item-info">
                <div class="menu-item-name">${escHtml(m.name)}</div>
                <div class="menu-item-desc">${escHtml(m.category)}${m.desc ? ' · ' + escHtml(m.desc) : ''}</div>
            </div>
            <div class="menu-item-action">
                <span class="menu-item-price">${m.price.toLocaleString()} đ</span>
                ${isSoldOut(m.id) ? '<span class="soldout-tag">Hết hàng</span>' : `<button class="btn-add-item" onclick="addToBill(${m.id})">+ Thêm</button>`}
                ${isCashierRole() ? `<button type="button" class="btn-soldout" onclick="toggleSoldOut(${m.id})">${isSoldOut(m.id) ? 'Bán lại' : 'Báo hết'}</button>` : ''}
            </div>
        </div>
    `).join('');
}
document.addEventListener('input', e => { if (e.target.id === 'orderSearchInput') { orderSearchKw = e.target.value; renderMenuGrid(); } });

// Vẽ các nút danh mục theo menu thật (thay cho 4 nút cố định trước đây)
function renderCategoryTabs() {
    const box = document.getElementById('categoryTabs');
    if (!box) return;
    const cats = [...new Set(menuList.map(m => m.category))];
    if (currentFilterCategory !== 'all' && !cats.includes(currentFilterCategory)) currentFilterCategory = 'all';
    box.innerHTML = [['all', 'Tất cả']].concat(cats.map(c => [c, c])).map(([v, l]) =>
        `<button type="button" class="topnav-item ${v === currentFilterCategory ? 'active' : ''}" data-cat="${escHtml(v)}">${escHtml(l)}</button>`).join('');
}
 
function addToBill(menuId) {
    const mi = menuList.find(m => m.id === menuId);
    if (mi && !NO_OPTION_CATEGORIES.includes(mi.category) && selectedTableId && !isSoldOut(menuId)) return openOptionPopup(mi);
    addLineToBill(menuId, null);
}

// ---- POPUP TÙY CHỌN: Size / Đường / Đá / Topping / Ghi chú ----
let optState = null;
function optPrice() { const o = optState.o; return optState.m.price + OPTION_CONFIG.size.find(x => x.v === o.size).add + o.toppings.reduce((t, n) => t + OPTION_CONFIG.toppings.find(x => x.v === n).add, 0); }
function openOptionPopup(m) {
    optState = { m, o: { size: 'M', sugar: '50%', ice: 'Ít đá', toppings: [] } };
    let ov = document.getElementById('optOverlay');
    if (!ov) { ov = document.createElement('div'); ov.id = 'optOverlay'; ov.className = 'opt-overlay'; document.body.appendChild(ov); }
    ov.onclick = e => { if (e.target === ov) closeOptionPopup(); };
    drawOptionPopup(); ov.style.display = 'flex';
}
function closeOptionPopup() { const ov = document.getElementById('optOverlay'); if (ov) ov.style.display = 'none'; optState = null; }
function drawOptionPopup() {
    const { m, o } = optState, C = OPTION_CONFIG;
    const chip = (k, v, label, on) => `<button type="button" class="opt-chip ${on ? 'on' : ''}" onclick="pickOpt('${k}','${v}')">${label}</button>`;
    const keepNote = (document.getElementById('optNote') || {}).value || '';
    document.getElementById('optOverlay').innerHTML = `<div class="opt-box">
        <h3>${escHtml(m.name)}</h3>
        <div class="opt-label">Size</div><div class="opt-row">${C.size.map(x => chip('size', x.v, x.v + (x.add ? ` (+${x.add / 1000}k)` : ''), o.size === x.v)).join('')}</div>
        <div class="opt-label">Đường</div><div class="opt-row">${C.sugar.map(v => chip('sugar', v, v, o.sugar === v)).join('')}</div>
        <div class="opt-label">Đá</div><div class="opt-row">${C.ice.map(v => chip('ice', v, v, o.ice === v)).join('')}</div>
        <div class="opt-label">Topping</div><div class="opt-row">${C.toppings.map(x => chip('top', x.v, `${x.v} +${x.add / 1000}k`, o.toppings.includes(x.v))).join('')}</div>
        <input id="optNote" class="opt-note" maxlength="60" placeholder="Ghi chú (vd: ít ngọt, mang đi)" value="${escHtml(keepNote)}">
        <div class="opt-actions"><button type="button" class="opt-cancel" onclick="closeOptionPopup()">Hủy</button>
        <button type="button" class="opt-ok" onclick="confirmOption()">Thêm vào đơn - ${optPrice().toLocaleString()}đ</button></div></div>`;
}
function pickOpt(k, v) {
    const o = optState.o;
    if (k === 'top') o.toppings = o.toppings.includes(v) ? o.toppings.filter(t => t !== v) : o.toppings.concat(v);
    else o[k] = v;
    drawOptionPopup();
}
function confirmOption() {
    const note = (document.getElementById('optNote').value || '').trim();
    const { m, o } = optState, price = optPrice();
    const text = [`Size ${o.size}`, `${o.sugar} đường`, o.ice].concat(o.toppings.map(t => '+' + t)).join(', ') + (note ? ' · ' + note : '');
    closeOptionPopup();
    addLineToBill(m.id, { price, text, key: text });
}

function addLineToBill(menuId, opt) {
    if (!selectedTableId) return alert("Vui lòng chọn bàn trước!");
 
    const table = tables.find(t => t.id === selectedTableId);
    const menuItem = menuList.find(m => m.id === menuId);
    if (!menuItem) return alert("Món này vừa bị Quản lý ẩn hoặc xóa khỏi menu.");
    if (isSoldOut(menuId)) return alert("Món này đang tạm HẾT HÀNG.");
 
    if (table.status === 'empty') {
        table.status = 'occupied';
        const now = new Date();
        table.time = `${String(now.getHours()).padStart(2, "0")}:${now.getMinutes().toString().padStart(2, '0')}`;
        renderTablesGrid();
    }
 
    // Chỉ cộng dồn vào dòng CÙNG món và CHƯA xác nhận. Món đã khóa (confirmed) luôn tạo dòng mới riêng.
    const existItem = table.items.find(i => i.id === menuId && !i.confirmed && (i.optKey || '') === (opt ? opt.key : ''));
    if (existItem) {
        existItem.quantity++;
    } else {
        const line = { lineId: genLineId(), id: menuItem.id, name: menuItem.name, price: opt ? opt.price : menuItem.price, quantity: 1, confirmed: false };
        if (opt) { line.note = opt.text; line.optKey = opt.key; }
        table.items.push(line);
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
            ? `<span class="qty-locked" title="Đã gửi Bếp, không sửa được nữa"><i class="fa-solid fa-lock"></i>${item.quantity}</span>`
            : `<div class="qty-control">
                    <button class="btn-qty" onclick="updateQuantity('${item.lineId}', -1)">-</button>
                    <span class="qty-value">${item.quantity}</span>
                    <button class="btn-qty" onclick="updateQuantity('${item.lineId}', 1)">+</button>
                </div>`;
        return `
            <div class="bill-item-row">
                <div>
                    <div class="bill-item-name">${escHtml(item.name)}${item.confirmed ? ' <span class="bill-item-tag">(đã gửi)</span>' : ''}</div>
                    ${item.note ? `<div class="bill-item-meta">Ghi chú: ${escHtml(item.note)}</div>` : ''}
                    ${item.confirmed ? '' : `<button type="button" class="btn-note" onclick="editNote('${item.lineId}')"><i class="fa-regular fa-pen-to-square"></i> ${item.note ? 'Sửa ghi chú' : 'Ghi chú'}</button>`}
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

// Khóa toàn bộ món đang nháp lại và gửi cho Bếp
function confirmOrder() {
    if (!selectedTableId) return;
    const table = tables.find(t => t.id === selectedTableId);
    const unconfirmed = table.items.filter(i => !i.confirmed);
    if (unconfirmed.length === 0) return;
 
    // Gửi bếp: món vào hàng chờ (kStatus = 'waiting'), bếp bấm "Nhận làm" / "Xong" ở trang Bếp.
    const nowMs = Date.now();
    unconfirmed.forEach(i => {
        i.confirmed = true;
        i.confirmedAt = nowMs;
        i.kStatus = 'waiting';
    });
    saveTables();
    renderBillItems();
    alert(`Đã gửi món cho Bếp - ${table.name}!`);
}

/* ==========================================
   5. THU NGÂN: ĐƠN MANG ĐI / GIAO HÀNG, GHI CHÚ MÓN, BÁO HẾT MÓN
   ========================================== */
const isCashierRole = () => !!(window.Cashier && window.Cashier.isCashier());
const isSoldOut = id => !!(window.Cashier && window.Cashier.soldOutIds().includes(id));

function toggleSoldOut(id) {
    const m = menuList.find(x => x.id === id); if (!m) return;
    window.Cashier.setSoldOut(id, m.name, !isSoldOut(id));
    renderMenuGrid();
}

function editNote(lineId) {
    const table = tables.find(t => t.id === selectedTableId); if (!table) return;
    const item = table.items.find(i => i.lineId === lineId); if (!item || item.confirmed) return;
    const v = prompt('Ghi chú cho món (vd: ít đường, không đá). Để trống để xóa:', item.note || '');
    if (v === null) return;
    item.note = v.trim().slice(0, 80);
    if (!item.note) delete item.note;
    saveTables(); renderBillItems();
}

// Tạo đơn không gắn bàn: type = 'takeaway' | 'delivery'
function createTogoOrder(type) {
    let customer = '', address = '';
    if (type === 'delivery') {
        customer = (prompt('Tên / số điện thoại khách:') || '').trim();
        if (!customer) return alert('Cần nhập tên hoặc số điện thoại khách để giao hàng.');
        address = (prompt('Địa chỉ giao hàng:') || '').trim();
        if (!address) return alert('Cần nhập địa chỉ giao hàng.');
    }
    // đọc lại danh sách mới nhất để không đè dữ liệu tab khác
    try { const s = JSON.parse(localStorage.getItem(TABLES_KEY)); if (Array.isArray(s)) tables = s; } catch (e) {}
    let seq = Number(localStorage.getItem('coffee_order_seq_v1')) || 0; seq++;
    try { localStorage.setItem('coffee_order_seq_v1', String(seq)); } catch (e) {}
    const now = new Date();
    const id = Date.now();
    tables.push({
        id, type, name: (type === 'delivery' ? 'Giao hàng #' : 'Mang đi #') + String(seq).padStart(3, '0'),
        customer, address, status: 'occupied', total: 0, items: [],
        time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    });
    saveTables();
    renderTablesGrid();
    selectTable(id);
}

document.addEventListener('DOMContentLoaded', function () {
    if (isCashierRole()) {
        const nav = document.querySelector('#view-tables .topnav');
        if (nav) {
            nav.insertAdjacentHTML('beforeend', `
                <button class="topnav-item" data-status="togo" onclick="filterTables('togo')">Mang đi / Giao hàng</button>
                <span class="togo-actions">
                    <button type="button" class="btn-togo" onclick="createTogoOrder('takeaway')"><i class="fa-solid fa-bag-shopping"></i> + Đơn mang đi</button>
                    <button type="button" class="btn-togo" onclick="createTogoOrder('delivery')"><i class="fa-solid fa-motorcycle"></i> + Đơn giao hàng</button>
                </span>`);
        }
    }
});
window.addEventListener('storage', function (e) {
    if (e.key === 'coffee_soldout_v1') renderMenuGrid();
});


/* ==========================================
   6. CHUYỂN BÀN / GỘP BÀN / TÁCH BILL
   ========================================== */
function curTable() { return tables.find(t => t.id === selectedTableId); }
function pickTable(msg, list) {
    const v = prompt(msg + '\n' + list.map(t => `${t.id} = ${t.name}`).join('\n'));
    return v ? list.find(t => String(t.id) === v.trim()) : null;
}
function occupy(t, from) { t.status = 'occupied'; t.time = t.time || from.time; }
function moveTable() {
    const t = curTable(); if (!t || !t.items.length) return alert('Bàn chưa có món để chuyển.');
    const dst = pickTable('Chuyển sang bàn TRỐNG (nhập số):', tables.filter(x => x.status === 'empty' && !x.type));
    if (!dst) return;
    dst.items = t.items; dst.total = t.total; occupy(dst, t);
    t.items = []; t.total = 0; t.status = 'empty'; t.time = '';
    selectedTableId = dst.id; saveTables(); renderTablesGrid(); renderBillItems(); refreshBillHeader();
    try { Cashier.log && Cashier.log('table', `Chuyển ${t.name} → ${dst.name}`); } catch (e) {}
}
function mergeTable() {
    const t = curTable(); if (!t) return;
    const src = pickTable('Gộp bàn nào VÀO bàn này (nhập số):', tables.filter(x => x.id !== t.id && x.status === 'occupied' && x.items.length && !x.type));
    if (!src) return;
    t.items = t.items.concat(src.items); occupy(t, src);
    src.items = []; src.total = 0; src.status = 'empty'; src.time = '';
    saveTables(); renderTablesGrid(); renderBillItems();
    try { Cashier.log && Cashier.log('table', `Gộp ${src.name} vào ${t.name}`); } catch (e) {}
}
function splitBill() {
    const t = curTable(); if (!t || t.items.length < 2) return alert('Cần ít nhất 2 dòng món để tách bill.');
    const v = prompt('Tách các dòng nào sang bill riêng? Nhập số dòng, cách nhau dấu phẩy:\n' + t.items.map((i, k) => `${k + 1}. ${i.name} x${i.quantity}`).join('\n'));
    if (!v) return;
    const idx = v.split(',').map(x => parseInt(x, 10) - 1).filter(k => t.items[k]);
    if (!idx.length || idx.length >= t.items.length) return alert('Chọn ít nhất 1 dòng và không chọn hết.');
    const dst = pickTable('Chuyển các dòng đó sang bàn TRỐNG (nhập số) — thanh toán riêng:', tables.filter(x => x.status === 'empty' && !x.type));
    if (!dst) return;
    dst.items = t.items.filter((_, k) => idx.includes(k)); t.items = t.items.filter((_, k) => !idx.includes(k)); occupy(dst, t);
    saveTables(); renderTablesGrid(); renderBillItems();
    try { Cashier.log && Cashier.log('table', `Tách bill ${t.name} → ${dst.name}`); } catch (e) {}
}
function refreshBillHeader() { const t = curTable(); const h = document.getElementById('currentTableTitle'); if (t && h) h.textContent = t.name; }
(function injectTableOps() {
    const hdr = document.querySelector('.bill-header'); if (!hdr || document.getElementById('tableOps')) return;
    const d = document.createElement('div'); d.id = 'tableOps'; d.className = 'table-ops';
    d.innerHTML = '<button type="button" onclick="moveTable()">Chuyển bàn</button><button type="button" onclick="mergeTable()">Gộp bàn</button><button type="button" onclick="splitBill()">Tách bill</button>';
    hdr.after(d);
})();
