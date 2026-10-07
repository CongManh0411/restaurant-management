# Quản lý quán cà phê — frontend (thêm vai trò THU NGÂN)

Chạy: bấm đúp `Login.html` (không cần server).

Tài khoản thử (mật khẩu 123456): quanly, phucvu, bep, **thungan** (Thu ngân).

## Thu ngân có gì
| Trang | Chức năng |
|---|---|
| Bán hàng (Table.html) | Tạo đơn tại bàn / **mang đi / giao hàng** (đơn không gắn bàn), ghi chú món, báo **hết món**, gửi bếp |
| Thanh toán (popup) | Tiền mặt / QR / thẻ / ví, tính tiền thừa, **mã khuyến mãi + giảm giá**, hủy món (kể cả đã làm, bắt buộc lý do), **in / gửi hóa đơn** |
| Đơn hàng (Orders.html) | Đang xử lý (trạng thái pha chế), đã hoàn thành (in, hoàn tiền), đã hủy |
| Ca & Quỹ (Shift.html) | Mở ca (tiền đầu ca), thu/chi, báo cáo cá nhân, kết ca (lệch tiền → bắt buộc lý do), in báo cáo kết ca |
| Lịch ca (Schedule.html) | Xem ca + **đăng ký ca** (chọn khung trống, hệ thống tự xếp) |
| Chấm công | Vào ca tự động, "Giao ca" ở sidebar |

Phục vụ vẫn thanh toán được (tiền mặt/QR/thẻ/ví) nhưng không giảm giá.
Thao tác nhạy cảm Thu ngân tự làm, **không cần duyệt**, mọi thứ ghi vào Nhật ký.
Quản lý xem ở **Nhật ký** (Logs.html): nhật ký thao tác + báo cáo kết ca.

## File mới / đã sửa
- Mới: `asset/js/cashier-core.js` (lõi: ca, quỹ, log, voucher, in), `waiter-pay.js` (popup thanh toán, tách khỏi notifications.js), `orders.js`, `shift.js`, `logs.js`, `shift-register.js`, `asset/css/cashier.css`, `Orders.html`, `Shift.html`, `Logs.html`
- Sửa: `auth.js` (vai trò + menu), `table-order.js`, `notifications.js`, `schedule.js`, `staff.js`, `shifts.js`, `table-manage.js`, `Table.html`, `Schedule.html`, `Staff.html`, `Login.html`

## Chỉnh nhanh (đầu file cashier-core.js)
`VOUCHERS` (mã khuyến mãi), `LARGE_DISCOUNT_PCT / _VND` (ngưỡng giảm giá lớn), `BIG_ADJUST_VND` (ngưỡng thu/chi lớn).
Đăng ký ca: `SLOTS`, `MAX_CASHIER_PER_SLOT` ở đầu `shift-register.js`.

## Cập nhật mới
- **Thực đơn** (đổi tên từ "Menu"): mỗi món có **ảnh** (Quản lý tải ảnh ở tab Thêm/Sửa món; món chưa có ảnh dùng ảnh minh họa mặc định), tìm theo tên/mô tả/danh mục.
- **Bán hàng**: thêm **ô tìm kiếm món** (gõ không dấu cũng tìm được); đồ uống bấm "+ Thêm" sẽ mở **popup chọn Size / Đường / Đá / Topping / Ghi chú**, giá tự cộng phụ thu (Size M +5k, L +10k; topping 5–10k). Bánh thêm thẳng không hỏi.
- **Đồng nhất tên gọi**: Thực đơn, Bàn, Sơ đồ bàn, Lịch ca, Kho, Lịch sử; danh mục chuẩn: Cà phê / Trà sữa / Trà trái cây / Bánh; tên món theo dạng "Loại + tên".
- File mới: `asset/js/menu-data.js` (menu mặc định, ảnh, tùy chọn — sửa phụ thu ở `OPTION_CONFIG`). Key lưu menu đổi thành `coffee_menu_data_v2` (menu mẫu mới thay menu cũ).
- **Tách / gộp / chuyển bàn**: 3 nút dưới tiêu đề hóa đơn ở trang Bàn.
- **Trang Vận hành** (Quản lý, Thu ngân): Đặt bàn & hàng chờ, Khách thân thiết (điểm, hạng, sinh nhật), Khuyến mãi (hạn dùng, giới hạn lượt, happy hour — dùng được ngay ở màn thanh toán), Kho nâng cao (NCC, phiếu nhập/xuất/hao hụt, hạn dùng, giá vốn bình quân, đồng bộ tồn kho), Giao hàng (Grab/Shopee/Be, nhập tay, hoàn tất → vào Doanh thu).
- **Doanh thu → Báo cáo chuyên sâu**: biểu đồ giờ cao điểm, top món, so sánh 7 ngày, kênh bán, lợi nhuận gộp ước tính (chỉnh % giá vốn), xuất Excel (CSV) / PDF (in).
- Chưa làm: combo/mua 1 tặng 1, kết nối API thật của Grab/Shopee/Be, tự cộng điểm khách khi thanh toán (hiện cộng thủ công).
