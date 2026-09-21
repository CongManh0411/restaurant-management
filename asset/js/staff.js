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
const availableTasks = [
    'Gọi món',
    'Phục vụ món',
    'Theo dõi bàn',
    'Thanh toán',
    'Quản lý kho',
    'Báo cáo doanh số'
];

const STAFF_KEY = 'coffee_staff_v1';
function loadStaff() {
    try { const s = JSON.parse(localStorage.getItem(STAFF_KEY)); if (Array.isArray(s) && s.length) return s; } catch (e) {}
    return [
        { id: 1, fullName: 'Nguyễn Văn A', username: 'quanly',  password: '123456', role: 'Quản lý', assignedTasks: ['Báo cáo doanh số', 'Quản lý kho'] },
        { id: 2, fullName: 'Trần Thị B',   username: 'thungan', password: '123456', role: 'Thu ngân', assignedTasks: ['Thanh toán'] },
        { id: 3, fullName: 'Lê Văn C',     username: 'phucvu',  password: '123456', role: 'Phục vụ', assignedTasks: ['Gọi món', 'Phục vụ món', 'Theo dõi bàn'] }
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
    renderTasksCheckboxes();
    attachFormListener();
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
                <div class="staff-tasks">${staff.assignedTasks.length > 0 ? staff.assignedTasks.join(', ') : 'Không có công việc'}</div>
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

function renderTasksCheckboxes() {
    const tasksContainer = document.getElementById('tasksCheckboxes');
    tasksContainer.innerHTML = availableTasks.map((task, index) => `
        <div class="checkbox-item">
            <input type="checkbox" id="task-${index}" name="task" value="${task}">
            <label for="task-${index}">${task}</label>
        </div>
    `).join('');
}

// ==================== Form Handling ====================
function attachFormListener() {
    const form = document.getElementById('staffForm');
    form.addEventListener('submit', handleFormSubmit);
}

function handleFormSubmit(e) {
    e.preventDefault();

    const fullName = document.getElementById('fullName').value.trim();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const role = document.getElementById('role').value;
    const selectedTasks = Array.from(document.querySelectorAll('input[name="task"]:checked'))
        .map(checkbox => checkbox.value);

    if (!fullName || !username || !password || !role) {
        alert('Vui lòng điền đầy đủ thông tin!');
        return;
    }

    if (staffList.some(x => x.username.toLowerCase() === username.toLowerCase() && x.id !== currentEditingId)) {
        alert('Tài khoản "' + username + '" đã tồn tại, hãy chọn tên khác.');
        return;
    }

    if (currentEditingId !== null) {
        // Update existing staff
        const staffIndex = staffList.findIndex(s => s.id === currentEditingId);
        if (staffIndex !== -1) {
            staffList[staffIndex] = {
                ...staffList[staffIndex],
                fullName,
                username,
                password,
                role,
                assignedTasks: selectedTasks
            };
        }
    } else {
        // Create new staff
        const newStaff = {
            id: nextId++,
            fullName,
            username,
            password,
            role,
            assignedTasks: selectedTasks
        };
        staffList.push(newStaff);
    }

    resetForm();
    renderStaffList();
    switchStaffTab('list');
}

function resetForm() {
    const form = document.getElementById('staffForm');
    form.reset();
    document.querySelectorAll('input[name="task"]').forEach(checkbox => {
        checkbox.checked = false;
    });
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

    // Populate form with staff data
    document.getElementById('fullName').value = staff.fullName;
    document.getElementById('username').value = staff.username;
    document.getElementById('password').value = staff.password;
    document.getElementById('role').value = staff.role;

    // Check assigned tasks
    document.querySelectorAll('input[name="task"]').forEach(checkbox => {
        checkbox.checked = staff.assignedTasks.includes(checkbox.value);
    });

    // Change button text and set editing mode
    document.getElementById('submitBtn').textContent = 'Lưu thay đổi';
    document.getElementById('staffFormTitle').textContent = 'Sửa nhân viên';
    document.getElementById('editModeIndicator').classList.add('active');
    document.getElementById('btnCancelEdit').style.display = 'block';
    currentEditingId = id;

    // Switch to the "Thêm nhân viên" tab to edit
    switchStaffTab('add');
}

// ==================== Delete Function ====================
function deleteStaff(id) {
    if (confirm('Bạn có chắc chắn muốn xóa nhân viên này?')) {
        staffList = staffList.filter(staff => staff.id !== id);

        // Reset form if editing this staff
        if (currentEditingId === id) {
            resetForm();
        }

        renderStaffList();
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
document.addEventListener('DOMContentLoaded', initStaffManagement);