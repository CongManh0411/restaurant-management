// ============================================================
// cashier-core.js — LÕI DÙNG CHUNG CỦA THU NGÂN (window.Cashier)
// ------------------------------------------------------------
// Nạp ở: Table.html, Orders.html, Shift.html, Schedule.html, Logs.html.
// Không tự chạy gì — chỉ cung cấp hàm cho waiter-pay.js, table-order.js, orders.js, shift.js, logs.js.
//
// DỮ LIỆU (localStorage):
//   'coffee_cashshift_v1' : { current: Ca|null, history: [Ca...] }
//        Ca = { id, cashierId, cashierName, openedAt, openingCash,
//               movements:[{id,time,kind:'in'|'out',category,amount,note,by}],
//               closedAt, closedBy, countedCash, expectedCash, diff, reason, summary }
//   'coffee_logs_v1'      : [{ id, time, actorId, actorName, role, type, text, amount, flag }]
//   'coffee_soldout_v1'   : [menuId, ...]   (món tạm hết hàng)
//   'qlcp_invoices'       : hóa đơn (dùng chung với Lịch sử / Doanh thu) — thêm các trường:
//        shiftId, createdById, createdBy, orderType, subtotal, discount, voucher, paymentDetail, ref
//
// KHI NỐI BACKEND: thay các hàm read()/write() bên dưới bằng gọi API.
// ============================================================
(function () {
    'use strict';
    if (window.Cashier) return;

    const K = { SHIFT: 'coffee_cashshift_v1', LOGS: 'coffee_logs_v1', SOLD: 'coffee_soldout_v1', INV: 'qlcp_invoices' };

    // ---- CẤU HÌNH (quản lý có thể chỉnh trực tiếp ở đây) ----
    const VOUCHERS = {                      // mã khuyến mãi: type 'pct' (%) hoặc 'vnd' (đ)
        GIAM10:   { type: 'pct', value: 10,    label: 'Giảm 10%' },
        GIAM20:   { type: 'pct', value: 20,    label: 'Giảm 20%' },
        GIAM5K:   { type: 'vnd', value: 5000,  label: 'Giảm 5.000đ' },
        GIAM20K:  { type: 'vnd', value: 20000, label: 'Giảm 20.000đ' },
    };
    const LARGE_DISCOUNT_PCT = 20;          // giảm >= 20% hóa đơn  -> đánh dấu "giảm giá lớn" trong Nhật ký
    const LARGE_DISCOUNT_VND = 50000;       // hoặc giảm >= 50.000đ -> đánh dấu "giảm giá lớn"
    const BIG_ADJUST_VND = 200000;          // thu/chi quỹ >= 200.000đ -> đánh dấu trong Nhật ký

    const ORDER_TYPES = { dinein: 'Uống tại quán', takeaway: 'Mang đi', delivery: 'Giao hàng' };
    const METHODS = { cash: 'Tiền mặt', qr: 'Chuyển khoản / QR', card: 'Thẻ', ewallet: 'Ví điện tử' };
    const CATEGORIES = { in: ['Tiền tip', 'Thu khác'], out: ['Mua đá', 'Đồ lặt vặt', 'Chi khác'] };

    // ---- tiện ích ----
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const money = n => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' đ';
    const pad = n => String(n).padStart(2, '0');
    const fmtTime = iso => { const d = new Date(iso); return isNaN(d) ? '—' : `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
    const fmtDT = iso => { const d = new Date(iso); return isNaN(d) ? '—' : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${fmtTime(iso)}`; };
    const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
    const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { alert('Không lưu được dữ liệu. Kiểm tra lại trình duyệt.'); return false; } };
    const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

    function session() { try { return (typeof AuthAPI !== 'undefined' && AuthAPI.getSession()) || null; } catch (e) { return null; } }
    function me() {
        const s = session() || {};
        return { id: s.staffId ?? null, name: s.name || 'Không rõ', role: s.roleKey || '' };
    }
    const isCashier = () => me().role === 'cashier';

    // ---------- NHẬT KÝ THAO TÁC (Quản lý xem ở Logs.html) ----------
    function log(type, text, amount, flag) {
        const a = me();
        const list = read(K.LOGS, []);
        list.push({ id: uid('L'), time: new Date().toISOString(), actorId: a.id, actorName: a.name, role: a.role, type, text, amount: Number(amount) || 0, flag: !!flag });
        if (list.length > 3000) list.splice(0, list.length - 3000);
        write(K.LOGS, list);
    }
    const LOG_TYPES = {
        discount: 'Giảm giá', discount_big: 'Giảm giá lớn', void_item: 'Hủy món', void_done: 'Hủy món đã làm',
        refund: 'Hoàn tiền', cash_in: 'Thu quỹ', cash_out: 'Chi quỹ', shift_open: 'Mở ca', shift_close: 'Kết ca',
        shift_diff: 'Chênh lệch kết ca', soldout: 'Hết món', cancel_order: 'Hủy đơn'
    };

    // ---------- CA LÀM (mở ca / kết ca) ----------
    const shiftStore = () => { const s = read(K.SHIFT, null); return s && typeof s === 'object' ? { current: s.current || null, history: s.history || [] } : { current: null, history: [] }; };
    const saveShiftStore = s => write(K.SHIFT, s);
    const currentShift = () => shiftStore().current;

    function openShift(openingCash) {
        const st = shiftStore();
        if (st.current) return { ok: false, error: `Ca của ${st.current.cashierName} đang mở (từ ${fmtTime(st.current.openedAt)}). Hãy kết ca đó trước.` };
        openingCash = Math.round(Number(openingCash));
        if (!(openingCash >= 0)) return { ok: false, error: 'Tiền đầu ca không hợp lệ.' };
        const a = me();
        st.current = { id: uid('CA'), cashierId: a.id, cashierName: a.name, openedAt: new Date().toISOString(), openingCash, movements: [] };
        saveShiftStore(st);
        log('shift_open', `Mở ca với tiền đầu ca ${money(openingCash)}`, openingCash);
        return { ok: true, shift: st.current };
    }

    function addMovement(kind, category, amount, note) {
        const st = shiftStore();
        if (!st.current) return { ok: false, error: 'Chưa mở ca.' };
        amount = Math.round(Number(amount));
        if (!(amount > 0)) return { ok: false, error: 'Số tiền phải lớn hơn 0.' };
        if (!note || !String(note).trim()) return { ok: false, error: 'Vui lòng ghi chú nội dung thu/chi.' };
        if (kind === 'out' && amount > stats(st.current).expectedCash) return { ok: false, error: 'Số tiền chi lớn hơn tiền mặt đang có trong két.' };
        const a = me();
        st.current.movements.push({ id: uid('M'), time: new Date().toISOString(), kind, category, amount, note: String(note).trim(), by: a.name });
        saveShiftStore(st);
        log(kind === 'in' ? 'cash_in' : 'cash_out', `${kind === 'in' ? 'Thu' : 'Chi'} quỹ — ${category}: ${String(note).trim()}`, amount, amount >= BIG_ADJUST_VND);
        return { ok: true };
    }

    // Phương thức của 1 hóa đơn -> 'cash' | 'qr' | 'card' | 'ewallet'
    const methodKey = i => i.paymentMethod === 'cash' ? 'cash' : (i.paymentDetail || (i.paymentMethod === 'card' ? 'card' : 'qr'));

    // Thống kê 1 ca (mine = true: chỉ hóa đơn do người đang đăng nhập tạo)
    function stats(shift, mine) {
        const a = me();
        let inv = read(K.INV, []).filter(i => i.shiftId === shift.id);
        if (mine) inv = inv.filter(i => String(i.createdById) === String(a.id));
        const active = inv.filter(i => i.status === 'active');
        const cancelled = inv.filter(i => i.status === 'cancelled');
        const by = { cash: 0, qr: 0, card: 0, ewallet: 0 };
        const byType = { dinein: 0, takeaway: 0, delivery: 0 };
        let revenue = 0, discount = 0;
        active.forEach(i => {
            revenue += i.total; discount += Number(i.discount) || 0;
            by[methodKey(i)] = (by[methodKey(i)] || 0) + i.total;
            byType[i.orderType || 'dinein'] = (byType[i.orderType || 'dinein'] || 0) + 1;
        });
        // tiền mặt thực thu của cả ca (không phụ thuộc "mine") để tính két
        const allActive = read(K.INV, []).filter(i => i.shiftId === shift.id && i.status === 'active');
        const cashSales = allActive.filter(i => methodKey(i) === 'cash').reduce((s, i) => s + i.total, 0);
        const mv = shift.movements || [];
        const cashIn = mv.filter(m => m.kind === 'in').reduce((s, m) => s + m.amount, 0);
        const cashOut = mv.filter(m => m.kind === 'out').reduce((s, m) => s + m.amount, 0);
        return {
            orders: active.length, revenue, discount, by, byType,
            cancelledCount: cancelled.length, cancelledTotal: cancelled.reduce((s, i) => s + i.total, 0),
            cashSales, cashIn, cashOut,
            expectedCash: shift.openingCash + cashSales + cashIn - cashOut
        };
    }

    function closeShift(countedCash, reason) {
        const st = shiftStore();
        if (!st.current) return { ok: false, error: 'Chưa mở ca.' };
        countedCash = Math.round(Number(countedCash));
        if (!(countedCash >= 0)) return { ok: false, error: 'Tiền đếm thực tế không hợp lệ.' };
        const s = st.current, sm = stats(s), diff = countedCash - sm.expectedCash;
        if (diff !== 0 && !(reason && String(reason).trim())) return { ok: false, error: 'Tiền đếm lệch so với hệ thống — bắt buộc ghi lý do.' };
        const a = me();
        const done = Object.assign({}, s, {
            closedAt: new Date().toISOString(), closedBy: a.name, closedById: a.id,
            countedCash, expectedCash: sm.expectedCash, diff, reason: diff !== 0 ? String(reason).trim() : '', summary: sm
        });
        st.history.push(done); st.current = null; saveShiftStore(st);
        log('shift_close', `Kết ca ${fmtTime(done.openedAt)}–${fmtTime(done.closedAt)}: doanh thu ${money(sm.revenue)}, ${sm.orders} đơn`, sm.revenue);
        if (diff !== 0) log('shift_diff', `Tiền đếm ${money(countedCash)} so với hệ thống ${money(sm.expectedCash)} (${diff > 0 ? 'thừa' : 'thiếu'} ${money(Math.abs(diff))}). Lý do: ${done.reason}`, Math.abs(diff), true);
        return { ok: true, shift: done };
    }

    // ---------- KHUYẾN MÃI / GIẢM GIÁ ----------
    // Mã do Quản lý tạo ở Ops.html (key coffee_promos_v1): có hạn dùng, giới hạn lượt, khung giờ (happy hour)
    function promoFor(c) {
        const p = (read('coffee_promos_v1', []) || []).find(x => x.code === c && x.active !== false);
        if (!p) return null;
        const now = new Date(), d = now.toISOString().slice(0, 10), h = now.getHours();
        if ((p.from && d < p.from) || (p.to && d > p.to)) return null;
        if (p.maxUses && (p.used || 0) >= p.maxUses) return null;
        if (p.hourFrom !== '' && p.hourFrom != null && p.hourTo !== '' && p.hourTo != null && (h < +p.hourFrom || h >= +p.hourTo)) return null;
        return { type: p.type, value: +p.value, label: p.label || p.code };
    }
    function promoUsed(c) {
        const l = read('coffee_promos_v1', []), p = l.find(x => x.code === String(c).toUpperCase());
        if (p) { p.used = (p.used || 0) + 1; write('coffee_promos_v1', l); }
    }
    function applyVoucher(code, subtotal) {
        const c0 = String(code || '').trim().toUpperCase();
        const v = VOUCHERS[c0] || promoFor(c0);
        if (!v) return null;
        const amt = v.type === 'pct' ? Math.round(subtotal * v.value / 100) : v.value;
        return { code: String(code).trim().toUpperCase(), label: v.label, type: v.type, value: v.value, amount: Math.min(subtotal, amt) };
    }
    function manualDiscount(type, value, subtotal) {
        value = Math.max(0, Number(value) || 0);
        const amt = type === 'pct' ? Math.round(subtotal * Math.min(value, 100) / 100) : value;
        return Math.min(subtotal, amt);
    }
    function isLargeDiscount(amount, subtotal) {
        return amount > 0 && (amount >= LARGE_DISCOUNT_VND || (subtotal > 0 && amount / subtotal * 100 >= LARGE_DISCOUNT_PCT));
    }

    // ---------- HẾT MÓN ----------
    const soldOutIds = () => read(K.SOLD, []);
    function setSoldOut(id, name, flag) {
        let l = soldOutIds().filter(x => x !== id);
        if (flag) l.push(id);
        write(K.SOLD, l);
        log('soldout', `${flag ? 'Đánh dấu HẾT' : 'Mở bán lại'}: ${name}`, 0);
    }

    // ---------- IN / GỬI HÓA ĐƠN ----------
    function receiptText(inv) {
        const lines = [`QUÁN CÀ PHÊ — HÓA ĐƠN ${inv.id}`, `${inv.tableName} • ${ORDER_TYPES[inv.orderType || 'dinein']} • ${fmtDT(inv.createdAt)}`, ''];
        inv.items.forEach(i => lines.push(`${i.name} x${i.qty}  ${money(i.price * i.qty)}`));
        lines.push('', `Tạm tính: ${money(inv.subtotal ?? inv.total)}`);
        if (inv.discount) lines.push(`Giảm giá${inv.voucher ? ' (' + inv.voucher + ')' : ''}: -${money(inv.discount)}`);
        lines.push(`THÀNH TIỀN: ${money(inv.total)}`, `Thanh toán: ${METHODS[methodKey(inv)]}`, 'Cảm ơn quý khách!');
        return lines.join('\n');
    }
    function receiptHtml(inv) {
        const rows = inv.items.map(i => `<tr><td>${esc(i.name)} x${i.qty}</td><td style="text-align:right">${money(i.price * i.qty)}</td></tr>`).join('');
        return `<h2 style="text-align:center;margin:0">Quán cà phê</h2>
            <p style="text-align:center;margin:4px 0 10px;font-size:12px">HÓA ĐƠN ${esc(inv.id)}<br>${esc(inv.tableName)} • ${esc(ORDER_TYPES[inv.orderType || 'dinein'])}<br>${fmtDT(inv.createdAt)}${inv.createdBy ? '<br>Thu ngân: ' + esc(inv.createdBy) : ''}</p>
            <table style="width:100%;font-size:13px;border-collapse:collapse">${rows}</table><hr>
            <p style="font-size:13px;margin:4px 0">Tạm tính: <b>${money(inv.subtotal ?? inv.total)}</b>
            ${inv.discount ? `<br>Giảm giá${inv.voucher ? ' (' + esc(inv.voucher) + ')' : ''}: <b>-${money(inv.discount)}</b>` : ''}
            <br>Thành tiền: <b style="font-size:16px">${money(inv.total)}</b><br>Thanh toán: ${esc(METHODS[methodKey(inv)])}</p>
            <p style="text-align:center;font-size:12px">Cảm ơn quý khách!</p>`;
    }
    function printHtml(title, bodyHtml) {
        const w = window.open('', '_blank', 'width=420,height=640');
        if (!w) { alert('Trình duyệt đang chặn cửa sổ in. Hãy cho phép pop-up rồi thử lại.'); return; }
        w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
            <style>body{font-family:Arial,sans-serif;max-width:360px;margin:12px auto;color:#111}td,th{padding:3px 0}</style></head><body>${bodyHtml}</body></html>`);
        w.document.close(); w.focus();
        setTimeout(() => { try { w.print(); } catch (e) {} }, 250);
    }
    const printReceipt = inv => printHtml('Hóa đơn ' + inv.id, receiptHtml(inv));

    // Báo cáo kết ca (HTML) — dùng cho cả xem trên màn hình và in
    function shiftReportHtml(sh) {
        const s = sh.summary || stats(sh);
        const mv = (sh.movements || []).map(m => `<tr><td>${fmtTime(m.time)}</td><td>${m.kind === 'in' ? 'Thu' : 'Chi'} — ${esc(m.category)}${m.note ? ': ' + esc(m.note) : ''}</td><td style="text-align:right">${m.kind === 'in' ? '+' : '-'}${money(m.amount)}</td></tr>`).join('');
        const diff = sh.diff || 0;
        return `<h2 style="text-align:center;margin:0">BÁO CÁO KẾT CA</h2>
            <p style="text-align:center;font-size:12px;margin:4px 0 10px">${esc(sh.cashierName)} • ${fmtDT(sh.openedAt)}${sh.closedAt ? ' → ' + fmtTime(sh.closedAt) : ''}</p>
            <table style="width:100%;font-size:13px;border-collapse:collapse">
                <tr><td>Số đơn</td><td style="text-align:right">${s.orders}</td></tr>
                <tr><td>Doanh thu</td><td style="text-align:right"><b>${money(s.revenue)}</b></td></tr>
                <tr><td>&nbsp;&nbsp;Tiền mặt</td><td style="text-align:right">${money(s.by.cash)}</td></tr>
                <tr><td>&nbsp;&nbsp;Chuyển khoản / QR</td><td style="text-align:right">${money(s.by.qr)}</td></tr>
                <tr><td>&nbsp;&nbsp;Thẻ</td><td style="text-align:right">${money(s.by.card)}</td></tr>
                <tr><td>&nbsp;&nbsp;Ví điện tử</td><td style="text-align:right">${money(s.by.ewallet)}</td></tr>
                <tr><td>Tổng giảm giá</td><td style="text-align:right">${money(s.discount)}</td></tr>
                <tr><td>Hóa đơn hủy / hoàn</td><td style="text-align:right">${s.cancelledCount} (${money(s.cancelledTotal)})</td></tr>
            </table><hr>
            <table style="width:100%;font-size:13px;border-collapse:collapse">
                <tr><td>Tiền đầu ca</td><td style="text-align:right">${money(sh.openingCash)}</td></tr>
                <tr><td>+ Bán tiền mặt</td><td style="text-align:right">${money(s.cashSales)}</td></tr>
                <tr><td>+ Thu quỹ</td><td style="text-align:right">${money(s.cashIn)}</td></tr>
                <tr><td>− Chi quỹ</td><td style="text-align:right">${money(s.cashOut)}</td></tr>
                <tr><td><b>Tiền mặt theo hệ thống</b></td><td style="text-align:right"><b>${money(sh.expectedCash ?? s.expectedCash)}</b></td></tr>
                ${sh.closedAt ? `<tr><td>Tiền đếm thực tế</td><td style="text-align:right">${money(sh.countedCash)}</td></tr>
                <tr><td><b>Chênh lệch</b></td><td style="text-align:right"><b style="color:${diff === 0 ? '#2c7046' : '#c0392b'}">${diff > 0 ? '+' : ''}${money(diff)}</b></td></tr>` : ''}
            </table>
            ${sh.reason ? `<p style="font-size:13px"><b>Lý do chênh lệch:</b> ${esc(sh.reason)}</p>` : ''}
            ${mv ? `<hr><p style="font-size:13px;margin:4px 0"><b>Thu / chi trong ca</b></p><table style="width:100%;font-size:12px;border-collapse:collapse">${mv}</table>` : ''}`;
    }

    window.Cashier = {
        K, VOUCHERS, ORDER_TYPES, METHODS, CATEGORIES, LOG_TYPES,
        esc, money, pad, fmtTime, fmtDT, read, write, uid, me, isCashier, session,
        log, currentShift, shiftStore, openShift, addMovement, closeShift, stats, methodKey,
        applyVoucher, promoUsed, manualDiscount, isLargeDiscount,
        soldOutIds, setSoldOut,
        receiptText, receiptHtml, printReceipt, printHtml, shiftReportHtml
    };
})();
