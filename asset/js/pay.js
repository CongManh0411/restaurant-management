// pay.js — Trang Thanh toán (thu ngân). Đọc đơn do trang Bàn "Báo Thu Ngân" gửi sang,
// tính tiền, xác nhận thanh toán rồi ghi hóa đơn vào 'qlcp_invoices' (Lịch sử + Doanh thu đọc key này).
(function () {
    const PENDING_KEY = 'coffee_pending_orders_v1', TABLES_KEY = 'coffee_tables_v1', INVOICE_KEY = 'qlcp_invoices';
    const $ = id => document.getElementById(id);
    const money = n => `${Math.round(Number(n) || 0).toLocaleString('vi-VN')} đ`;
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
    const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

    let orders = read(PENDING_KEY, []), selectedId = null;

    const order = () => orders.find(o => o.tableId === selectedId);
    const subtotal = o => o.items.reduce((s, i) => s + i.price * i.quantity, 0);
    function discountAmt(o) {
        const v = Math.max(0, Number($('payDiscountVal').value) || 0), sub = subtotal(o);
        return Math.min(sub, $('payDiscountType').value === 'pct' ? Math.round(sub * Math.min(v, 100) / 100) : v);
    }
    const method = () => 'cash'; // chỉ còn đúng 1 phương thức, không cần đọc từ input nữa

    function renderList() {
        const ul = $('payOrderList');
        ul.innerHTML = orders.map(o => `<li class="${o.tableId === selectedId ? 'active' : ''}"><button type="button" data-id="${o.tableId}">
            <span class="pay-order-name">${esc(o.tableName)}</span>
            <span class="pay-order-meta">${o.items.reduce((s, i) => s + i.quantity, 0)} món</span>
            <span class="pay-order-total">${money(subtotal(o))}</span></button></li>`).join('');
        $('payOrderEmpty').hidden = orders.length > 0;
    }

    function renderBill() {
        const o = order();
        $('payBillEmpty').hidden = !!o; $('payBillBody').hidden = !o;
        if (!o) return;
        $('payTableName').textContent = String(o.tableName).replace(/^Bàn\s*/i, '');
        $('payItems').innerHTML = o.items.map((i, idx) => `<tr><td>${esc(i.name)}</td><td class="num">${i.quantity}</td>
            <td class="num">${money(i.price)}</td><td class="num">${money(i.price * i.quantity)}</td></tr>`).join('');
        recalc();
    }

    function recalc() {
        const o = order(); if (!o) return;
        const sub = subtotal(o), disc = discountAmt(o), total = sub - disc, m = method();
        $('paySubtotal').textContent = money(sub); $('payDiscountShow').textContent = money(disc); $('payTotal').textContent = money(total);
        $('payCashBox').hidden = m !== 'cash';
        const given = Number($('payCashGiven').value) || 0;
        $('payChange').textContent = money(Math.max(0, given - total));
        const quick = [total, 50000, 100000, 200000, 500000].filter((v, i, a) => v > 0 && a.indexOf(v) === i);
        $('payQuick').innerHTML = m === 'cash' ? quick.map(v => `<button type="button" data-quick="${v}">${v === total ? 'Vừa đủ' : money(v)}</button>`).join('') : '';
        let hint = '', ok = total > 0;
        if (o.items.length === 0) { hint = 'Đơn chưa có món nào.'; ok = false; }
        else if (m === 'cash' && given < total) { hint = given ? 'Khách đưa chưa đủ tiền.' : 'Nhập số tiền khách đưa.'; ok = false; }
        $('payHint').hidden = !hint; $('payHint').textContent = hint; $('payHint').className = 'pay-hint' + (hint ? ' warn' : '');
        $('payConfirm').disabled = !ok;
    }

    function select(id) {
        selectedId = id; $('payDiscountVal').value = 0; $('payDiscountType').value = 'vnd'; $('payCashGiven').value = '';
        renderList(); renderBill();
    }

    function confirmPay() {
        const o = order(); if (!o) return;
        const sub = subtotal(o), disc = discountAmt(o), total = sub - disc, m = method(), given = Number($('payCashGiven').value) || 0;
        const invoices = read(INVOICE_KEY, []);
        let n = invoices.length + 1, id; do { id = 'HD' + String(n++).padStart(3, '0'); } while (invoices.some(i => i.id === id));
        const now = new Date().toISOString();
        invoices.push({ id, tableName: o.tableName, createdAt: now, paymentMethod: m,
            items: o.items.map(i => ({ name: i.name, qty: i.quantity, price: i.price })), total, status: 'active' });
        write(INVOICE_KEY, invoices);
        // dọn đơn chờ + trả bàn về trạng thái trống
        orders = orders.filter(x => x.tableId !== o.tableId); write(PENDING_KEY, orders);
        const tables = read(TABLES_KEY, null);
        if (Array.isArray(tables)) { const t = tables.find(x => x.id === o.tableId); if (t) { t.status = 'empty'; t.time = ''; t.total = 0; t.items = []; } write(TABLES_KEY, tables); }
        const label = { cash: 'Tiền mặt' }[m];
        $('payReceipt').innerHTML = `<h2 id="payReceiptTitle" style="text-align:center;margin:0 0 4px">Quán cà phê</h2>
            <p style="text-align:center;margin:0 0 12px">HÓA ĐƠN ${esc(id)} — ${esc(o.tableName)}<br>${new Date(now).toLocaleString('vi-VN')}</p>
            <table class="pay-table"><tbody>${o.items.map(i => `<tr><td>${esc(i.name)} x${i.quantity}</td><td class="num">${money(i.price * i.quantity)}</td></tr>`).join('')}</tbody></table>
            <p>Tạm tính: <b>${money(sub)}</b><br>Giảm giá: <b>${money(disc)}</b><br>Thành tiền: <b>${money(total)}</b><br>Thanh toán: ${label}${m === 'cash' ? `<br>Khách đưa: ${money(given)} — Thối lại: ${money(given - total)}` : ''}</p>`;
        $('payModal').hidden = false; selectedId = null; renderList(); renderBill();
    }

    document.addEventListener('DOMContentLoaded', () => {
        renderList(); renderBill();
        $('payOrderList').addEventListener('click', e => { const b = e.target.closest('button[data-id]'); if (b) select(Number(b.dataset.id)); });
        ['payDiscountVal', 'payDiscountType', 'payCashGiven'].forEach(id => $(id).addEventListener('input', recalc));
        $('payQuick').addEventListener('click', e => { const b = e.target.closest('button[data-quick]'); if (b) { $('payCashGiven').value = b.dataset.quick; recalc(); } });
        $('payConfirm').addEventListener('click', confirmPay);
        $('payClose').addEventListener('click', () => { $('payModal').hidden = true; });
        $('payPrint').addEventListener('click', () => window.print());
        // nút ☰ trên màn nhỏ
        const toggle = open => { const sb = document.querySelector('.sidebar'); if (sb) sb.classList.toggle('open', open); $('payScrim').classList.toggle('active', open); $('payMenuBtn').setAttribute('aria-expanded', String(open)); };
        $('payMenuBtn').addEventListener('click', () => toggle(!document.querySelector('.sidebar.open')));
        $('payScrim').addEventListener('click', () => toggle(false));
        // đơn mới từ trang Bàn (tab khác) tự hiện
        window.addEventListener('storage', e => { if (e.key === PENDING_KEY) { orders = read(PENDING_KEY, []); renderList(); renderBill(); } });
    });
})();