# Tiền chuyển không khớp hoặc chuyển trùng

Trong **Đơn thanh toán → Xử lý**, admin và nhân viên có phần **Tiền chuyển không khớp / chuyển trùng**. Dùng khi đã đối chiếu sao kê và biết tiền vào sai số tiền, sau hạn QR, không thể giao hàng hoặc chuyển lặp.

1. Ghi số tiền thực nhận, mã giao dịch, thời điểm và lý do khách có thể đọc; xác nhận đã đối chiếu sao kê.
2. Thực hiện hoàn tiền qua ngân hàng theo quy trình của cửa hàng.
3. Trong từng khoản, nhập đúng số tiền đã hoàn, mã giao dịch hoàn và thời điểm; xác nhận để lưu chứng từ.

Website lưu chứng từ do người phụ trách xác nhận; các nút này không thực hiện chuyển tiền qua ngân hàng. Theo quyền người dùng chốt 12/11/2026, nhân viên được ghi nhận/hoàn khoản chuyển này với cùng điều kiện chứng từ như admin; cấu hình ngân hàng vẫn chỉ dành cho admin.

Mỗi khoản chuyển được theo dõi riêng, hoàn đầy đủ và không cộng vào doanh thu bán hàng. Khoản chuyển lặp của đơn đã mua không thay đổi điểm, kho hoặc trạng thái đơn gốc. Với đơn chưa được thanh toán thành công, ghi nhận khoản cần hoàn sẽ đóng QR và trả lại kho/voucher giữ chỗ đúng một lần; đơn này vẫn không xuất hiện như một lần mua thành công.

Khách xem tình trạng trong **Thanh toán → Phiên đặt hàng gần đây → Xem / theo dõi**. Với đơn đã mua, xem trong chi tiết đơn. Mã nhận, mã hoàn, thời gian và số còn cần hoàn được hiển thị; biên nhận/PDF có bảng đối soát riêng. Một giao dịch nhận/hoàn không được dùng trùng ở đơn hay khoản thu khác. Gửi lại cùng yêu cầu không ghi nhận hoặc hoàn lần hai.

QR vẫn hết hạn cố định sau 2 phút. Ngân hàng có thể nhận tiền nếu khách dùng ảnh QR đã lưu sau hạn; cửa hàng cần đối soát và dùng luồng hoàn trên, không xác nhận đơn thành công sau hạn. Hệ thống hiện dùng đối soát thủ công, chưa có webhook nhận giao dịch ngân hàng tự động.
