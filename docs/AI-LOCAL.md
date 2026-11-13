# AI Local và điểm thành viên

API dùng Ollama tại `http://127.0.0.1:11434`, model `qwen3.5:4b`. Từ thư mục `Store-Admin/server-dotnet`, chạy `dotnet run`, rồi bấm **1**: menu mở API, Store, Admin, khởi động Ollama nếu chưa chạy và nạp mô hình vào bộ nhớ. Dòng AI phân biệt dịch vụ đang chạy, mô hình đã tải và mô hình đã nạp; chỉ báo sẵn sàng khi `/api/ps` xác nhận.

Máy thành viên cần clone `Store` và `Store-Admin` cạnh nhau, cài Node theo `.nvmrc`, .NET 8, SQL Server/LocalDB và chạy `npm ci` trong mỗi repo. [Cài Ollama cho Windows](https://docs.ollama.com/windows) trước khi bấm 1. Git không chứa chương trình Ollama hoặc trọng số: nếu thiếu mô hình, menu hỏi `CO` để tải lần đầu; có thể tự chạy `ollama pull qwen3.5:4b`. Không có Ollama thì website vẫn chạy, AI báo chưa sẵn sàng. Mỗi máy dùng dữ liệu và cấu hình `.env` riêng; Git không chứa khóa Google, SMTP, SePay.

Mô hình được nạp sẵn với `keep_alive=10m`; sau thời gian không dùng, Ollama có thể giải phóng bộ nhớ, câu hỏi kế tiếp sẽ nạp lại. Phím 2/0 dừng các dịch vụ website theo menu và chỉ dừng Ollama nếu chính menu đã mở nó. Ollama đã chạy bên ngoài menu được giữ nguyên. Nếu dùng `npm run dev:api`, lệnh phát triển tắt menu tương tác; khởi động Ollama riêng bằng `ollama serve`.

Mặc định `AI_CONTEXT_SIZE=32768`, `AI_THINKING=medium`. Context chọn ở admin được lưu vào database và đưa vào `options.num_ctx` cho yêu cầu tiếp theo. Medium dùng giới hạn sinh 4.096 token (bao gồm suy luận và câu trả lời); high 8.192. Đây là mức tài nguyên của ứng dụng. Qwen đang dùng `think=true`, không khẳng định model có thang medium riêng khi `/api/show` chưa công bố. Cấu hình cá nhân trong `.env` được ưu tiên; không commit khóa SMTP/OAuth.

Đây là truy xuất dữ liệu thật theo câu hỏi, không fine-tune trọng số. Dữ kiện gồm catalog/giá sau giảm/tồn kho, mã công khai còn hạn, nội dung liên hệ đã đăng trên website, chính sách thanh toán/đổi trả/điểm, ngày giờ Việt Nam. Chưa công bố chương trình tháng sau hay ngày nhập hàng thì AI phải nói chưa có dữ liệu. Nhân viên được coi là đang online khi tab admin đang hiển thị gửi heartbeat trong 90 giây gần nhất; không đảm bảo họ trả lời ngay.

Model sinh toàn bộ lời đáp qua `/api/chat` streaming. Server không dựng đáp án FAQ hoặc thay lỗi bằng câu trả lời mẫu. Suy luận nội bộ không đưa ra UI/lịch sử. EOF, giới hạn sinh, timeout và hủy giữ trạng thái chưa hoàn tất; chỉ lưu hoàn tất sau kết thúc hợp lệ và ghi database thành công. Câu trả lời có dữ liệu nguồn vẫn có thể sai; không gắn nhãn tự động đã xác minh đúng.

Tên sản phẩm hiển thị bằng tiếng Việt; thương hiệu/mã ở mô tả vẫn tham gia tìm kiếm và truy xuất AI. Khi nhiều mẫu có cùng tên tiếng Việt, AI cần làm rõ mã mẫu. Ngữ cảnh thanh toán lấy cấu hình SePay thật và mô tả điều kiện tự khớp, trường hợp cần kiểm tra, độ trễ đồng bộ. Quyền `canExecuteTransactions=false` chỉ nói AI không tự thực hiện giao dịch, không có nghĩa website phải xác nhận thanh toán thủ công.

Phân loại lỗi khi kiểm tra: giá/danh mục đã sai trong catalog là vấn đề dữ liệu; không lấy đúng sản phẩm là vấn đề truy xuất; đọc đúng dữ kiện nhưng diễn giải sai là vấn đề mô hình/chỉ dẫn. Model 4B vẫn có thể diễn giải sai dù ngữ cảnh đúng. Đánh giá câu trả lời cùng JSON dữ kiện, không suy ra đúng chỉ từ trạng thái `completed`.

Chat khách yêu cầu đăng nhập và CSRF, lịch sử theo chủ sở hữu, khóa retry không thể chuyển sang nội dung hoặc cuộc trò chuyện khác. Trình duyệt lưu mã hội thoại theo tài khoản. Staff không có quyền mở AI quản trị/báo cáo tài chính.

Điểm mới: lấy phần nguyên của tiền hàng thực trả/1.000, nhân hạng lúc đặt đơn (Đồng/Bạc x1; Vàng x1,2; Kim Cương x1,5), bỏ phần lẻ. Không tính phí giao/dịch vụ. Đổi/trả điều chỉnh điểm theo đơn và phiên bản chính sách; không cộng bù đơn cũ. Đơn được voucher thanh toán đủ còn 0đ hoàn tất ngay trong giao dịch giữ kho/tiêu mã, không tạo QR/giao dịch ngân hàng, không cộng điểm; vẫn gửi biên nhận và hỗ trợ đổi/trả.

Tham khảo giao thức: [Ollama Chat](https://docs.ollama.com/api/chat), [điều khiển thinking](https://docs.ollama.com/capabilities/thinking).

Sampling giữ theo cấu hình của model. Bản Qwen hiện cài có temperature=1, top_p=0,95, top_k=20, presence_penalty=1,5, phù hợp [khuyến nghị Qwen cho tác vụ thông thường có suy luận](https://huggingface.co/Qwen/Qwen3.5-4B#best-practices). Không ép temperature=0,12 như code cũ; cần đánh giá chất lượng từng câu, không chỉ kiểm tra stream kết thúc.
