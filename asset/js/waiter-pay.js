// ============================================================
// waiter-pay.js — POPUP THANH TOÁN (Phục vụ VÀ Thu ngân đều dùng được)
// ------------------------------------------------------------
// Luồng: "Thanh toán" (sidebar) -> chọn bàn/đơn -> xem hóa đơn -> [Thu ngân: khuyến mãi / giảm giá]
//        -> chọn TIỀN MẶT / QR / THẺ / VÍ ĐIỆN TỬ -> "Xác nhận thanh toán" -> lưu hóa đơn vào 'qlcp_invoices'
//        -> in hoặc gửi hóa đơn.
// Khác biệt theo vai trò:
//   - Thu ngân: có khuyến mãi/giảm giá, hủy được cả món đã làm xong (bắt buộc ghi lý do),
//               bắt buộc đang MỞ CA mới thanh toán được. Mọi thao tác nhạy cảm ghi vào Nhật ký (Quản lý xem ở Logs.html).
//   - Phục vụ : như trước (không giảm giá, chỉ hủy món chưa xong).
// Đơn mang đi / giao hàng (bàn có trường `type`) sẽ được XÓA khỏi danh sách sau khi thanh toán xong.
// Cần cashier-core.js (window.Cashier) — nạp trước trong Table.html / Orders.html.
// ============================================================
(function () {
    'use strict';
    if (window.WaiterPay) return;

    const C = window.Cashier;
    const TABLES_KEY = 'coffee_tables_v1';
    const INVOICE_KEY = 'qlcp_invoices';
    const QR_LIB = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    const METHOD_LABEL = { cash: 'Tiền mặt', qr: 'Mã QR', card: 'Thẻ', ewallet: 'Ví điện tử' };
    const METHOD_ICON = { cash: 'ri-money-dollar-circle-line', qr: 'ri-qr-code-line', card: 'ri-bank-card-line', ewallet: 'ri-wallet-3-line' };

    const $ = id => document.getElementById(id);
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const money = n => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' đ';
    const isCashier = () => C && C.isCashier();

    function buildQrText(tableName, total) {
        const plain = String(tableName).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
        return `THANH TOAN ${plain} - ${Math.round(total)} VND - QR MAU`;
    }

    // ---------- Dữ liệu ----------
    function readTables() { try { const t = JSON.parse(localStorage.getItem(TABLES_KEY)); return Array.isArray(t) ? t : []; } catch (e) { return []; } }
    function writeTables(list) { try { localStorage.setItem(TABLES_KEY, JSON.stringify(list)); return true; } catch (e) { return false; } }
    function readInvoices() { try { const t = JSON.parse(localStorage.getItem(INVOICE_KEY)); return Array.isArray(t) ? t : []; } catch (e) { return []; } }
    function writeInvoices(list) { try { localStorage.setItem(INVOICE_KEY, JSON.stringify(list)); return true; } catch (e) { return false; } }

    const lineState = (i, now) => i.kStatus ? i.kStatus : ((Number(i.readyAt) || 0) > now ? 'making' : 'done');

    function billOf(table, now) {
        const items = (table.items || []).filter(i => i.confirmed);
        const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
        const notReady = items.filter(i => lineState(i, now) !== 'done').length;
        return { items, total, notReady, count: items.reduce((s, i) => s + i.quantity, 0) };
    }
    const payableTables = now => readTables().map(t => ({ t, bill: billOf(t, now) })).filter(x => x.bill.items.length > 0);

    function syncPageState() {
        try {
            if (typeof tables !== 'undefined' && Array.isArray(tables)) {
                tables.splice(0, tables.length, ...readTables());
                if (typeof renderTablesGrid === 'function') renderTablesGrid();
                const mv = document.getElementById('view-menu');
                if (typeof selectedTableId !== 'undefined' && selectedTableId && mv && mv.classList.contains('active') && typeof renderBillItems === 'function') {
                    if (!tables.some(t => t.id === selectedTableId) && typeof showTablesView === 'function') showTablesView();
                    else renderBillItems();
                }
            }
        } catch (e) {}
        if (typeof window.onOrdersChanged === 'function') window.onOrdersChanged(); // trang Đơn hàng vẽ lại
    }

    // Bàn không còn món: bàn thật -> về trống; đơn mang đi/giao hàng -> xóa hẳn
    function releaseIfEmpty(list, t) {
        if ((t.items || []).length) return;
        if (t.type) { const idx = list.indexOf(t); if (idx >= 0) list.splice(idx, 1); return; }
        t.status = 'empty'; t.time = ''; t.total = 0;
    }

    // Bỏ 1 phần của 1 món. force = true (Thu ngân hủy món ĐÃ LÀM) -> bắt buộc có reason. Trả về true nếu đã xóa.
    function removeOne(tableId, lineId, reason) {
        const now = Date.now();
        const list = readTables();
        const t = list.find(x => x.id === tableId);
        if (!t) return false;
        const item = (t.items || []).find(i => i.lineId === lineId && i.confirmed);
        if (!item) return false;
        const done = lineState(item, now) === 'done';
        if (done && !(isCashier() && reason)) return false;
        const nm = item.name, pr = item.price;
        item.quantity -= 1;
        if (item.quantity <= 0) t.items = t.items.filter(i => i !== item);
        t.total = t.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
        releaseIfEmpty(list, t);
        writeTables(list);
        if (C) {
            if (done) C.log('void_done', `Hủy món ĐÃ LÀM: 1 × ${nm} (${t.name}). Lý do: ${reason}`, pr, true);
            else C.log('void_item', `Hủy món chưa xong: 1 × ${nm} (${t.name})${t.items.length ? '' : ' — đơn bị hủy hoàn toàn'}`, pr, false);
        }
        syncPageState();
        return true;
    }

    // ---------- Mã QR ----------
    function ensureQrLib(cb) {
        if (window.QRCode) return cb(true);
        const sc = document.createElement('script');
        sc.src = QR_LIB; sc.onload = () => cb(!!window.QRCode); sc.onerror = () => cb(false);
        document.head.appendChild(sc);
    }
    function drawQr(text) {
        if (!$('wpQr')) return;
        ensureQrLib(ok => {
            const el = $('wpQr');
            if (!el) return;
            el.innerHTML = '';
            if (!ok) { el.innerHTML = `<div class="wp-qr-fail">Không tải được thư viện QR (cần có internet).<br><small>${esc(text)}</small></div>`; return; }
            new window.QRCode(el, { text, width: 220, height: 220, correctLevel: window.QRCode.CorrectLevel.M });
        });
    }

    // ---------- Popup ----------
    const state = { view: 'list', tableId: null, method: null, given: '', ref: '', code: '', voucher: null, dtype: 'vnd', dval: '', last: null };
    let timer = null;
    const resetPay = () => Object.assign(state, { method: null, given: '', ref: '', code: '', voucher: null, dtype: 'vnd', dval: '' });

    function close() {
        const w = $('wpBackdrop');
        if (w) w.classList.remove('active');
        if ($('navPay')) $('navPay').classList.remove('active');
        if (timer) { clearInterval(timer); timer = null; }
    }

    // Tính tiền: tạm tính, giảm giá (voucher hoặc nhập tay — chỉ Thu ngân), thành tiền
    function calc(bill) {
        const sub = bill.total; let disc = 0, code = '';
        if (isCashier()) {
            if (state.voucher) {
                const v = C.applyVoucher(state.voucher.code, sub);
                if (v) { disc = v.amount; code = v.code; }
            } else disc = C.manualDiscount(state.dtype, state.dval, sub);
        }
        return { sub, disc, code, total: sub - disc };
    }

    function renderList() {
        const rows = payableTables(Date.now());
        $('wpTitle').textContent = 'Thanh toán — chọn bàn / đơn';
        $('wpFoot').innerHTML = '';
        $('wpBody').innerHTML = rows.length ? `<div class="wp-list">${rows.map(({ t, bill }) => `
            <button type="button" class="wp-row" data-act="pick" data-id="${t.id}">
                <span class="wp-row-name">${esc(t.name)}</span>
                <span class="wp-row-meta">${bill.count} món${bill.notReady ? ` · <em>còn ${bill.notReady} món chưa xong</em>` : ''}</span>
                <span class="wp-row-total">${money(bill.total)}</span>
            </button>`).join('')}</div>` : '<div class="notif-empty">Chưa có bàn / đơn nào cần thanh toán.</div>';
    }

    const DENOMS = [10000, 20000, 50000, 100000, 200000, 500000];
    function cashQuick(total) {
        return `<button type="button" data-act="quick" data-exact="1" data-v="${total}">Vừa đủ</button>` +
            DENOMS.map(v => `<button type="button" data-act="quick" data-v="${v}">+ ${money(v)}</button>`).join('') +
            '<button type="button" data-act="clear" class="clear">Xóa số</button>';
    }

    function renderBill() {
        const now = Date.now();
        const t = readTables().find(x => x.id === state.tableId);
        const bill = t ? billOf(t, now) : null;
        if (!t || !bill.items.length) { state.view = 'list'; return renderList(); }
        const cv = calc(bill);

        $('wpTitle').textContent = `Thanh toán — ${t.name}`;
        const itemsHtml = bill.items.map(i => {
            const done = lineState(i, now) === 'done';
            let act;
            if (!done) act = `<button type="button" class="wp-del" data-act="dec" data-line="${esc(i.lineId)}">${i.quantity > 1 ? '−1' : '<i class="fa-solid fa-trash"></i> Xóa'}</button>`;
            else if (isCashier()) act = `<button type="button" class="wp-del wp-void" data-act="void" data-line="${esc(i.lineId)}" title="Món đã làm xong — cần lý do, có ghi Nhật ký">Hủy (đã làm)</button>`;
            else act = '<span class="wp-done">Đã xong</span>';
            return `<tr><td>${esc(i.name)}</td><td class="num">${i.quantity}</td>
                <td class="num">${money(i.price)}</td><td class="num">${money(i.price * i.quantity)}</td><td class="num wp-act">${act}</td></tr>`;
        }).join('');

        // Khuyến mãi / giảm giá (chỉ Thu ngân)
        const discBox = isCashier() ? `<div class="wp-disc">
                <div class="wp-disc-row">
                    <input type="text" id="wpCode" placeholder="Mã khuyến mãi (vd: GIAM10)" value="${esc(state.code)}" ${state.voucher ? 'disabled' : ''}>
                    ${state.voucher ? '<button type="button" class="wp-mini" data-act="unvoucher">Bỏ mã</button>' : '<button type="button" class="wp-mini" data-act="voucher">Áp dụng</button>'}
                </div>
                ${state.voucher ? `<div class="wp-disc-ok"><i class="ri-coupon-3-line"></i> ${esc(state.voucher.code)} — ${esc(state.voucher.label)}</div>` : `
                <div class="wp-disc-row">
                    <input type="number" id="wpDval" min="0" inputmode="numeric" placeholder="Giảm giá thủ công" value="${esc(state.dval)}">
                    <select id="wpDtype"><option value="vnd" ${state.dtype === 'vnd' ? 'selected' : ''}>đ</option><option value="pct" ${state.dtype === 'pct' ? 'selected' : ''}>%</option></select>
                </div>`}
                <small class="wp-disc-note">Giảm giá được ghi Nhật ký cho Quản lý xem (giảm lớn sẽ được đánh dấu).</small>
            </div>` : '';

        let methodBox = '';
        if (state.method === 'cash') {
            methodBox = `<div class="wp-cash">
                <label for="wpGiven">Khách đưa</label>
                <input type="number" id="wpGiven" min="0" step="any" inputmode="numeric" placeholder="Nhập số tiền khách đưa" value="${esc(state.given)}">
                <div class="wp-given-fmt" id="wpGivenFmt"></div>
                <div class="wp-quick" id="wpQuick">${cashQuick(cv.total)}</div>
                <div class="wp-change">Tiền thừa: <b id="wpChange">0 đ</b></div>
            </div>`;
        } else if (state.method === 'qr') {
            methodBox = `<div class="wp-qrbox">
                <div id="wpQr" class="wp-qr"></div>
                <div class="wp-qr-amount" id="wpQrAmt">${money(cv.total)}</div>
                <div class="wp-qr-hint">Đưa mã cho khách quét. Chỉ bấm xác nhận khi đã thấy tiền về.<br><small>QR mẫu — thay bằng QR ngân hàng thật khi có tài khoản</small></div>
            </div>`;
        } else if (state.method === 'card' || state.method === 'ewallet') {
            methodBox = `<div class="wp-cash">
                <div class="wp-qr-hint" style="text-align:left;margin-bottom:8px">${state.method === 'card' ? 'Quẹt / chạm thẻ trên máy POS với số tiền' : 'Khách quét mã ví (MoMo, ZaloPay, ShopeePay…) với số tiền'} <b id="wpCardAmt">${money(cv.total)}</b>. Chỉ xác nhận khi máy báo thành công.</div>
                <label for="wpRef">Mã giao dịch / 4 số cuối thẻ (không bắt buộc)</label>
                <input type="text" id="wpRef" maxlength="30" value="${esc(state.ref)}" placeholder="Để đối soát sau này">
            </div>`;
        }

        $('wpBody').innerHTML = `
            ${bill.notReady ? `<div class="wp-warn"><i class="fa-solid fa-triangle-exclamation"></i> Còn ${bill.notReady} món chưa xong. Khách không đợi thì bấm <b>Xóa</b> ở món đó.</div>` : ''}
            <table class="wp-table"><thead><tr><th>Món</th><th class="num">SL</th><th class="num">Giá</th><th class="num">T.tiền</th><th></th></tr></thead><tbody>${itemsHtml}</tbody></table>
            ${discBox}
            <div class="wp-sum">
                <div><span>Tạm tính</span><span id="wpSub">${money(cv.sub)}</span></div>
                ${isCashier() ? `<div><span>Giảm giá</span><span id="wpDisc">-${money(cv.disc)}</span></div>` : ''}
            </div>
            <div class="ho-total"><span>Tổng thanh toán</span><b id="wpTotal">${money(cv.total)}</b></div>
            <div class="wp-methods">
                ${['cash', 'qr', 'card', 'ewallet'].map(m => `<button type="button" class="wp-method ${state.method === m ? 'on' : ''}" data-act="method" data-m="${m}"><i class="${METHOD_ICON[m]}"></i> ${METHOD_LABEL[m]}</button>`).join('')}
            </div>
            ${methodBox}
            <div class="wp-hint" id="wpHint" hidden></div>`;
        $('wpFoot').innerHTML = `<button type="button" class="ho-btn primary" id="wpSend" data-act="pay" disabled>Xác nhận thanh toán</button>
            <button type="button" class="ho-btn" data-act="back" style="margin-top:8px">Quay lại chọn bàn</button>`;

        if (state.method === 'qr') drawQr(buildQrText(t.name, cv.total));
        updateSend();
    }

    // Cập nhật số tiền / tiền thừa / nút Xác nhận mà KHÔNG vẽ lại (để ô nhập không mất con trỏ)
    function updateSend() {
        const send = $('wpSend'), hint = $('wpHint');
        if (!send) return;
        const t = readTables().find(x => x.id === state.tableId);
        if (!t) return;
        const cv = calc(billOf(t, Date.now()));
        if ($('wpSub')) $('wpSub').textContent = money(cv.sub);
        if ($('wpDisc')) $('wpDisc').textContent = '-' + money(cv.disc);
        if ($('wpTotal')) $('wpTotal').textContent = money(cv.total);
        if ($('wpQrAmt')) $('wpQrAmt').textContent = money(cv.total);
        if ($('wpCardAmt')) $('wpCardAmt').textContent = money(cv.total);
        if ($('wpQuick')) $('wpQuick').innerHTML = cashQuick(cv.total);
        let ok = false, msg = '';
        if (state.method === 'cash') {
            const given = Number(state.given) || 0;
            if ($('wpChange')) $('wpChange').textContent = money(Math.max(0, given - cv.total));
            if ($('wpGivenFmt')) $('wpGivenFmt').textContent = given > 0 ? `Khách đưa: ${money(given)}` : '';
            ok = given >= cv.total;
            msg = ok ? '' : (given ? 'Khách đưa chưa đủ tiền.' : 'Nhập số tiền khách đưa.');
        } else if (state.method) ok = true;
        else msg = 'Chọn cách thanh toán.';
        if (isCashier() && !C.currentShift()) { ok = false; msg = 'Chưa mở ca — vào "Ca & Quỹ" để mở ca trước khi thu tiền.'; }
        send.disabled = !ok;
        if (hint) { hint.hidden = !msg; hint.textContent = msg; }
    }

    // Xác nhận thanh toán: tạo hóa đơn + trả bàn
    function pay() {
        const now = Date.now();
        const list = readTables();
        const t = list.find(x => x.id === state.tableId);
        if (!t || !state.method) return;
        const bill = billOf(t, now);
        if (!bill.items.length) return;
        const cv = calc(bill);
        const given = Number(state.given) || 0;
        if (isCashier() && !C.currentShift()) return alert('Chưa mở ca. Vào "Ca & Quỹ" để mở ca trước.');
        if (state.method === 'cash' && given < cv.total) return;
        if (bill.notReady && !window.confirm(`Còn ${bill.notReady} món chưa xong. Vẫn thanh toán?`)) return;
        if (cv.disc > 0 && C.isLargeDiscount(cv.disc, cv.sub) && !window.confirm(`Giảm giá lớn: ${money(cv.disc)}. Thao tác sẽ được ghi vào Nhật ký cho Quản lý. Tiếp tục?`)) return;

        const sh = C ? C.currentShift() : null, who = C ? C.me() : { id: null, name: '' };
        const invoices = readInvoices();
        let n = invoices.length + 1, id;
        do { id = 'HD' + String(n++).padStart(3, '0'); } while (invoices.some(i => i.id === id));
        const m = state.method;
        const inv = {
            id, tableName: t.name, createdAt: new Date(now).toISOString(),
            paymentMethod: m === 'cash' ? 'cash' : (m === 'card' ? 'card' : 'transfer'), // Lịch sử/Doanh thu: QR & ví = "Chuyển khoản"
            paymentDetail: m === 'cash' ? undefined : m,
            ref: state.ref || undefined,
            items: bill.items.map(i => ({ name: i.name, qty: i.quantity, price: i.price })),
            subtotal: cv.sub, discount: cv.disc || 0, voucher: cv.code || undefined,
            total: cv.total, status: 'active',
            orderType: t.type || 'dinein', shiftId: sh ? sh.id : undefined,
            createdById: who.id, createdBy: who.name, createdRole: who.role
        };
        invoices.push(inv);
        try { if (inv.voucher) Cashier.promoUsed(inv.voucher); } catch (e) {}
        if (!writeInvoices(invoices)) { alert('Không lưu được hóa đơn. Kiểm tra lại trình duyệt rồi thử lại.'); return; }

        if (C && cv.disc > 0) {
            const large = C.isLargeDiscount(cv.disc, cv.sub);
            C.log(large ? 'discount_big' : 'discount', `Giảm ${money(cv.disc)} / ${money(cv.sub)} cho ${t.name} (${cv.code ? 'mã ' + cv.code : 'thủ công'}) — ${id}`, cv.disc, large);
        }

        t.items = (t.items || []).filter(i => !i.confirmed);
        t.total = t.items.reduce((s, i) => s + i.price * i.quantity, 0);
        releaseIfEmpty(list, t);
        writeTables(list);
        syncPageState();
        state.last = inv;
        renderPaid({ id, name: t.name, method: m, total: cv.total, given, change: given - cv.total });
    }

    function renderPaid(r) {
        state.view = 'paid';
        $('wpTitle').textContent = 'Đã thanh toán';
        $('wpBody').innerHTML = `<div class="wp-sent">
            <i class="ri-checkbox-circle-line"></i>
            <p><b>${esc(r.name)}</b> · ${METHOD_LABEL[r.method]} · ${money(r.total)}</p>
            <p>Hóa đơn <b>${esc(r.id)}</b> đã được lưu.${r.method === 'cash' ? `<br>Khách đưa ${money(r.given)} — thối lại <b>${money(r.change)}</b>` : ''}</p>
        </div>
        <div class="wp-mail"><input type="email" id="wpEmail" placeholder="Email khách (gửi hóa đơn điện tử)"><button type="button" class="wp-mini" data-act="mail">Gửi</button></div>`;
        $('wpFoot').innerHTML = `<button type="button" class="ho-btn" data-act="print" style="margin-bottom:8px"><i class="ri-printer-line"></i> In hóa đơn</button>
            <button type="button" class="ho-btn primary" data-act="close">Xong</button>`;
    }

    function onClick(e) {
        const b = e.target.closest('[data-act]');
        if (!b) { if (e.target.id === 'wpBackdrop') close(); return; }
        const act = b.dataset.act;
        if (act === 'pick') { state.view = 'bill'; state.tableId = Number(b.dataset.id); resetPay(); renderBill(); }
        else if (act === 'back') { state.view = 'list'; renderList(); }
        else if (act === 'method') { state.method = b.dataset.m; renderBill(); }
        else if (act === 'quick') {
            state.given = b.dataset.exact ? String(b.dataset.v) : String((Number(state.given) || 0) + Number(b.dataset.v));
            const i = $('wpGiven'); if (i) i.value = state.given; updateSend();
        }
        else if (act === 'clear') { state.given = ''; const i = $('wpGiven'); if (i) i.value = ''; updateSend(); }
        else if (act === 'voucher') {
            const t = readTables().find(x => x.id === state.tableId);
            const v = t && C.applyVoucher($('wpCode').value, billOf(t, Date.now()).total);
            if (!v) return alert('Mã khuyến mãi không hợp lệ.');
            state.voucher = v; state.code = v.code; state.dval = ''; renderBill();
        }
        else if (act === 'unvoucher') { state.voucher = null; state.code = ''; renderBill(); }
        else if (act === 'dec') {
            const t = readTables().find(x => x.id === state.tableId);
            const last = t && billOf(t, Date.now()).count === 1;
            if (last && !window.confirm('Xóa món cuối cùng sẽ hủy đơn của bàn này. Tiếp tục?')) return;
            removeOne(state.tableId, b.dataset.line);
            renderBill();
        }
        else if (act === 'void') {
            const reason = (window.prompt('Hủy món ĐÃ LÀM XONG — nhập lý do (bắt buộc, sẽ ghi Nhật ký cho Quản lý):') || '').trim();
            if (!reason) return alert('Chưa nhập lý do — chưa hủy món.');
            removeOne(state.tableId, b.dataset.line, reason);
            renderBill();
        }
        else if (act === 'pay') pay();
        else if (act === 'print') { if (state.last) C.printReceipt(state.last); }
        else if (act === 'mail') {
            const em = ($('wpEmail').value || '').trim();
            if (!/^\S+@\S+\.\S+$/.test(em)) return alert('Email chưa hợp lệ.');
            window.location.href = `mailto:${encodeURIComponent(em)}?subject=${encodeURIComponent('Hóa đơn ' + state.last.id)}&body=${encodeURIComponent(C.receiptText(state.last))}`;
        }
        else if (act === 'close') close();
    }

    function build() {
        if ($('wpBackdrop')) return;
        const wrap = document.createElement('div');
        wrap.className = 'ho-backdrop';
        wrap.id = 'wpBackdrop';
        wrap.innerHTML = `
            <div class="ho-modal wp-modal" role="dialog" aria-label="Thanh toán">
                <div class="ho-head">
                    <h3 id="wpTitle">Thanh toán</h3>
                    <button type="button" class="ho-x" data-act="close" aria-label="Đóng">&times;</button>
                </div>
                <div class="ho-body" id="wpBody"></div>
                <div class="ho-foot" id="wpFoot"></div>
            </div>`;
        document.body.appendChild(wrap);
        wrap.addEventListener('click', onClick);
        wrap.addEventListener('input', e => {
            const id = e.target.id;
            if (id === 'wpGiven') state.given = e.target.value;
            else if (id === 'wpRef') state.ref = e.target.value;
            else if (id === 'wpCode') state.code = e.target.value;
            else if (id === 'wpDval') state.dval = e.target.value;
            else return;
            updateSend();
        });
        wrap.addEventListener('change', e => { if (e.target.id === 'wpDtype') { state.dtype = e.target.value; updateSend(); } });
        document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    }

    // open() = chọn bàn; open(tableId) = vào thẳng hóa đơn của bàn/đơn đó
    function open(tableId) {
        build();
        state.view = 'list'; state.tableId = null; resetPay();
        $('wpBackdrop').classList.add('active');
        if ($('navPay')) $('navPay').classList.add('active');
        if (timer) clearInterval(timer);
        const t = tableId != null ? readTables().find(x => x.id === tableId) : null;
        if (t && billOf(t, Date.now()).items.length) { state.view = 'bill'; state.tableId = t.id; renderBill(); }
        else renderList();
        timer = setInterval(() => { if (state.view === 'list') renderList(); }, 2000);
    }

    window.WaiterPay = { open };
})();
