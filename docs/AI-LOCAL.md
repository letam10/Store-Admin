# AI Local và điểm thành viên

API dùng Ollama tại `http://127.0.0.1:11434`, model `qwen3.5:4b`. Chạy `ollama serve`, sau đó tại Store-Admin chạy `npm run dev:api`. Lệnh phát triển tắt menu tương tác để `dotnet watch` nhận bàn phím riêng; Ctrl+C tắt API. Menu quản lý vẫn mở được bằng `dotnet run` từ thư mục server-dotnet.

Mặc định `AI_CONTEXT_SIZE=32768`, `AI_THINKING=medium`. Context chọn ở admin được lưu vào database và đưa vào `options.num_ctx` cho yêu cầu tiếp theo. Medium dùng giới hạn sinh 4.096 token (bao gồm suy luận và câu trả lời); high 8.192. Đây là mức tài nguyên của ứng dụng. Qwen đang dùng `think=true`, không khẳng định model có thang medium riêng khi `/api/show` chưa công bố. Cấu hình cá nhân trong `.env` được ưu tiên; không commit khóa SMTP/OAuth.

Đây là truy xuất dữ liệu thật theo câu hỏi, không fine-tune trọng số. Dữ kiện gồm catalog/giá sau giảm/tồn kho, mã công khai còn hạn, nội dung liên hệ đã đăng trên website, chính sách thanh toán/đổi trả/điểm, ngày giờ Việt Nam. Chưa công bố chương trình tháng sau hay ngày nhập hàng thì AI phải nói chưa có dữ liệu. Nhân viên được coi là đang online khi tab admin đang hiển thị gửi heartbeat trong 90 giây gần nhất; không đảm bảo họ trả lời ngay.

Model sinh toàn bộ lời đáp qua `/api/chat` streaming. Server không dựng đáp án FAQ hoặc thay lỗi bằng câu trả lời mẫu. Suy luận nội bộ không đưa ra UI/lịch sử. EOF, giới hạn sinh, timeout và hủy giữ trạng thái chưa hoàn tất; chỉ lưu hoàn tất sau kết thúc hợp lệ và ghi database thành công. Câu trả lời có dữ liệu nguồn vẫn có thể sai; không gắn nhãn tự động đã xác minh đúng.

Chat khách yêu cầu đăng nhập và CSRF, lịch sử theo chủ sở hữu, khóa retry không thể chuyển sang nội dung hoặc cuộc trò chuyện khác. Trình duyệt lưu mã hội thoại theo tài khoản. Staff không có quyền mở AI quản trị/báo cáo tài chính.

Điểm mới: lấy phần nguyên của tiền hàng thực trả/1.000, nhân hạng lúc đặt đơn (Đồng/Bạc x1; Vàng x1,2; Kim Cương x1,5), bỏ phần lẻ. Không tính phí giao/dịch vụ. Đổi/trả điều chỉnh điểm theo đơn và phiên bản chính sách; không cộng bù đơn cũ. Đơn được voucher thanh toán đủ còn 0đ hoàn tất ngay trong giao dịch giữ kho/tiêu mã, không tạo QR/giao dịch ngân hàng, không cộng điểm; vẫn gửi biên nhận và hỗ trợ đổi/trả.

Tham khảo giao thức: [Ollama Chat](https://docs.ollama.com/api/chat), [điều khiển thinking](https://docs.ollama.com/capabilities/thinking).

Sampling giữ theo cấu hình của model. Bản Qwen hiện cài có temperature=1, top_p=0,95, top_k=20, presence_penalty=1,5, phù hợp [khuyến nghị Qwen cho tác vụ thông thường có suy luận](https://huggingface.co/Qwen/Qwen3.5-4B#best-practices). Không ép temperature=0,12 như code cũ; cần đánh giá chất lượng từng câu, không chỉ kiểm tra stream kết thúc.
