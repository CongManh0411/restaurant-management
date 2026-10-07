// ============================================================
// orders.js — QUẢN LÝ ĐƠN HÀNG (Orders.html, Thu ngân)
// ------------------------------------------------------------
// 3 tab:
//   - Đang xử lý   : mọi bàn / đơn mang đi / giao hàng đang có món (đọc 'coffee_tables_v1'),
//                    kèm trạng thái pha chế do Bếp đặt (Chờ pha chế / Đang làm / Đã xong). Nút "Thanh toán".
//   - Đã hoàn thành: hóa đơn HÔM NAY còn hiệu lực. Nút "In" và "Hoàn tiền" (chỉ hóa đơn của CA ĐANG MỞ).
//   - Đã hủy / hoàn: hóa đơn hôm nay đã hủy + lý do + người thực hiện.
// Hoàn tiền: Thu ngân tự làm, bắt buộc ghi lý do, ghi Nhật ký (Quản lý xem ở Logs.html).
// ============================================================
(function () {
    'use strict';
    const C = window.Cashier;
    const session = AuthAPI.getSession();
    if (!session) { window.location.replace('Login.html'); return; }
    if (session.roleKey !== 'cashier') { const p = PAGES_BY_ROLE[session.roleKey]; window.location.replace(p ? p[0].path : 'Login.html'); return; }

    const $ = id => document.getElementById(id);
    const { esc, money, fmtTime, fmtDT } = C;
    let tab = 'processing';

    const readTables = () => C.read('coffee_tables_v1', []);
    const readInv = () => C.read(C.K.INV, []);
    const lineState = i => i.kStatus ? i.kStatus : ((Number(i.readyAt) || 0) > Date.now() ? 'making' : 'done');
    const STATE_TXT = { waiting: 'Chờ pha chế', making: 'Đang làm', done: 'Đã xong' };
    const isToday = iso => { const d = new Date(iso), n = new Date(); return d.toDateString() === n.toDateString(); };
    const typeBadge = t => `<span class="cs-type">${esc(C.ORDER_TYPES[t || 'dinein'])}</span>`;

    function overall(items) {
        const conf = items.filter(i => i.confirmed);
        if (!conf.length) return { key: 'waiting', text: 'Chưa gửi bếp' };
        const st = conf.map(lineState);
        if (st.every(s => s === 'done')) return { key: 'done', text: 'Đã xong — chờ thanh toán' };
        if (st.some(s => s === 'making')) return { key: 'making', text: 'Đang làm' };
        return { key: 'waiting', text: 'Chờ pha chế' };
    }

    function renderProcessing() {
        $('ordTitle').textContent = 'Đơn đang xử lý';
        $('ordHead').innerHTML = '<tr><th>Bàn / Đơn</th><th>Loại</th><th>Vào lúc</th><th>Món</th><th>Trạng thái</th><th>Tạm tính</th><th></th></tr>';
        const rows = readTables().filter(t => (t.items || []).length);
        $('ordSub').textContent = `${rows.length} đơn đang có món`;
        $('ordBody').innerHTML = rows.length ? rows.map(t => {
            const ov = overall(t.items);
            const hasConf = t.items.some(i => i.confirmed);
            const lines = t.items.map(i => `${esc(i.name)} ×${i.quantity}${i.note ? ' <small>(' + esc(i.note) + ')</small>' : ''} ${i.confirmed ? `<span class="cs-status ${lineState(i)}">${STATE_TXT[lineState(i)]}</span>` : '<span class="cs-status waiting">Nháp</span>'}`).join('<br>');
            const total = t.items.reduce((s, i) => s + i.price * i.quantity, 0);
            return `<tr>
                <td><b>${esc(t.name)}</b>${t.customer ? `<br><small>${esc(t.customer)}${t.address ? ' — ' + esc(t.address) : ''}</small>` : ''}</td>
                <td>${typeBadge(t.type)}</td><td>${esc(t.time || '—')}</td>
                <td style="font-size:12.5px;line-height:1.7">${lines}</td>
                <td><span class="cs-status ${ov.key}">${ov.text}</span></td>
                <td>${money(total)}</td>
                <td><div class="cs-actions">${hasConf ? `<button class="btn-outline" data-act="pay" data-id="${t.id}">Thanh toán</button>` : '<small>Mở ở "Bán hàng" để gửi bếp</small>'}</div></td>
            </tr>`;
        }).join('') : '<tr><td colspan="7"><div class="empty-table-state">Chưa có đơn nào đang xử lý.</div></td></tr>';
        $('ordNote').textContent = 'Trạng thái pha chế do Bếp cập nhật tại trang Bếp. Thêm / sửa món: vào "Bán hàng".';
    }

    function renderDone() {
        $('ordTitle').textContent = 'Đơn đã hoàn thành hôm nay';
        $('ordHead').innerHTML = '<tr><th>Mã HD</th><th>Đơn</th><th>Loại</th><th>Giờ</th><th>Thanh toán</th><th>Tổng tiền</th><th></th></tr>';
        const sh = C.currentShift();
        const list = readInv().filter(i => i.status === 'active' && isToday(i.createdAt)).reverse();
        $('ordSub').textContent = `${list.length} hóa đơn • ${money(list.reduce((s, i) => s + i.total, 0))}`;
        $('ordBody').innerHTML = list.length ? list.map(i => {
            const canRefund = sh && i.shiftId === sh.id;
            return `<tr><td><b>${esc(i.id)}</b></td><td>${esc(i.tableName)}</td><td>${typeBadge(i.orderType)}</td><td>${fmtTime(i.createdAt)}</td>
                <td>${esc(C.METHODS[C.methodKey(i)])}${i.discount ? `<br><small>Giảm ${money(i.discount)}${i.voucher ? ' (' + esc(i.voucher) + ')' : ''}</small>` : ''}</td>
                <td>${money(i.total)}</td>
                <td><div class="cs-actions"><button class="btn-outline" data-act="print" data-id="${esc(i.id)}">In</button>
                ${canRefund ? `<button class="btn-danger" data-act="refund" data-id="${esc(i.id)}">Hoàn tiền</button>` : ''}</div></td></tr>`;
        }).join('') : '<tr><td colspan="7"><div class="empty-table-state">Hôm nay chưa có hóa đơn nào.</div></td></tr>';
        $('ordNote').textContent = 'Chỉ hoàn tiền được hóa đơn của ca đang mở. Hóa đơn ca cũ: nhờ Quản lý xử lý ở trang Lịch sử.';
    }

    function renderCancelled() {
        $('ordTitle').textContent = 'Đơn đã hủy / hoàn tiền hôm nay';
        $('ordHead').innerHTML = '<tr><th>Mã HD</th><th>Đơn</th><th>Tổng tiền</th><th>Hủy lúc</th><th>Người thực hiện</th><th>Lý do</th></tr>';
        const list = readInv().filter(i => i.status === 'cancelled' && isToday(i.cancelledAt || i.createdAt)).reverse();
        $('ordSub').textContent = `${list.length} hóa đơn bị hủy / hoàn`;
        $('ordBody').innerHTML = list.length ? list.map(i => `<tr><td><b>${esc(i.id)}</b></td><td>${esc(i.tableName)}</td><td>${money(i.total)}</td>
            <td>${i.cancelledAt ? fmtTime(i.cancelledAt) : '—'}</td><td>${esc(i.cancelledBy || 'Quản lý')}</td><td>${esc(i.cancelReason || '')}</td></tr>`).join('')
            : '<tr><td colspan="6"><div class="empty-table-state">Hôm nay chưa có hóa đơn nào bị hủy.</div></td></tr>';
        $('ordNote').textContent = '';
    }

    function render() { ({ processing: renderProcessing, done: renderDone, cancelled: renderCancelled })[tab](); }
    window.onOrdersChanged = render;

    function refund(id) {
        const invs = readInv(), inv = invs.find(i => i.id === id), sh = C.currentShift();
        if (!inv || inv.status !== 'active') return;
        if (!sh || inv.shiftId !== sh.id) return alert('Chỉ hoàn tiền được hóa đơn của ca đang mở.');
        const reason = (prompt(`Hoàn tiền hóa đơn ${id} (${money(inv.total)}) — nhập lý do (bắt buộc, sẽ ghi Nhật ký cho Quản lý):`) || '').trim();
        if (!reason) return alert('Chưa nhập lý do — chưa hoàn tiền.');
        if (!confirm(`Hoàn ${money(inv.total)} cho khách${C.methodKey(inv) === 'cash' ? ' (lấy từ két tiền mặt)' : ''}?`)) return;
        inv.status = 'cancelled'; inv.cancelReason = 'Hoàn tiền: ' + reason; inv.cancelledAt = new Date().toISOString(); inv.cancelledBy = C.me().name;
        C.write(C.K.INV, invs);
        C.log('refund', `Hoàn tiền ${id} (${inv.tableName}, ${C.METHODS[C.methodKey(inv)]}). Lý do: ${reason}`, inv.total, true);
        render();
    }

    document.addEventListener('DOMContentLoaded', () => {
        $('ordTabs').addEventListener('click', e => {
            const b = e.target.closest('[data-tab]'); if (!b) return;
            tab = b.dataset.tab;
            document.querySelectorAll('#ordTabs .topnav-item').forEach(x => x.classList.toggle('active', x === b));
            render();
        });
        $('ordBody').addEventListener('click', e => {
            const b = e.target.closest('[data-act]'); if (!b) return;
            if (b.dataset.act === 'pay') window.WaiterPay.open(Number(b.dataset.id));
            else if (b.dataset.act === 'print') { const inv = readInv().find(i => i.id === b.dataset.id); if (inv) C.printReceipt(inv); }
            else if (b.dataset.act === 'refund') refund(b.dataset.id);
        });
        render();
        setInterval(render, 3000);
        window.addEventListener('storage', e => { if ([C.K.INV, 'coffee_tables_v1', C.K.SHIFT].includes(e.key)) render(); });
    });
})();
