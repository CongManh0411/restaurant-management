// ============================================================
// TRANG NHÂN VIÊN (Staff.html)
// ============================================================

// ==================== Tab (topnav) ====================
function switchStaffTab(action) {
    document.querySelectorAll('.topnav-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.action === action);
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === 'panel-' + action);
    });
}

function attachTabListeners() {
    document.querySelectorAll('.topnav-item').forEach(btn => {
        btn.addEventListener('click', () => switchStaffTab(btn.dataset.action));
    });
}

// ==================== State Management ====================
const STAFF_KEY = 'coffee_staff_v1';
function loadStaff() {
    try { const s = JSON.parse(localStorage.getItem(STAFF_KEY)); if (Array.isArray(s) && s.length) return s; } catch (e) {}
    return [
        { id: 1, fullName: 'Nguyễn Văn A', username: 'quanly',  password: '123456', role: 'Quản lý' },
        { id: 2, fullName: 'Trần Thị B',   username: 'thungan', password: '123456', role: 'Thu ngân' },
        { id: 3, fullName: 'Lê Văn C',     username: 'phucvu',  password: '123456', role: 'Phục vụ' }
    ];
}
function saveStaff() { try { localStorage.setItem(STAFF_KEY, JSON.stringify(staffList)); } catch (e) {} }
let staffList = loadStaff();

let currentEditingId = null;
let nextId = Math.max(0, ...staffList.map(x => x.id)) + 1;

// ==================== Initialize Page ====================
function initStaffManagement() {
    attachTabListeners();
    renderStaffList();
    document.getElementById('staffForm').addEventListener('submit', handleFormSubmit);
    document.getElementById('btnCancelEdit').addEventListener('click', () => {
        resetForm();
        switchStaffTab('list');
    });
}

// ==================== Render Functions ====================
function renderStaffList() {
    saveStaff();
    const staffListContainer = document.getElementById('staffList');

    if (staffList.length === 0) {
        staffListContainer.innerHTML = '<div class="menu-empty-state">Chưa có nhân viên nào. Vào tab "Thêm nhân viên" để bắt đầu.</div>';
        return;
    }

    staffListContainer.innerHTML = staffList.map(staff => `
        <div class="staff-item">
            <div class="staff-info">
                <div class="staff-name">${escapeHtml(staff.fullName)}</div>
                <div class="staff-username">@${escapeHtml(staff.username)}</div>
            </div>
            <div class="staff-actions">
                <div class="staff-role">${escapeHtml(staff.role)}</div>
                <div class="action-buttons">
                    <button type="button" class="btn-outline" onclick="editStaff(${staff.id})">Sửa</button>
                    <button type="button" class="btn-danger" onclick="deleteStaff(${staff.id})">Xóa</button>
                </div>
            </div>
        </div>
    `).join('');
}

// ==================== Form Handling ====================
function handleFormSubmit(e) {
    e.preventDefault();

    const fullName = document.getElementById('fullName').value.trim();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const role = document.getElementById('role').value;

    if (!fullName || !username || !password || !role) {
        alert('Vui lòng điền đầy đủ thông tin!');
        return;
    }

    if (staffList.some(x => x.username.toLowerCase() === username.toLowerCase() && x.id !== currentEditingId)) {
        alert('Tài khoản "' + username + '" đã tồn tại, hãy chọn tên khác.');
        return;
    }

    if (currentEditingId !== null) {
        const staffIndex = staffList.findIndex(s => s.id === currentEditingId);
        if (staffIndex !== -1) {
            staffList[staffIndex] = { ...staffList[staffIndex], fullName, username, password, role };
        }
    } else {
        staffList.push({ id: nextId++, fullName, username, password, role });
    }

    resetForm();
    renderStaffList();
    switchStaffTab('list');
}

function resetForm() {
    document.getElementById('staffForm').reset();
    document.getElementById('submitBtn').textContent = 'Tạo tài khoản';
    document.getElementById('staffFormTitle').textContent = 'Thêm nhân viên mới';
    document.getElementById('editModeIndicator').classList.remove('active');
    document.getElementById('btnCancelEdit').style.display = 'none';
    currentEditingId = null;
}

// ==================== Edit Function ====================
function editStaff(id) {
    const staff = staffList.find(s => s.id === id);
    if (!staff) return;

    document.getElementById('fullName').value = staff.fullName;
    document.getElementById('username').value = staff.username;
    document.getElementById('password').value = staff.password;
    document.getElementById('role').value = staff.role;

    document.getElementById('submitBtn').textContent = 'Lưu thay đổi';
    document.getElementById('staffFormTitle').textContent = 'Sửa nhân viên';
    document.getElementById('editModeIndicator').classList.add('active');
    document.getElementById('btnCancelEdit').style.display = 'block';
    currentEditingId = id;

    switchStaffTab('add');
}

// ==================== Delete Function ====================
function deleteStaff(id) {
    if (confirm('Bạn có chắc chắn muốn xóa nhân viên này?')) {
        staffList = staffList.filter(staff => staff.id !== id);
        if (currentEditingId === id) resetForm();
        renderStaffList();
    }
}

// ==================== Utility Functions ====================
function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// ==================== Initialize on Page Load ====================
document.addEventListener('DOMContentLoaded', initStaffManagement); 