// ============================================================
// shift.js — CA & QUỸ TIỀN MẶT (Shift.html, Thu ngân)
// ------------------------------------------------------------
// 1) MỞ CA: nhập tiền đầu ca. Phải mở ca mới thu tiền được (xem waiter-pay.js).
// 2) TRONG CA: thống kê doanh thu / số đơn (cả ca + riêng thu ngân đang đăng nhập), tiền mặt trong két
//    = đầu ca + bán tiền mặt + thu − chi. Ghi THU / CHI (mua đá, đồ lặt vặt, tiền tip...).
// 3) KẾT CA: nhập tiền đếm thực tế -> hệ thống so với tiền theo sổ. Lệch thì BẮT BUỘC ghi lý do,
//    vẫn cho kết ca, và ghi Nhật ký (đánh dấu) cho Quản lý xem. Sau đó hiện / in BÁO CÁO KẾT CA.
// Dữ liệu: 'coffee_cashshift_v1' (xem cashier-core.js).
// ============================================================
(function () {
    'use strict';
    const C = window.Cashier;
    const session = AuthAPI.getSession();
    if (!session) { window.location.replace('Login.html'); return; }
    if (session.roleKey !== 'cashier') { const p = PAGES_BY_ROLE[session.roleKey]; window.location.replace(p ? p[0].path : 'Login.html'); return; }

    const $ = id => document.getElementById(id);
    const { esc, money, fmtTime, fmtDT } = C;
    let reportShift = null;

    const card = (label, val, sub, cls) => `<div class="cs-card ${cls || ''}"><span>${label}</span><b>${val}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;

    function viewReport(sh) {
        reportShift = sh;
        $('shReport').innerHTML = C.shiftReportHtml(sh);
        $('shModal').classList.add('active');
    }

    function renderOpenForm(el) {
        const st = C.shiftStore();
        el.innerHTML = `<div class="cs-panel"><h3>Mở ca</h3>
            <p class="cs-note" style="margin:0 0 12px">Chưa có ca nào đang mở. Đếm tiền trong két rồi nhập số tiền đầu ca để bắt đầu bán hàng.</p>
            <div class="cs-form">
                <label>Tiền đầu ca (đ)<input type="number" id="openCash" min="0" inputmode="numeric" placeholder="vd: 500000"></label>
                <button class="cs-btn" id="btnOpen">Mở ca</button>
            </div><p class="cs-msg" id="openMsg" hidden></p></div>${historyHtml(st)}`;
        $('btnOpen').onclick = () => {
            const r = C.openShift($('openCash').value);
            if (!r.ok) { $('openMsg').textContent = r.error; $('openMsg').hidden = false; return; }
            render();
        };
    }

    function historyHtml(st) {
        const me = C.me();
        const mine = st.history.filter(s => String(s.cashierId) === String(me.id) || String(s.closedById) === String(me.id)).slice(-8).reverse();
        return `<div class="cs-panel"><h3>Báo cáo các ca gần đây</h3>
            ${mine.length ? `<div class="data-table-wrapper"><table class="data-table"><thead><tr><th>Ca</th><th>Thời gian</th><th>Số đơn</th><th>Doanh thu</th><th>Chênh lệch</th><th></th></tr></thead><tbody>
            ${mine.map(s => `<tr><td>${esc(s.cashierName)}</td><td>${fmtDT(s.openedAt)} → ${fmtTime(s.closedAt)}</td><td>${s.summary.orders}</td><td>${money(s.summary.revenue)}</td>
              <td style="color:${s.diff ? '#b5573c' : '#2c7046'};font-weight:600">${s.diff > 0 ? '+' : ''}${money(s.diff)}</td>
              <td><button class="btn-outline" data-rep="${s.id}">Xem / In</button></td></tr>`).join('')}</tbody></table></div>`
            : '<p class="cs-note">Chưa có ca nào đã kết.</p>'}</div>`;
    }

    function renderOpen(el, sh) {
        const all = C.stats(sh), mine = C.stats(sh, true);
        const st = C.shiftStore();
        const movs = (sh.movements || []).slice().reverse();
        el.innerHTML = `
            <div class="cs-grid">
                ${card('Ca đang mở', esc(sh.cashierName), `Từ ${fmtTime(sh.openedAt)} • đầu ca ${money(sh.openingCash)}`)}
                ${card('Doanh thu của bạn', money(mine.revenue), `${mine.orders} đơn • giảm giá ${money(mine.discount)}`, 'ok')}
                ${card('Doanh thu cả ca', money(all.revenue), `${all.orders} đơn (tại quán ${all.byType.dinein || 0}, mang đi ${all.byType.takeaway || 0}, giao ${all.byType.delivery || 0})`)}
                ${card('Tiền mặt trong két (theo sổ)', money(all.expectedCash), `Đầu ca ${money(sh.openingCash)} + bán ${money(all.cashSales)} + thu ${money(all.cashIn)} − chi ${money(all.cashOut)}`, 'ok')}
            </div>
            <div class="cs-grid">
                ${card('Tiền mặt', money(all.by.cash))}${card('Chuyển khoản / QR', money(all.by.qr))}${card('Thẻ', money(all.by.card))}${card('Ví điện tử', money(all.by.ewallet))}
                ${card('Hóa đơn hủy / hoàn', `${all.cancelledCount}`, money(all.cancelledTotal), all.cancelledCount ? 'warn' : '')}
            </div>

            <div class="cs-panel"><h3>Thu / chi trong ca</h3>
                <div class="cs-form">
                    <label>Loại<select id="mvKind"><option value="out">Chi (lấy tiền từ két)</option><option value="in">Thu (bỏ tiền vào két)</option></select></label>
                    <label>Danh mục<select id="mvCat"></select></label>
                    <label>Số tiền (đ)<input type="number" id="mvAmt" min="0" inputmode="numeric"></label>
                    <label style="flex:2 1 220px">Ghi chú (bắt buộc)<input type="text" id="mvNote" maxlength="80" placeholder="vd: mua 3 bao đá"></label>
                    <button class="cs-btn" id="btnMv">Ghi sổ</button>
                </div><p class="cs-msg" id="mvMsg" hidden></p>
                ${movs.length ? `<div class="data-table-wrapper" style="margin-top:12px"><table class="data-table"><thead><tr><th>Giờ</th><th>Loại</th><th>Nội dung</th><th>Số tiền</th><th>Người ghi</th></tr></thead><tbody>
                ${movs.map(m => `<tr><td>${fmtTime(m.time)}</td><td>${m.kind === 'in' ? 'Thu' : 'Chi'} — ${esc(m.category)}</td><td>${esc(m.note)}</td><td style="color:${m.kind === 'in' ? '#2c7046' : '#b5573c'};font-weight:600">${m.kind === 'in' ? '+' : '−'}${money(m.amount)}</td><td>${esc(m.by)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="cs-note">Chưa có khoản thu / chi nào trong ca.</p>'}
                <p class="cs-note">Thu/chi lớn (từ 200.000đ) được đánh dấu trong Nhật ký của Quản lý.</p>
            </div>

            <div class="cs-panel"><h3>Kết ca</h3>
                <p class="cs-note" style="margin:0 0 10px">Đếm tiền mặt thực tế trong két rồi nhập vào. Hệ thống đang ghi: <b>${money(all.expectedCash)}</b>.</p>
                <div class="cs-form">
                    <label>Tiền đếm thực tế (đ)<input type="number" id="cntCash" min="0" inputmode="numeric"></label>
                </div>
                <div class="cs-diff" id="cntDiff"></div>
                <div class="cs-form" id="reasonBox" style="margin-top:10px" hidden>
                    <label style="flex:1 1 100%">Lý do chênh lệch (bắt buộc)<textarea id="cntReason" rows="2" maxlength="200" placeholder="vd: trả nhầm tiền thối cho khách bàn 3"></textarea></label>
                </div>
                <div style="margin-top:12px"><button class="cs-btn danger" id="btnClose" disabled>Kết ca & in báo cáo</button></div>
                <p class="cs-msg" id="clMsg" hidden></p>
                <p class="cs-note">Nếu tiền lệch vẫn kết ca được, nhưng phải ghi lý do; chênh lệch sẽ hiện trong Nhật ký của Quản lý.</p>
            </div>
            ${historyHtml(st)}`;

        // thu / chi
        const fillCat = () => { $('mvCat').innerHTML = C.CATEGORIES[$('mvKind').value].map(c => `<option>${c}</option>`).join(''); };
        fillCat(); $('mvKind').onchange = fillCat;
        $('btnMv').onclick = () => {
            const r = C.addMovement($('mvKind').value, $('mvCat').value, $('mvAmt').value, $('mvNote').value);
            if (!r.ok) { $('mvMsg').textContent = r.error; $('mvMsg').hidden = false; return; }
            render();
        };
        // kết ca
        const upd = () => {
            const raw = $('cntCash').value;
            if (raw === '') { $('cntDiff').textContent = ''; $('reasonBox').hidden = true; $('btnClose').disabled = true; return; }
            const diff = Math.round(Number(raw)) - all.expectedCash;
            $('cntDiff').className = 'cs-diff ' + (diff === 0 ? 'ok' : 'bad');
            $('cntDiff').textContent = diff === 0 ? 'Khớp với hệ thống.' : `Chênh lệch: ${diff > 0 ? '+' : '−'}${money(Math.abs(diff))} (${diff > 0 ? 'thừa' : 'thiếu'})`;
            $('reasonBox').hidden = diff === 0;
            $('btnClose').disabled = diff !== 0 && !$('cntReason').value.trim();
        };
        $('cntCash').oninput = upd; $('cntReason').oninput = upd;
        $('btnClose').onclick = () => {
            if (!confirm('Kết ca? Sau khi kết ca sẽ không thu tiền được cho đến khi mở ca mới.')) return;
            const r = C.closeShift($('cntCash').value, $('cntReason').value);
            if (!r.ok) { $('clMsg').textContent = r.error; $('clMsg').hidden = false; return; }
            render(); viewReport(r.shift);
        };
    }

    function render() {
        const sh = C.currentShift(), el = $('shRoot');
        $('shSub').textContent = sh ? `Đang mở ca của ${sh.cashierName} từ ${fmtTime(sh.openedAt)}` : 'Chưa mở ca';
        if (sh) renderOpen(el, sh); else renderOpenForm(el);
    }

    document.addEventListener('DOMContentLoaded', () => {
        $('shClose').onclick = () => $('shModal').classList.remove('active');
        $('shPrint').onclick = () => { if (reportShift) C.printHtml('Báo cáo kết ca', C.shiftReportHtml(reportShift)); };
        $('shRoot').addEventListener('click', e => {
            const b = e.target.closest('[data-rep]'); if (!b) return;
            const s = C.shiftStore().history.find(x => x.id === b.dataset.rep); if (s) viewReport(s);
        });
        render();
        // cập nhật số liệu khi có hóa đơn mới (ở tab khác) — không vẽ lại khi đang gõ
        window.addEventListener('storage', e => {
            if ([C.K.INV, C.K.SHIFT].includes(e.key) && !(document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) render();
        });
    });
})();
