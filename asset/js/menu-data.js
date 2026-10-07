// menu-data.js — DỮ LIỆU THỰC ĐƠN DÙNG CHUNG (nạp trước menu.js / table-order.js)
// Một nơi duy nhất giữ: tên danh mục/món chuẩn, ảnh món, tùy chọn (size, đường, đá, topping).
const MENU_KEY = 'coffee_menu_data_v2';
const ICON_BY_CAT = { 'Cà phê': ['☕', '#6b4f3a'], 'Trà sữa': ['🧋', '#b08968'], 'Trà trái cây': ['🍑', '#d97757'], 'Bánh': ['🥐', '#c9a27a'] };
// Ảnh minh họa tự sinh (SVG) khi món chưa có ảnh riêng — không cần mạng. Quản lý có thể tải ảnh thật ở trang Thực đơn.
function itemImage(item, category) {
    if (item && item.img) return item.img;
    const [emo, col] = ICON_BY_CAT[category] || ['🍽️', '#8a7a6a'];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".25"/><stop offset="1" stop-color="${col}" stop-opacity=".6"/></linearGradient></defs><rect width="160" height="160" rx="18" fill="url(#g)"/><text x="80" y="102" font-size="72" text-anchor="middle">${emo}</text></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
const DEFAULT_MENU = [
    { category: 'Cà phê', items: [
        { id: 1, name: 'Cà phê sữa đá', desc: 'Phin truyền thống', price: 29000 },
        { id: 2, name: 'Cà phê đen đá', desc: 'Đậm vị, không đường sữa', price: 25000 },
        { id: 3, name: 'Cà phê đen nóng', desc: 'Pha phin nóng', price: 25000 },
        { id: 7, name: 'Cà phê bạc xỉu', desc: 'Nhiều sữa, ít cà phê', price: 29000 },
        { id: 8, name: 'Cà phê cappuccino', desc: 'Espresso, sữa tươi, bọt sữa', price: 45000 } ] },
    { category: 'Trà sữa', items: [
        { id: 4, name: 'Trà sữa trân châu', desc: 'Trân châu đen', price: 35000 },
        { id: 5, name: 'Trà sữa matcha', desc: 'Matcha Nhật', price: 39000 } ] },
    { category: 'Trà trái cây', items: [
        { id: 9, name: 'Trà đào cam sả', desc: 'Đào miếng, cam, sả', price: 39000 },
        { id: 10, name: 'Trà vải hoa hồng', desc: 'Vải, hoa hồng', price: 39000 } ] },
    { category: 'Bánh', items: [
        { id: 6, name: 'Bánh croissant', desc: 'Nướng giòn', price: 22000 },
        { id: 11, name: 'Bánh tiramisu', desc: 'Lát 1 phần', price: 35000 } ] }
];
// Tùy chọn pha chế (áp dụng cho đồ uống, không áp dụng cho danh mục "Bánh")
const NO_OPTION_CATEGORIES = ['Bánh'];
const OPTION_CONFIG = {
    size: [{ v: 'S', add: 0 }, { v: 'M', add: 5000 }, { v: 'L', add: 10000 }],
    sugar: ['0%', '30%', '50%', '100%'],
    ice: ['Không đá', 'Ít đá', 'Bình thường'],
    toppings: [{ v: 'Trân châu', add: 7000 }, { v: 'Thạch', add: 5000 }, { v: 'Kem cheese', add: 10000 }]
};
