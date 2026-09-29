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
        { id: 1, fullName: 'Nguyễn Văn A', username: 'quanly',  password: '123456', role: 'Quản lý',  phone: '', email: '', hireDate: '' },
        { id: 2, fullName: 'Trần Thị B',   username: 'thungan', password: '123456', role: 'Thu ngân', phone: '', email: '', hireDate: '' },
        { id: 3, fullName: 'Lê Văn C',     username: 'phucvu',  password: '123456', role: 'Phục vụ',  phone: '', email: '', hireDate: '' }
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
function formatDate(iso) {
    // '2026-09-29' -> '29/09/2026'
    if (!iso) return '';
    const p = String(iso).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
}

function renderStaffList() {
    saveStaff();
    const staffListContainer = document.getElementById('staffList');

    if (staffList.length === 0) {
        staffListContainer.innerHTML = '<div class="menu-empty-state">Chưa có nhân viên nào. Vào tab "Thêm nhân viên" để bắt đầu.</div>';
        return;
    }

    staffListContainer.innerHTML = staffList.map(staff => {
        const contact = [];
        if (staff.phone)    contact.push('📞 ' + escapeHtml(staff.phone));
        if (staff.email)    contact.push('✉️ ' + escapeHtml(staff.email));
        if (staff.hireDate) contact.push('📅 Vào làm: ' + escapeHtml(formatDate(staff.hireDate)));

        return `
        <div class="staff-item">
            <div class="staff-info">
                <div class="staff-name">${escapeHtml(staff.fullName)}</div>
                <div class="staff-username">@${escapeHtml(staff.username)}</div>
                ${contact.length ? `<div class="staff-contact">${contact.join(' &nbsp;·&nbsp; ')}</div>` : ''}
            </div>
            <div class="staff-actions">
                <div class="staff-role">${escapeHtml(staff.role)}</div>
                <div class="action-buttons">
                    <button type="button" class="btn-outline" onclick="editStaff(${staff.id})">Sửa</button>
                    <button type="button" class="btn-danger" onclick="deleteStaff(${staff.id})">Xóa</button>
                </div>
            </div>
        </div>
    `;
    }).join('');
}

// ==================== Form Handling ====================
function handleFormSubmit(e) {
    e.preventDefault();

    const fullName = document.getElementById('fullName').value.trim();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const role = document.getElementById('role').value;
    const phone = document.getElementById('phone').value.trim();
    const email = document.getElementById('email').value.trim();
    const hireDate = document.getElementById('hireDate').value;

    if (!fullName || !username || !password || !role) {
        alert('Vui lòng điền đầy đủ thông tin!');
        return;
    }

    if (phone && !/^[0-9]{9,11}$/.test(phone)) {
        alert('Số điện thoại chỉ gồm 9-11 chữ số.');
        return;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        alert('Email không hợp lệ.');
        return;
    }

    if (staffList.some(x => x.username.toLowerCase() === username.toLowerCase() && x.id !== currentEditingId)) {
        alert('Tài khoản "' + username + '" đã tồn tại, hãy chọn tên khác.');
        return;
    }

    if (currentEditingId !== null) {
        const staffIndex = staffList.findIndex(s => s.id === currentEditingId);
        if (staffIndex !== -1) {
            staffList[staffIndex] = { ...staffList[staffIndex], fullName, username, password, role, phone, email, hireDate };
        }
    } else {
        staffList.push({ id: nextId++, fullName, username, password, role, phone, email, hireDate });
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
    document.getElementById('phone').value = staff.phone || '';
    document.getElementById('email').value = staff.email || '';
    document.getElementById('hireDate').value = staff.hireDate || '';

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
    return String(text == null ? '' : text).replace(/[&<>"']/g, m => map[m]);
}

// ==================== Initialize on Page Load ====================
document.addEventListener('DOMContentLoaded', initStaffManagement);