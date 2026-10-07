// dashboard.js — Báo cáo chuyên sâu cho trang Doanh thu: biểu đồ, lợi nhuận gộp, so sánh kỳ, xuất Excel/PDF.
// Dùng lại loadInvoices / getPeriodRange / currentPeriod / fmtMoney của revenue.js. Tự vẽ lại khi số liệu đổi.
(function () {
    const root = document.getElementById('dashRoot'); if (!root) return;
    const COLORS = ['#6b4f3a', '#c4a27c', '#3f8a5a', '#4068b8', '#b0412e'];
    let costPct = Number(localStorage.getItem('coffee_costpct_v1')) || 37; // giá vốn ước tính (% doanh thu); sẽ thay bằng giá vốn thật từ Kho
    const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const chan = i => i.channel ? 'Grab/Shopee/Be' : (i.orderType === 'takeaway' ? 'Mang đi' : i.orderType === 'delivery' ? 'Giao hàng' : (i.paymentMethod === 'transfer' && i.orderType === 'qr') ? 'QR' : 'Tại bàn');
    const valid = () => loadInvoices().filter(i => i.status !== 'cancelled' && i.status !== 'void' && i.createdAt);
    const sum = l => l.reduce((t, i) => t + (i.total || 0), 0);

    function bars(vals, labels, hi) {
        const W = 520, H = 190, max = Math.max(1, ...vals), bw = W / vals.length;
        return `<svg viewBox="0 0 ${W} ${H + 24}">` + vals.map((v, k) => { const h = v / max * H; return `<rect x="${k * bw + 3}" y="${H - h}" width="${bw - 6}" height="${h}" rx="3" fill="${k === hi && v > 0 ? '#b0412e' : '#c4a27c'}"><title>${labels[k]}h: ${fmtMoney(v)}</title></rect><text x="${k * bw + bw / 2}" y="${H + 14}" font-size="10" text-anchor="middle" fill="#6b4f3a">${labels[k]}</text>`; }).join('') + '</svg>';
    }
    function hbars(rows) {
        if (!rows.length) return '<p class="ops-empty">Chưa có dữ liệu.</p>';
        const max = rows[0][1];
        return `<svg viewBox="0 0 320 ${rows.length * 30}">` + rows.map(([n, q], k) => `<text x="0" y="${k * 30 + 18}" font-size="11" fill="#4a3626">${esc(n.slice(0, 18))}</text><rect x="110" y="${k * 30 + 6}" width="${q / max * 170}" height="16" rx="3" fill="#6b4f3a"/><text x="${114 + q / max * 170}" y="${k * 30 + 18}" font-size="11" fill="#4a3626">${q}</text>`).join('') + '</svg>';
    }
    function lines(a, b) {
        const W = 320, H = 150, max = Math.max(1, ...a, ...b), pt = (v, k) => `${20 + k * (W - 40) / 6},${H - v / max * (H - 10)}`;
        const path = (arr, c, d) => `<polyline fill="none" stroke="${c}" stroke-width="2.5" ${d ? 'stroke-dasharray="6 4"' : ''} points="${arr.map(pt).join(' ')}"/>` + arr.map((v, k) => `<circle cx="${pt(v, k).split(',')[0]}" cy="${pt(v, k).split(',')[1]}" r="3.5" fill="${c}"><title>${fmtMoney(v)}</title></circle>`).join('');
        return `<svg viewBox="0 0 ${W} ${H + 20}">${path(b, '#c4a27c', 1)}${path(a, '#6b4f3a')}${[1, 2, 3, 4, 5, 6, 7].map((d, k) => `<text x="${20 + k * (W - 40) / 6}" y="${H + 16}" font-size="10" text-anchor="middle" fill="#6b4f3a">N${d}</text>`).join('')}</svg>
        <div class="dash-legend"><span><i style="background:#6b4f3a"></i>7 ngày gần nhất</span><span><i style="background:#c4a27c"></i>7 ngày trước đó</span></div>`;
    }
    function pie(map) {
        const tot = Object.values(map).reduce((a, b) => a + b, 0); if (!tot) return '<p class="ops-empty">Chưa có dữ liệu.</p>';
        let ang = -Math.PI / 2, out = '';
        Object.entries(map).forEach(([n, v], k) => {
            const a2 = ang + v / tot * 2 * Math.PI, big = a2 - ang > Math.PI ? 1 : 0, P = a => [80 + 70 * Math.cos(a), 80 + 70 * Math.sin(a)];
            out += v === tot ? `<circle cx="80" cy="80" r="70" fill="${COLORS[k % 5]}"/>` : `<path d="M80,80 L${P(ang)} A70,70 0 ${big} 1 ${P(a2)} Z" fill="${COLORS[k % 5]}"><title>${n}: ${fmtMoney(v)}</title></path>`; ang = a2;
        });
        return `<svg viewBox="0 0 160 160" style="max-width:170px;margin:auto">${out}</svg><div class="dash-legend">${Object.entries(map).map(([n, v], k) => `<span><i style="background:${COLORS[k % 5]}"></i>${n} ${Math.round(v / tot * 100)}%</span>`).join('')}</div>`;
    }

    function render() {
        const { start, end } = getPeriodRange(currentPeriod), all = valid();
        const cur = all.filter(i => { const d = new Date(i.createdAt); return d >= start && d <= end; });
        const rev = sum(cur), gp = rev * (1 - costPct / 100);
        const hours = Array(17).fill(0); cur.forEach(i => { const h = new Date(i.createdAt).getHours(); if (h >= 6 && h <= 22) hours[h - 6] += i.total || 0; });
        const hi = hours.indexOf(Math.max(...hours));
        const items = {}; cur.forEach(i => (i.items || []).forEach(x => items[x.name] = (items[x.name] || 0) + (x.qty || x.quantity || 1)));
        const top = Object.entries(items).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const day = new Date(); day.setHours(0, 0, 0, 0); const wk = Array(7).fill(0), pw = Array(7).fill(0);
        all.forEach(i => { const diff = Math.floor((day - new Date(new Date(i.createdAt).setHours(0, 0, 0, 0))) / 864e5); if (diff >= 0 && diff < 7) wk[6 - diff] += i.total || 0; else if (diff >= 7 && diff < 14) pw[13 - diff] += i.total || 0; });
        const ch = {}; cur.forEach(i => ch[chan(i)] = (ch[chan(i)] || 0) + (i.total || 0));
        root.innerHTML = `<div class="dash"><div class="dash-head"><h3>Báo cáo chuyên sâu</h3><div><label>Giá vốn ước tính <input id="costPct" type="number" value="${costPct}" min="0" max="100">%</label>
            <button id="dashCsv">Xuất Excel</button><button id="dashPdf">Xuất PDF</button></div></div>
            <div class="dash-grid"><div class="dash-box"><h4>Doanh thu theo giờ (giờ cao điểm: ${rev ? hi + 6 + 'h' : '—'})</h4>${bars(hours, hours.map((_, k) => k + 6), hi)}</div>
            <div><div class="dash-box dash-kpi"><small>Doanh thu</small><b>${fmtMoney(rev)}</b></div><div class="dash-box dash-kpi g"><small>Lợi nhuận gộp (ước tính)</small><b>${fmtMoney(gp)} (${100 - costPct}%)</b></div><div class="dash-box dash-kpi b"><small>Số hóa đơn</small><b>${cur.length}</b></div></div></div>
            <div class="dash-grid3"><div class="dash-box"><h4>Top món bán chạy</h4>${hbars(top)}</div><div class="dash-box"><h4>So sánh kỳ trước (7 ngày)</h4>${lines(wk, pw)}</div><div class="dash-box"><h4>Kênh bán hàng</h4>${pie(ch)}</div></div></div>`;
        document.getElementById('costPct').onchange = e => { costPct = Math.min(100, Math.max(0, +e.target.value || 0)); localStorage.setItem('coffee_costpct_v1', costPct); render(); };
        document.getElementById('dashPdf').onclick = () => window.print();
        document.getElementById('dashCsv').onclick = () => {
            const rows = [['Mã HĐ', 'Thời gian', 'Kênh', 'Thanh toán', 'Giảm giá', 'Tổng tiền']].concat(cur.map(i => [i.id, new Date(i.createdAt).toLocaleString('vi-VN'), chan(i), i.paymentMethod || i.method || '', i.discount || 0, i.total || 0]))
                .concat([[], ['Doanh thu', rev], ['Lợi nhuận gộp ước tính', Math.round(gp)], ['Số hóa đơn', cur.length]], [[], ['Món', 'Số lượng']], top);
            const csv = '\ufeff' + rows.map(r => r.map(c => '"' + String(c ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n');
            const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'bao-cao-doanh-thu.csv'; a.click();
        };
    }
    render();
    new MutationObserver(render).observe(document.getElementById('statTotalRevenue'), { childList: true, characterData: true, subtree: true });
    window.addEventListener('storage', render);
})();
