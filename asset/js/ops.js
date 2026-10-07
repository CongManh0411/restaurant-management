// ops.js — Vận hành: đặt bàn/hàng chờ, khách thân thiết (CRM), khuyến mãi, kho nâng cao, giao hàng.
// Dữ liệu lưu localStorage (demo). Khi có backend: thay read()/write() bằng gọi API.
const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => Math.round(n || 0).toLocaleString('vi-VN') + ' đ';
const K = { RES: 'coffee_reservations_v1', WAIT: 'coffee_waitlist_v1', CRM: 'coffee_customers_v1', PROMO: 'coffee_promos_v1', SUP: 'coffee_suppliers_v1', MOV: 'coffee_stockmoves_v1', DELIV: 'coffee_delivery_v1', WH: 'coffee_warehouse_v1', INV: 'qlcp_invoices' };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const val = id => (document.getElementById(id) || {}).value || '';
const body = () => document.getElementById('opsBody');
let tab = 'res';

function field(id, ph, type = 'text', extra = '') { return `<input id="${id}" type="${type}" placeholder="${ph}" ${extra}>`; }
function table(heads, rows) {
    if (!rows.length) return '<div class="ops-empty">Chưa có dữ liệu.</div>';
    return `<div class="ops-scroll"><table class="ops-table"><tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</table></div>`;
}
const btn = (fn, arg, label, cls = '') => `<button class="ops-btn sm ${cls}" onclick="${fn}('${arg}')">${label}</button>`;

/* ---------- ĐẶT BÀN & HÀNG CHỜ ---------- */
function tableNames() { return (read('coffee_tables_v1', []) || []).filter(t => !t.type).map(t => t.name); }
function viewRes() {
    const res = read(K.RES, []).sort((a, b) => a.time.localeCompare(b.time)), wait = read(K.WAIT, []);
    const dupTable = (r) => res.some(o => o.id !== r.id && o.table && o.table === r.table && o.time.slice(0, 13) === r.time.slice(0, 13) && o.status === 'Đã đặt');
    return `<div class="ops-card"><h3>Đặt bàn</h3><div class="ops-form">${field('rName', 'Tên khách')}${field('rPhone', 'SĐT')}${field('rPax', 'Số người', 'number', 'min=1')}${field('rTime', '', 'datetime-local')}
        <select id="rTable"><option value="">-- Chọn bàn --</option>${tableNames().map(n => `<option>${esc(n)}</option>`).join('')}</select>${field('rNote', 'Ghi chú')}<button onclick="addRes()">Giữ chỗ</button></div>
        ${table(['Khách', 'SĐT', 'Người', 'Giờ', 'Bàn', 'Trạng thái', ''], res.map(r => [esc(r.name), esc(r.phone), r.pax, r.time.replace('T', ' '), esc(r.table || '—') + (dupTable(r) ? ' <span class="ops-warn">trùng!</span>' : ''), `<span class="ops-tag">${r.status}</span>`, r.status === 'Đã đặt' ? btn('resSet', r.id + '|Đã đến', 'Đã đến', 'green') + btn('resSet', r.id + '|Hủy', 'Hủy', 'red') + btn('resSet', r.id + '|Không đến', 'Không đến') : '']))}</div>
        <div class="ops-card"><h3>Hàng chờ (khách vãng lai)</h3><div class="ops-form">${field('wName', 'Tên khách')}${field('wPax', 'Số người', 'number', 'min=1')}${field('wPhone', 'SĐT')}<button onclick="addWait()">Thêm vào hàng chờ</button></div>
        ${table(['#', 'Khách', 'Người', 'Chờ', ''], wait.map((w, i) => [i + 1, esc(w.name), w.pax, Math.round((Date.now() - w.at) / 60000) + ' phút', btn('waitCall', w.id, 'Gọi / xếp bàn', 'green') + btn('waitDel', w.id, 'Bỏ', 'red')]))}</div>`;
}
function addRes() { if (!val('rName') || !val('rTime')) return alert('Nhập tên khách và giờ đặt.'); const l = read(K.RES, []); l.push({ id: uid(), name: val('rName'), phone: val('rPhone'), pax: +val('rPax') || 1, time: val('rTime'), table: val('rTable'), note: val('rNote'), status: 'Đã đặt' }); write(K.RES, l); go(); }
function resSet(a) { const [id, st] = a.split('|'), l = read(K.RES, []); l.find(r => r.id === id).status = st; write(K.RES, l); go(); }
function addWait() { if (!val('wName')) return alert('Nhập tên khách.'); const l = read(K.WAIT, []); l.push({ id: uid(), name: val('wName'), pax: +val('wPax') || 1, phone: val('wPhone'), at: Date.now() }); write(K.WAIT, l); go(); }
function waitDel(id) { write(K.WAIT, read(K.WAIT, []).filter(w => w.id !== id)); go(); }
function waitCall(id) { const w = read(K.WAIT, []).find(x => x.id === id); const e = (read('coffee_tables_v1', []) || []).filter(t => t.status === 'empty' && !t.type).map(t => t.name); alert(`Gọi khách ${w.name}${w.phone ? ' (' + w.phone + ')' : ''}.\nBàn trống: ${e.join(', ') || 'chưa có'}`); waitDel(id); }

/* ---------- KHÁCH THÂN THIẾT ---------- */
const tier = p => p >= 300 ? 'Vàng' : p >= 100 ? 'Bạc' : 'Đồng';
function viewCrm() {
    const l = read(K.CRM, []), m = new Date().getMonth() + 1;
    return `<div class="ops-card"><h3>Khách thân thiết</h3><p style="font-size:13px;color:#7a6652">Quy ước: 10.000đ = 1 điểm. Hạng: Đồng &lt;100, Bạc ≥100, Vàng ≥300 điểm.</p>
        <div class="ops-form">${field('cName', 'Tên khách')}${field('cPhone', 'SĐT')}${field('cBirth', 'Sinh nhật', 'date')}<button onclick="addCust()">Thêm khách</button></div>
        ${table(['Khách', 'SĐT', 'Sinh nhật', 'Điểm', 'Hạng', 'Chi tiêu', ''], l.map(c => [esc(c.name), esc(c.phone), c.birth ? (+c.birth.slice(5, 7) === m ? '<span class="ops-warn">' + c.birth.slice(5) + ' 🎂 tháng này – gửi ưu đãi</span>' : c.birth.slice(5)) : '—', c.points, `<span class="ops-tag">${tier(c.points)}</span>`, money(c.spent), btn('custPay', c.id, '+ Cộng điểm', 'green') + btn('custDel', c.id, 'Xóa', 'red')]))}</div>`;
}
function addCust() { if (!val('cName') || !val('cPhone')) return alert('Nhập tên và SĐT.'); const l = read(K.CRM, []); if (l.some(c => c.phone === val('cPhone'))) return alert('SĐT đã có.'); l.push({ id: uid(), name: val('cName'), phone: val('cPhone'), birth: val('cBirth'), points: 0, spent: 0 }); write(K.CRM, l); go(); }
function custPay(id) { const v = +prompt('Số tiền hóa đơn của khách (đ):'); if (!v) return; const l = read(K.CRM, []), c = l.find(x => x.id === id); c.spent += v; c.points += Math.floor(v / 10000); write(K.CRM, l); go(); }
function custDel(id) { if (confirm('Xóa khách này?')) { write(K.CRM, read(K.CRM, []).filter(c => c.id !== id)); go(); } }

/* ---------- KHUYẾN MÃI ---------- */
function viewPromo() {
    const l = read(K.PROMO, []);
    return `<div class="ops-card"><h3>Mã khuyến mãi</h3><p style="font-size:13px;color:#7a6652">Mã tạo ở đây dùng được ngay ở ô "mã khuyến mãi" khi thanh toán (cùng 4 mã GIAM10/GIAM20/GIAM5K/GIAM20K có sẵn). Happy hour: đặt khung giờ áp dụng.</p>
        <div class="ops-form">${field('pCode', 'MÃ (vd HAPPY15)')}${field('pLabel', 'Tên chương trình')}<select id="pType"><option value="pct">Giảm %</option><option value="vnd">Giảm đ</option></select>${field('pVal', 'Giá trị', 'number')}
        <label>Từ ${field('pFrom', '', 'date')}</label><label>Đến ${field('pTo', '', 'date')}</label>${field('pMax', 'Giới hạn lượt', 'number')}${field('pH1', 'Từ giờ (0-23)', 'number')}${field('pH2', 'Đến giờ', 'number')}<button onclick="addPromo()">Tạo mã</button></div>
        ${table(['Mã', 'Chương trình', 'Giảm', 'Hạn', 'Lượt', 'Giờ', ''], l.map(p => [`<b>${esc(p.code)}</b>`, esc(p.label), p.type === 'pct' ? p.value + '%' : money(p.value), (p.from || '…') + ' → ' + (p.to || '…'), `${p.used || 0}/${p.maxUses || '∞'}`, p.hourFrom !== '' ? `${p.hourFrom}h–${p.hourTo}h` : 'Cả ngày', btn('promoTog', p.id, p.active === false ? 'Bật' : 'Tắt') + btn('promoDel', p.id, 'Xóa', 'red')]))}</div>`;
}
function addPromo() { const code = val('pCode').trim().toUpperCase(); if (!code || !+val('pVal')) return alert('Nhập mã và giá trị giảm.'); const l = read(K.PROMO, []); if (l.some(p => p.code === code)) return alert('Mã đã tồn tại.'); l.push({ id: uid(), code, label: val('pLabel') || code, type: val('pType'), value: +val('pVal'), from: val('pFrom'), to: val('pTo'), maxUses: +val('pMax') || 0, hourFrom: val('pH1'), hourTo: val('pH2'), used: 0, active: true }); write(K.PROMO, l); go(); }
function promoTog(id) { const l = read(K.PROMO, []), p = l.find(x => x.id === id); p.active = p.active === false; write(K.PROMO, l); go(); }
function promoDel(id) { write(K.PROMO, read(K.PROMO, []).filter(p => p.id !== id)); go(); }

/* ---------- KHO NÂNG CAO ---------- */
function viewStock() {
    const wh = read(K.WH, null) || [{ id: 1, name: 'Cà phê hạt', unit: 'kg', stock: 5 }, { id: 2, name: 'Sữa đặc', unit: 'hộp', stock: 8 }, { id: 3, name: 'Đường', unit: 'kg', stock: 20 }, { id: 4, name: 'Đá viên', unit: 'kg', stock: 30 }];
    const sup = read(K.SUP, []), mv = read(K.MOV, []).slice().reverse(), today = new Date().toISOString().slice(0, 10), soon = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    const cost = {}; mv.filter(m => m.type === 'Nhập' && m.qty > 0).forEach(m => { const c = cost[m.item] || (cost[m.item] = { q: 0, v: 0 }); c.q += m.qty; c.v += m.qty * m.price; });
    const loss = mv.filter(m => m.type === 'Hao hụt').reduce((t, m) => t + m.qty * (cost[m.item] ? cost[m.item].v / cost[m.item].q : 0), 0);
    return `<div class="ops-card"><h3>Nhà cung cấp</h3><div class="ops-form">${field('sName', 'Tên NCC')}${field('sPhone', 'SĐT')}<button onclick="addSup()">Thêm NCC</button></div>
        ${table(['NCC', 'SĐT', ''], sup.map(s => [esc(s.name), esc(s.phone), btn('supDel', s.id, 'Xóa', 'red')]))}</div>
        <div class="ops-card"><h3>Phiếu nhập / xuất / hao hụt</h3><div class="ops-form"><select id="mType"><option>Nhập</option><option>Xuất</option><option>Hao hụt</option></select>
        <select id="mItem">${wh.map(w => `<option value="${esc(w.name)}">${esc(w.name)} (${w.unit})</option>`).join('')}</select>${field('mQty', 'Số lượng', 'number', 'step=any')}${field('mPrice', 'Đơn giá nhập', 'number')}
        <select id="mSup"><option value="">-- NCC --</option>${sup.map(s => `<option>${esc(s.name)}</option>`).join('')}</select><label>Hạn dùng ${field('mExp', '', 'date')}</label>${field('mNote', 'Ghi chú / lý do')}<button onclick="addMove()">Lập phiếu</button></div>
        <p style="font-size:13px">Giá vốn bình quân: ${Object.keys(cost).map(k => `<b>${esc(k)}</b> ${money(cost[k].v / cost[k].q)}`).join(' · ') || 'chưa có phiếu nhập'} &nbsp;|&nbsp; Giá trị hao hụt: <b>${money(loss)}</b></p>
        ${table(['Ngày', 'Loại', 'Nguyên liệu', 'SL', 'Đơn giá', 'NCC', 'Hạn dùng', 'Ghi chú'], mv.map(m => [m.date, m.type, esc(m.item), m.qty, m.price ? money(m.price) : '—', esc(m.sup || '—'), m.exp ? (m.exp < today ? '<span class="ops-warn">' + m.exp + ' (hết hạn)</span>' : m.exp <= soon ? '<span class="ops-warn">' + m.exp + ' (sắp hết)</span>' : m.exp) : '—', esc(m.note)]))}</div>`;
}
function addSup() { if (!val('sName')) return; const l = read(K.SUP, []); l.push({ id: uid(), name: val('sName'), phone: val('sPhone') }); write(K.SUP, l); go(); }
function supDel(id) { write(K.SUP, read(K.SUP, []).filter(s => s.id !== id)); go(); }
function addMove() {
    const qty = +val('mQty'); if (!(qty > 0)) return alert('Nhập số lượng > 0.');
    const type = val('mType'), item = val('mItem'), wh = read(K.WH, null);
    if (type === 'Nhập' && !+val('mPrice')) return alert('Phiếu nhập cần đơn giá để tính giá vốn.');
    const mv = read(K.MOV, []); mv.push({ id: uid(), date: new Date().toISOString().slice(0, 10), type, item, qty, price: +val('mPrice') || 0, sup: val('mSup'), exp: val('mExp'), note: val('mNote') }); write(K.MOV, mv);
    if (wh) { const w = wh.find(x => x.name === item); if (w) { w.stock = Math.round((w.stock + (type === 'Nhập' ? qty : -qty)) * 1e6) / 1e6; write(K.WH, wh); } } // đồng bộ tồn ở trang Kho
    go();
}

/* ---------- GIAO HÀNG (GrabFood / ShopeeFood / BeFood) ---------- */
const PLATFORMS = { GrabFood: 20, ShopeeFood: 20, BeFood: 18 }; // % hoa hồng mặc định, chỉnh tại đây
const DSTAT = ['Mới', 'Đang làm', 'Đang giao', 'Hoàn tất', 'Hủy'];
function viewDeliv() {
    const l = read(K.DELIV, []).slice().reverse();
    return `<div class="ops-card"><h3>Đơn từ ứng dụng giao hàng</h3><p style="font-size:13px;color:#7a6652">Bản giao diện: nhập đơn tay theo mã đơn của app. Khi có backend sẽ nhận đơn tự động qua API/webhook của từng nền tảng. Đơn "Hoàn tất" được ghi vào Doanh thu (kênh Grab/Shopee).</p>
        <div class="ops-form"><select id="dPlat">${Object.keys(PLATFORMS).map(p => `<option>${p}</option>`).join('')}</select>${field('dCode', 'Mã đơn / vận đơn')}${field('dName', 'Khách')}${field('dItems', 'Món (vd: 2 Cà phê sữa đá)')}${field('dTotal', 'Tổng tiền', 'number')}<button onclick="addDeliv()">Nhận đơn</button></div>
        ${table(['Nền tảng', 'Mã đơn', 'Khách', 'Món', 'Tổng', 'Hoa hồng', 'Trạng thái', ''], l.map(d => [d.plat, esc(d.code), esc(d.name), esc(d.items), money(d.total), money(d.total * PLATFORMS[d.plat] / 100), `<span class="ops-tag">${d.status}</span>`, d.status === 'Hoàn tất' || d.status === 'Hủy' ? '' : btn('delNext', d.id, '→ ' + DSTAT[DSTAT.indexOf(d.status) + 1], 'green') + btn('delCancel', d.id, 'Hủy', 'red')]))}</div>`;
}
function addDeliv() { if (!val('dCode') || !+val('dTotal')) return alert('Nhập mã đơn và tổng tiền.'); const l = read(K.DELIV, []); l.push({ id: uid(), plat: val('dPlat'), code: val('dCode'), name: val('dName'), items: val('dItems'), total: +val('dTotal'), status: 'Mới', at: new Date().toISOString() }); write(K.DELIV, l); go(); }
function delNext(id) {
    const l = read(K.DELIV, []), d = l.find(x => x.id === id); d.status = DSTAT[DSTAT.indexOf(d.status) + 1];
    if (d.status === 'Hoàn tất') { const inv = read(K.INV, []); inv.push({ id: 'DL-' + d.code, tableName: d.plat, createdAt: new Date().toISOString(), items: [{ name: d.items || 'Đơn giao hàng', qty: 1, price: d.total }], subtotal: d.total, discount: 0, total: d.total, status: 'active', orderType: 'delivery', channel: d.plat, method: 'transfer', createdBy: d.plat }); write(K.INV, inv); }
    write(K.DELIV, l); go();
}
function delCancel(id) { const l = read(K.DELIV, []); l.find(x => x.id === id).status = 'Hủy'; write(K.DELIV, l); go(); }

function go() { const f = { res: viewRes, crm: viewCrm, promo: viewPromo, stock: viewStock, deliv: viewDeliv }[tab]; body().innerHTML = f(); }
document.getElementById('opsTabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; tab = b.dataset.tab; document.querySelectorAll('#opsTabs .topnav-item').forEach(x => x.classList.toggle('active', x === b)); go(); });
go();
