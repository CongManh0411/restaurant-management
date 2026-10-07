// ============================================================
// inventory.js — LỚP DỮ LIỆU KHO DÙNG CHUNG (InventoryAPI)
// ------------------------------------------------------------
// Nạp TRƯỚC warehouse.js, menu.js, kitchen.js, table-order.js (và notifications.js dùng khi thanh toán).
// - Kho:      'coffee_warehouse_v1'      [{ id, name, unit, stock, minLevel, trackingCode }]
// - Công thức:'coffee_menu_recipes_v1'   { [menuItemId]: [{ ingredientId, name, qty, unit }] }  (menu.js ghi)
// - Biến động:'coffee_warehouse_log_v1'  [{ ts, type, ingredientId, name, unit, delta, ref }]  (tối đa 300 dòng)
//
// QUY TẮC TRỪ KHO: món bị trừ nguyên liệu đúng 1 lần khi BẾP bấm "Xong" (hoặc khi Phục vụ thanh toán mà món chưa xong).
// Bếp bấm "Hoàn tác" thì cộng lại đúng số đã trừ. Trừ không bao giờ xuống dưới 0 và không chặn việc làm món.
// Món đã trừ được đánh dấu: item.stockDeducted = true, item.stockUsed = [{ id, amt }].
// Đơn vị: công thức có thể ghi g/ml còn Kho tính kg/lít (tự quy đổi).
//
// Khi nối backend: giữ nguyên tên hàm, chỉ đổi phần đọc/ghi (read/write) thành gọi API; việc trừ kho nên làm ở server.
// ============================================================
(function () {
    'use strict';
    if (window.InventoryAPI) return;

    const KEY = 'coffee_warehouse_v1', LOG_KEY = 'coffee_warehouse_log_v1', RECIPE_KEY = 'coffee_menu_recipes_v1', MENU_KEY = 'coffee_menu_data_v2';
    const DEFAULTS = [
        { id: 1, name: 'Cà phê hạt', unit: 'kg',  stock: 5,  minLevel: 10, trackingCode: 'VN123456789' },
        { id: 2, name: 'Sữa đặc',    unit: 'hộp', stock: 8,  minLevel: 15, trackingCode: 'VN987654321' },
        { id: 3, name: 'Đường',      unit: 'kg',  stock: 20, minLevel: 10, trackingCode: 'VN456789123' },
        { id: 4, name: 'Đá viên',    unit: 'kg',  stock: 30, minLevel: 20, trackingCode: 'VN789123456' }
    ];

    const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v === null || v === undefined ? d : v; } catch (e) { return d; } };
    const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
    const round = n => Math.round(n * 1e6) / 1e6;

    function getAll() { const s = read(KEY, null); return Array.isArray(s) ? s : JSON.parse(JSON.stringify(DEFAULTS)); }
    function saveAll(list) { return write(KEY, list); }
    function getRecipes() { const r = read(RECIPE_KEY, {}); return r && typeof r === 'object' ? r : {}; }

    // ---------- Đơn vị ----------
    const UNITS = { g: ['g', 1], kg: ['g', 1000], ml: ['ml', 1], l: ['ml', 1000], 'lít': ['ml', 1000], lit: ['ml', 1000] };
    const norm = u => String(u || '').trim().toLowerCase();
    // 1 [from] = ? [to]  (null nếu không quy đổi được)
    function factor(from, to) {
        const a = norm(from), b = norm(to);
        if (!a || !b) return null;
        if (a === b) return 1;
        const x = UNITS[a], y = UNITS[b];
        return x && y && x[0] === y[0] ? x[1] / y[1] : null;
    }
    function unitOptions(stockUnit) {
        const x = UNITS[norm(stockUnit)];
        if (!x) return [stockUnit];
        return x[0] === 'g' ? ['g', 'kg'] : ['ml', 'l'];
    }

    // ---------- Công thức ----------
    function findIng(wh, id) { return wh.find(w => String(w.id) === String(id)); }
    function isValidRow(row, wh) {
        const ing = row && row.ingredientId != null ? findIng(wh, row.ingredientId) : null;
        return !!ing && Number(row.qty) > 0 && !!row.unit && factor(row.unit, ing.unit) !== null;
    }
    // Nguyên liệu cần cho `qty` phần món menuId, quy về đơn vị của Kho: [{ id, amt }]
    function needsOf(menuId, qty, wh, recipes) {
        const rows = (recipes || getRecipes())[menuId] || [];
        const out = [];
        rows.forEach(r => {
            if (!isValidRow(r, wh)) return;
            const ing = findIng(wh, r.ingredientId), amt = Number(r.qty) * factor(r.unit, ing.unit) * qty;
            const e = out.find(o => String(o.id) === String(ing.id));
            if (e) e.amt += amt; else out.push({ id: ing.id, amt });
        });
        return out;
    }

    // Số nguyên liệu đã "giữ chỗ" cho các món đã gọi (kể cả nháp) mà CHƯA bị trừ kho
    function reservedMap(tables, wh, recipes) {
        const res = {};
        (tables || []).forEach(t => (t.items || []).forEach(i => {
            if (i.stockDeducted) return;
            needsOf(i.id, i.quantity, wh, recipes).forEach(n => { res[n.id] = (res[n.id] || 0) + n.amt; });
        }));
        return res;
    }
    // Còn làm được tối đa bao nhiêu phần (Infinity nếu món chưa có công thức hợp lệ)
    function portionsLeft(menuId, wh, recipes, reserved) {
        const needs = needsOf(menuId, 1, wh, recipes);
        if (!needs.length) return Infinity;
        const n = Math.min(...needs.map(x => (findIng(wh, x.id).stock - ((reserved || {})[x.id] || 0)) / x.amt));
        return Math.max(0, Math.floor(n + 1e-9));
    }

    // ---------- Lịch sử ----------
    function getLog() { const l = read(LOG_KEY, []); return Array.isArray(l) ? l : []; }
    function pushLog(entries) {
        if (!entries.length) return;
        write(LOG_KEY, getLog().concat(entries).slice(-300));
    }
    function logChange(type, ing, delta, ref) {
        pushLog([{ ts: Date.now(), type, ingredientId: ing.id, name: ing.name, unit: ing.unit, delta: round(delta), ref: ref || '' }]);
    }

    // ---------- Trừ / hoàn kho cho 1 dòng món (item trong bàn). Sửa `wh` tại chỗ; người gọi tự saveAll(wh). ----------
    function applySale(item, wh, ref) {
        if (!item || item.stockDeducted) return false;
        const used = [], logs = [];
        needsOf(item.id, item.quantity, wh).forEach(n => {
            const ing = findIng(wh, n.id), amt = Math.min(Number(ing.stock) || 0, n.amt);
            if (amt <= 0) return;
            ing.stock = round(ing.stock - amt);
            used.push({ id: ing.id, amt: round(amt) });
            logs.push({ ts: Date.now(), type: 'sale', ingredientId: ing.id, name: ing.name, unit: ing.unit, delta: -round(amt), ref: `${ref || ''} · ${item.name} x${item.quantity}` });
        });
        item.stockDeducted = true;
        item.stockUsed = used;
        pushLog(logs);
        return used.length > 0;
    }
    function undoSale(item, wh, ref) {
        if (!item || !item.stockDeducted) return false;
        const logs = [];
        (item.stockUsed || []).forEach(u => {
            const ing = findIng(wh, u.id);
            if (!ing) return;
            ing.stock = round((Number(ing.stock) || 0) + u.amt);
            logs.push({ ts: Date.now(), type: 'undo', ingredientId: ing.id, name: ing.name, unit: ing.unit, delta: round(u.amt), ref: `${ref || ''} · hoàn tác ${item.name}` });
        });
        const changed = (item.stockUsed || []).length > 0;
        delete item.stockDeducted; delete item.stockUsed;
        pushLog(logs);
        return changed;
    }

    // Tên các món đang dùng nguyên liệu này trong công thức
    function usedByRecipes(ingredientId) {
        const recipes = getRecipes(), menu = read(MENU_KEY, []), names = [];
        (Array.isArray(menu) ? menu : []).forEach(cat => (cat.items || []).forEach(it => {
            if ((recipes[it.id] || []).some(r => String(r.ingredientId) === String(ingredientId))) names.push(it.name);
        }));
        return names;
    }

    window.InventoryAPI = {
        KEY, LOG_KEY, RECIPE_KEY, getAll, saveAll, getRecipes, factor, unitOptions, isValidRow, needsOf,
        reservedMap, portionsLeft, applySale, undoSale, usedByRecipes, getLog, logChange
    };
})();