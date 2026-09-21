// ============================================================
// TRANG KHO NGUYÊN LIỆU (warehouse.html)
// ============================================================

// ==================== Tab (topnav) ====================
function switchWarehouseTab(action) {
    document.querySelectorAll('.topnav-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.action === action);
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === 'panel-' + action);
    });
}

function attachTabListeners() {
    document.querySelectorAll('.topnav-item').forEach(btn => {
        btn.addEventListener('click', () => switchWarehouseTab(btn.dataset.action));
    });
}

// ==================== State Management ====================
let inventoryList = [
    { id: 1, name: 'Cà phê hạt', unit: 'kg',  stock: 5,  minLevel: 10, trackingCode: 'VN123456789' },
    { id: 2, name: 'Sữa đặc',    unit: 'hộp', stock: 8,  minLevel: 15, trackingCode: 'VN987654321' },
    { id: 3, name: 'Đường',      unit: 'kg',  stock: 20, minLevel: 10, trackingCode: 'VN456789123' },
    { id: 4, name: 'Đá viên',    unit: 'kg',  stock: 30, minLevel: 20, trackingCode: 'VN789123456' }
];

let currentEditingId = null;
let nextId = 5;

// ==================== Initialize Page ====================
function initInventoryManagement() {
    attachTabListeners();
    renderTable();
    updateSummaryCards();
    attachFormListener();
    document.getElementById('btnCancelEdit').addEventListener('click', () => {
        resetForm();
        switchWarehouseTab('list');
    });
}

// ==================== Render Functions ====================
function renderTable() {
    const tableBody = document.getElementById('tableBody');

    if (inventoryList.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" class="empty-table-state">Chưa có nguyên liệu nào. Vào tab "Thêm nguyên liệu" để bắt đầu.</td></tr>';
        return;
    }

    tableBody.innerHTML = inventoryList.map(item => {
        const needToBuy = Math.max(0, item.minLevel - item.stock);
        const isUnderMin = item.stock < item.minLevel;
        const statusText = isUnderMin
            ? `Cần mua thêm ${needToBuy} ${item.unit}`
            : 'Đủ định mức';
        const statusClass = isUnderMin ? 'badge badge-cancelled' : 'badge badge-active';

        return `
            <tr>
                <td>${escapeHtml(item.name)}</td>
                <td>${escapeHtml(item.unit)}</td>
                <td>${item.stock}</td>
                <td>${item.minLevel}</td>
                <td>${needToBuy}</td>
                <td>${escapeHtml(item.trackingCode)}</td>
                <td><span class="${statusClass}">${statusText}</span></td>
                <td>
                    <div class="table-actions">
                        <button type="button" class="btn-outline" onclick="editInventory(${item.id})">Sửa</button>
                        <button type="button" class="btn-danger" onclick="deleteInventory(${item.id})">Xóa</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function updateSummaryCards() {
    const totalIngredients = inventoryList.length;
    const underMinLevel = inventoryList.filter(item => item.stock < item.minLevel).length;
    const totalStock = inventoryList.reduce((sum, item) => sum + item.stock, 0);

    document.getElementById('totalIngredients').textContent = totalIngredients;
    document.getElementById('underMinLevel').textContent = underMinLevel;
    document.getElementById('totalStock').textContent = totalStock;
}

// ==================== Form Handling ====================
function attachFormListener() {
    const form = document.getElementById('inventoryForm');
    form.addEventListener('submit', handleFormSubmit);
}

function handleFormSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('ingredientName').value.trim();
    const unit = document.getElementById('unit').value.trim();
    const stock = parseInt(document.getElementById('stock').value) || 0;
    const minLevel = parseInt(document.getElementById('minLevel').value) || 0;
    const trackingCode = document.getElementById('trackingCode').value.trim();

    if (!name || !unit || !trackingCode) {
        alert('Vui lòng điền đầy đủ thông tin!');
        return;
    }

    if (currentEditingId !== null) {
        // Update existing inventory item
        const itemIndex = inventoryList.findIndex(i => i.id === currentEditingId);
        if (itemIndex !== -1) {
            inventoryList[itemIndex] = {
                ...inventoryList[itemIndex],
                name,
                unit,
                stock,
                minLevel,
                trackingCode
            };
        }
    } else {
        // Create new inventory item
        const newItem = {
            id: nextId++,
            name,
            unit,
            stock,
            minLevel,
            trackingCode
        };
        inventoryList.push(newItem);
    }

    resetForm();
    renderTable();
    updateSummaryCards();
    switchWarehouseTab('list');
}

function resetForm() {
    const form = document.getElementById('inventoryForm');
    form.reset();
    document.getElementById('stock').value = '0';
    document.getElementById('minLevel').value = '0';
    document.getElementById('submitBtn').textContent = 'Thêm nguyên liệu';
    document.getElementById('inventoryFormTitle').textContent = 'Thêm nguyên liệu mới';
    document.getElementById('editModeIndicator').classList.remove('active');
    document.getElementById('btnCancelEdit').style.display = 'none';
    currentEditingId = null;
}

// ==================== Edit Function ====================
function editInventory(id) {
    const item = inventoryList.find(i => i.id === id);
    if (!item) return;

    // Populate form with item data
    document.getElementById('ingredientName').value = item.name;
    document.getElementById('unit').value = item.unit;
    document.getElementById('stock').value = item.stock;
    document.getElementById('minLevel').value = item.minLevel;
    document.getElementById('trackingCode').value = item.trackingCode;

    // Change button text and set editing mode
    document.getElementById('submitBtn').textContent = 'Lưu thay đổi';
    document.getElementById('inventoryFormTitle').textContent = 'Sửa nguyên liệu';
    document.getElementById('editModeIndicator').classList.add('active');
    document.getElementById('btnCancelEdit').style.display = 'block';
    currentEditingId = id;

    // Switch to the "Thêm nguyên liệu" tab to edit
    switchWarehouseTab('add');
}

// ==================== Delete Function ====================
function deleteInventory(id) {
    if (confirm('Bạn có chắc chắn muốn xóa nguyên liệu này?')) {
        inventoryList = inventoryList.filter(item => item.id !== id);

        // Reset form if editing this item
        if (currentEditingId === id) {
            resetForm();
        }

        renderTable();
        updateSummaryCards();
    }
}

// ==================== Utility Functions ====================
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// ==================== Initialize on Page Load ====================
document.addEventListener('DOMContentLoaded', initInventoryManagement);