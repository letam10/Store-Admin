# Nạp dữ liệu và training AI Local

## Nạp dữ liệu đang dùng ngay

AI Local hiện dùng RAG từ backend, chưa fine-tune model. Dữ liệu được đọc ở `server-dotnet/Data/StoreDb.cs` qua `AiChatService.BuildCustomerRetrieval`:

- Sản phẩm, danh mục, giá và tồn kho: bảng `catalog_products` trong database `StoreDb`; có thể cập nhật từ Admin → Hàng hóa.
- Nội dung thương hiệu, liên hệ và hỗ trợ: phần Appearance trong database; cập nhật từ Admin → Storefront.
- Dữ liệu quản trị như doanh thu và đơn hàng: backend tính trực tiếp từ database, AI không tự đoán số liệu.

Sau khi cập nhật dữ liệu trong Admin, mở lại cuộc trò chuyện để AI truy vấn dữ liệu mới. Không cần đưa file dữ liệu vào `src/` hoặc `public/`.

## Fine-tune sau này

`ai/training/` hiện chỉ là nơi ghi quy ước. Dataset, checkpoint và output đặt trong các thư mục đã ignore ở `ai/`, không commit lên GitHub. Muốn fine-tune cần chuẩn bị các cặp câu hỏi/trả lời đã kiểm duyệt, chạy quy trình LoRA riêng, rồi cấu hình Ollama dùng model đã tạo. Fine-tune không thay thế dữ liệu RAG và chưa được tự động hóa trong dự án hiện tại.
