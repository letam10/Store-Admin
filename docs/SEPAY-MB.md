# Xác nhận chuyển khoản tự động bằng SePay + MB

Backend chủ động đọc giao dịch qua HTTPS từ SePay khoảng mỗi 10 giây, nên dùng được khi chạy localhost. Không cần webhook, mở cổng Internet hoặc tunnel. Khách chuyển đúng số tiền/nội dung sẽ thấy xác nhận khi backend đã ghi nhận; không cần bấm “Tôi đã chuyển khoản”. Trang khách hỏi trạng thái mỗi 3 giây, admin làm mới danh sách mỗi 10 giây. Độ trễ còn phụ thuộc lúc MB gửi giao dịch sang SePay.

## Kết nối một lần

1. Đăng nhập https://my.sepay.vn, vào Ngân hàng → Kết nối thêm → MB → Cá nhân → Đã có tài khoản. Chủ tài khoản tự điền thông tin và xác minh OTP tại trang chính thức.
2. Kiểm tra MB báo liên kết API thành công. Giữ gói phù hợp; không cần đăng ký thêm cổng thanh toán hay tài khoản ảo cho tích hợp này.
3. Cấu hình Công ty → API Access → Thêm API, đặt tên gợi nhớ cho Store, trạng thái Hoạt động. Sao chép API token.
4. Lưu vào `server-dotnet/.env` trên máy chạy backend (file này bị Git bỏ qua):

```dotenv
SEPAY_API_TOKEN=token_cua_ban
SEPAY_ENABLED=true
```

5. Khởi động lại backend bằng `npm run dev:api`. Trong admin → Đơn thanh toán, mục “Xác nhận tự động qua SePay · MB” phải báo đang kiểm tra tiền vào và có giờ đồng bộ mới. Tài khoản nhận tiền trong cấu hình cửa hàng phải khớp tài khoản MB đang hoạt động trên SePay.

Token chỉ nằm ở backend; không đặt trong biến `VITE_*`, frontend, Git, ảnh báo cáo hay tin nhắn. SePay chưa có phân quyền riêng chỉ đọc cho token; mã tích hợp này chỉ gọi GET danh sách tài khoản và giao dịch. Thu hồi token trên SePay nếu không sử dụng nữa. Token Test Mode không dùng được cho User API v1 này; kiểm thử tự động dùng API giả lập và database QA riêng.

## Cách xử lý

- Xác nhận tiền vào đúng ngân hàng MB, tài khoản chụp tại thời điểm tạo phiên, một mã đơn hoặc khoản bù duy nhất, đủ số tiền và đúng hạn.
- Dùng thời điểm nhận tiền của ngân hàng theo giờ Việt Nam. Thông báo đến sau khi QR đóng vẫn được đối soát theo thời điểm nhận thực tế; không tự gia hạn QR.
- Đơn khách chủ động hủy, sai tiền, chuyển trễ, chuyển trùng, thiếu hàng/voucher sau giải phóng hoặc mã không nhận dạng được: lưu chứng từ “Cần kiểm tra”, không tự ghi doanh thu. Admin xem mã giao dịch/số tiền/giờ nhận và xử lý trong chi tiết đơn. Không tự thực hiện chuyển tiền hoàn.
- Khóa transaction ID và mã giao dịch chống xử lý lặp. Ghi chứng từ, thanh toán, điểm và công việc email trong cùng transaction SQL. Lỗi giữ kho/voucher được hoàn tác nhưng tiền đã nhận vẫn được ghi để đối soát.
- Tự xác nhận cả khoản bù đổi sang sản phẩm khác. Các điều kiện đổi/trả và hạn thanh toán hiện có vẫn áp dụng.
- Đối soát thành công đưa biên nhận khách và thông báo admin vào outbox email hiện có; trạng thái gửi email không quyết định trạng thái tiền đã nhận.

## Vận hành và giới hạn

Máy/backend cần đang chạy để xác nhận ngay. Khi khởi động lại, hệ thống đọc bù từ mốc đồng bộ đã lưu và lùi thêm một ngày để bắt giao dịch lên chậm; lần đầu đọc tối đa khoảng 7 ngày gần nhất mà SePay có dữ liệu. SePay không nhất thiết có khoản chuyển phát sinh trước lúc liên kết MB. Khoản cũ chưa có trên SePay cần đối chiếu chứng từ ngân hàng; không yêu cầu khách chuyển lại chỉ vì website chưa ghi nhận.

API lỗi hoặc khóa sai: giữ mốc cũ, báo lỗi trong admin và thử lại sau ít nhất 30 giây, tôn trọng thời gian chờ giới hạn API (tối đa 5 phút mỗi lần). Không thông báo đã thanh toán chỉ dựa vào lời khai của khách hoặc số dư tài khoản.

User API v1 trả tối đa 5.000 giao dịch một lần. Nếu chạm giới hạn này, hệ thống dừng tiến mốc và báo cần đối soát bổ sung để tránh âm thầm bỏ sót. Bảng admin hiển thị 100 chứng từ gần nhất; toàn bộ chứng từ đã nhập được lưu trong database.

Gói Free/biểu phí do SePay quyết định; kiểm tra trên trang tài khoản trước khi vượt hạn mức. Tích hợp này không tự mua gói, đăng ký trả phí hoặc chuyển tiền.

## Kiểm thử

`dotnet run --project tests/SePayChecks` tạo database mới có tiền tố `StoreSePayQA_`, dùng HTTP giả lập và không gọi ngân hàng thật. Kiểm các nhánh đúng/sai tiền, trễ, lặp song song, khoản bù, rollback kho và hàng đợi email. Tùy chọn `--serve <thu-muc-qa-ngoai-repo>` mở API QA tại 5099; không dùng bản này cho dữ liệu thật.

Nguồn chính thức: [MB API](https://docs.sepay.vn/ket-noi-mb-api.html), [API Token](https://docs.sepay.vn/tao-api-token.html), [Giao dịch](https://docs.sepay.vn/api-giao-dich.html), [Giới hạn API](https://docs.sepay.vn/gioi-thieu-api.html).
