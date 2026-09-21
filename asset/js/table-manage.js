// table-manage.js — Trang Quản lý bàn (vai trò Quản lý): chỉ thêm / sửa tên / xóa bàn.
// Dùng CHUNG key 'coffee_tables_v1' với trang Bàn của Phục vụ (table-order.js) và trang Thanh toán (pay.js),
// nên bàn thêm/sửa/xóa ở đây sẽ hiện ngay trên sơ đồ bàn của Phục vụ.
(function () {
    const TABLES_KEY = 'coffee_tables_v1';
    const PENDING_KEY = 'coffee_pending_orders_v1';

    const $ = id => document.getElementById(id);
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const norm = s => String(s).trim().replace(/\s+/g, ' ').toLowerCase();

    // Danh sách mặc định — giống hệt table-order.js, dùng khi chưa có dữ liệu lưu
    const defaultTables = () => Array.from({ length: 8 }, (_, i) => ({
        id: i + 1, name: 'Bàn ' + String(i + 1).padStart(2, '0'), status: 'empty', time: '', total: 0, items: []
    }));

    const STATUS = {
        empty:    { text: 'Bàn trống',      badge: 'badge-active' },
        occupied: { text: 'Đang phục vụ',   badge: 'badge-serving' },
        pending:  { text: 'Chờ thanh toán', badge: 'badge-pending' }
    };

    // Luôn đọc mới từ localStorage trước khi ghi, để không đè mất trạng thái bàn
    // mà Phục vụ / Thu ngân vừa thay đổi ở tab khác.
    function load() {
        try { const s = JSON.parse(localStorage.getItem(TABLES_KEY)); if (Array.isArray(s)) return s; } catch (e) {}
        return defaultTables();
    }
    function save(list) {
        try { localStorage.setItem(TABLES_KEY, JSON.stringify(list)); return true; }
        catch (e) { alert('Không lưu được dữ liệu bàn. Kiểm tra lại trình duyệt rồi thử lại.'); return false; }
    }
    function updatePending(fn) {
        try {
            const list = JSON.parse(localStorage.getItem(PENDING_KEY)) || [];
            localStorage.setItem(PENDING_KEY, JSON.stringify(fn(list)));
        } catch (e) {}
    }

    let editingId = null;   // null = đang thêm bàn mới
    let deletingId = null;

    // ---------- Hiển thị danh sách ----------
    function render() {
        const list = load();
        const count = s => list.filter(t => t.status === s).length;
        $('tableSummary').textContent = list.length
            ? `Tổng cộng ${list.length} bàn — ${count('empty')} trống, ${count('occupied')} đang phục vụ, ${count('pending')} chờ thanh toán`
            : 'Tổng cộng 0 bàn';

        const tbody = $('tableManageBody');
        if (!list.length) {
            tbody.innerHTML = '<tr><td colspan="4"><div class="empty-table-state">Chưa có bàn nào. Bấm "+ Thêm bàn" để bắt đầu.</div></td></tr>';
            return;
        }
        tbody.innerHTML = list.map(t => {
            const st = STATUS[t.status] || STATUS.empty;
            const canDelete = t.status === 'empty';
            return `<tr>
                <td><b>${esc(t.name)}</b></td>
                <td><span class="badge ${st.badge}">${st.text}</span></td>
                <td>${t.time ? esc(t.time) : '—'}</td>
                <td><div class="tm-row-actions">
                    <button type="button" class="btn-outline" data-act="edit" data-id="${t.id}">Sửa</button>
                    <button type="button" class="btn-danger" data-act="delete" data-id="${t.id}" ${canDelete ? '' : 'disabled title="Chỉ xóa được bàn đang trống"'}>Xóa</button>
                </div></td>
            </tr>`;
        }).join('');
    }

    // ---------- Thêm / sửa ----------
    function suggestName(list) {
        let max = 0;
        list.forEach(t => { const m = String(t.name).match(/(\d+)\s*$/); if (m) max = Math.max(max, Number(m[1])); });
        let n = Math.max(max, list.length) + 1, name;
        do { name = 'Bàn ' + String(n++).padStart(2, '0'); } while (list.some(t => norm(t.name) === norm(name)));
        return name;
    }

    function showNameError(msg) {
        $('tableNameError').textContent = msg;
        $('tableNameError').hidden = !msg;
    }

    function openTableModal(id) {
        const list = load();
        editingId = id ?? null;
        const t = editingId === null ? null : list.find(x => x.id === editingId);
        if (editingId !== null && !t) { render(); return; }
        $('tableModalTitle').textContent = t ? 'Sửa bàn' : 'Thêm bàn';
        $('tableModalSub').textContent = t ? `Đổi tên cho ${t.name}.` : 'Nhập tên bàn mới.';
        $('btnTableSave').textContent = t ? 'Lưu thay đổi' : 'Thêm bàn';
        $('tableNameInput').value = t ? t.name : suggestName(list);
        showNameError('');
        $('tableModal').classList.add('active');
        $('tableNameInput').focus();
        $('tableNameInput').select();
    }
    function closeTableModal() {
        $('tableModal').classList.remove('active');
        editingId = null;
    }

    function submitTable(e) {
        e.preventDefault();
        const name = $('tableNameInput').value.trim().replace(/\s+/g, ' ');
        const list = load();
        if (!name) return showNameError('Vui lòng nhập tên bàn.');
        if (list.some(t => t.id !== editingId && norm(t.name) === norm(name))) return showNameError(`Đã có bàn tên "${name}". Hãy chọn tên khác.`);

        if (editingId === null) {
            const id = list.reduce((m, t) => Math.max(m, Number(t.id) || 0), 0) + 1;
            list.push({ id, name, status: 'empty', time: '', total: 0, items: [] });
        } else {
            const t = list.find(x => x.id === editingId);
            if (!t) { closeTableModal(); render(); return; }
            t.name = name;
            // đơn đang chờ thanh toán của bàn này cũng phải đổi tên theo
            updatePending(p => p.map(o => o.tableId === editingId ? Object.assign({}, o, { tableName: name }) : o));
        }
        if (!save(list)) return;
        closeTableModal();
        render();
    }

    // ---------- Xóa ----------
    function openDeleteModal(id) {
        const t = load().find(x => x.id === id);
        if (!t) { render(); return; }
        if (t.status !== 'empty') { alert(`${t.name} đang có khách nên chưa thể xóa.`); render(); return; }
        deletingId = id;
        $('deleteModalName').textContent = t.name;
        $('deleteModal').classList.add('active');
    }
    function closeDeleteModal() {
        $('deleteModal').classList.remove('active');
        deletingId = null;
    }
    function confirmDelete() {
        const list = load();
        const t = list.find(x => x.id === deletingId);
        if (t && t.status !== 'empty') { closeDeleteModal(); alert(`${t.name} vừa có khách nên chưa thể xóa.`); render(); return; }
        const next = list.filter(x => x.id !== deletingId);
        updatePending(p => p.filter(o => o.tableId !== deletingId));
        if (!save(next)) return;
        closeDeleteModal();
        render();
    }

    // ---------- Gắn sự kiện ----------
    document.addEventListener('DOMContentLoaded', () => {
        render();
        $('btnAddTable').addEventListener('click', () => openTableModal(null));
        $('tableManageBody').addEventListener('click', e => {
            const b = e.target.closest('button[data-act]');
            if (!b || b.disabled) return;
            const id = Number(b.dataset.id);
            if (b.dataset.act === 'edit') openTableModal(id);
            else openDeleteModal(id);
        });
        $('tableForm').addEventListener('submit', submitTable);
        $('tableNameInput').addEventListener('input', () => showNameError(''));
        $('btnTableCancel').addEventListener('click', closeTableModal);
        $('btnDeleteCancel').addEventListener('click', closeDeleteModal);
        $('btnDeleteConfirm').addEventListener('click', confirmDelete);
        // bấm ra ngoài hộp thoại hoặc nhấn Esc để đóng
        [['tableModal', closeTableModal], ['deleteModal', closeDeleteModal]].forEach(([id, close]) => {
            $(id).addEventListener('click', e => { if (e.target === $(id)) close(); });
        });
        document.addEventListener('keydown', e => {
            if (e.key !== 'Escape') return;
            closeTableModal(); closeDeleteModal();
        });
        // trạng thái bàn đổi ở tab khác (Phục vụ gọi món, Thu ngân thanh toán) -> cập nhật lại
        window.addEventListener('storage', e => { if (e.key === TABLES_KEY) render(); });
    });
})();