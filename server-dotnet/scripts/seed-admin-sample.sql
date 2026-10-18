-- Nạp một lần dữ liệu kiểm thử vào StoreDb hiện tại.
-- Script idempotent: không xóa hoặc ghi đè dữ liệu đang có.
USE [StoreDb];
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @customerId BIGINT = (SELECT TOP 1 id FROM customers ORDER BY id);
DECLARE @productId NVARCHAR(255) = (SELECT TOP 1 id FROM catalog_products ORDER BY id);
DECLARE @reviewProductId NVARCHAR(255) = (SELECT TOP 1 id FROM catalog_products WHERE id <> @productId ORDER BY id);
DECLARE @productName NVARCHAR(500) = (SELECT name FROM catalog_products WHERE id = @productId);
DECLARE @productPrice BIGINT = (SELECT price FROM catalog_products WHERE id = @productId);
DECLARE @now NVARCHAR(100) = CONVERT(NVARCHAR(100), SYSUTCDATETIME(), 127);
DECLARE @expires NVARCHAR(100) = CONVERT(NVARCHAR(10), DATEADD(DAY, 30, SYSUTCDATETIME()), 23);
DECLARE @orderId NVARCHAR(255) = N'TEST-ORDER-20261018-001';
DECLARE @voucherCode NVARCHAR(255) = N'TEST10K-20261018';

IF @customerId IS NULL OR @productId IS NULL OR @reviewProductId IS NULL
    THROW 51001, 'StoreDb chua co customer hoac catalog product de seed du lieu test.', 1;

IF NOT EXISTS (SELECT 1 FROM product_views WHERE product_id = @productId)
    INSERT INTO product_views(product_id, view_count) VALUES(@productId, 42);

IF NOT EXISTS (SELECT 1 FROM product_views WHERE product_id = @reviewProductId)
    INSERT INTO product_views(product_id, view_count) VALUES(@reviewProductId, 17);

IF NOT EXISTS (SELECT 1 FROM customer_favorites WHERE customer_id = @customerId AND product_id = @productId)
    INSERT INTO customer_favorites(customer_id, product_id, created_at) VALUES(@customerId, @productId, @now);

IF NOT EXISTS (SELECT 1 FROM product_reviews WHERE customer_id = @customerId AND product_id = @reviewProductId)
    INSERT INTO product_reviews(customer_id, product_id, rating, comment, admin_reply, created_at)
    VALUES(@customerId, @reviewProductId, 5, N'Dữ liệu kiểm thử: sản phẩm hiển thị tốt và giao diện dễ thao tác.', N'', @now);

IF NOT EXISTS (SELECT 1 FROM voucher_codes WHERE code = @voucherCode)
    INSERT INTO voucher_codes(code, created_at) VALUES(@voucherCode, @now);

IF NOT EXISTS (SELECT 1 FROM customer_vouchers WHERE code = @voucherCode)
    INSERT INTO customer_vouchers(code, customer_id, label, type, value, scope, expires_at, source, created_at)
    VALUES(@voucherCode, @customerId, N'Voucher kiểm thử Store 10.000 đ', N'amount', 10000, N'goods', @expires, N'seed-test', @now);

IF NOT EXISTS (SELECT 1 FROM customer_orders WHERE id = @orderId)
    INSERT INTO customer_orders
    (id, customer_id, items_json, recipient, phone, address, fulfillment, region, distance_km, weight_kg,
     subtotal, discount, goods_total, shipping_fee, total, voucher_codes_json, tier, status, points_earned,
     created_at, paid_at, payment_method, scheduled_at)
    VALUES
    (@orderId, @customerId,
     N'[{"id":"' + @productId + N'","name":' + QUOTENAME(@productName, '"') + N',"quantity":1,"price":' + CONVERT(NVARCHAR(30), @productPrice) + N'}]',
     N'letam10', N'0900000000', N'Địa chỉ kiểm thử Store', N'delivery', N'hcm', 0, 1,
     CONVERT(INT, @productPrice), 10000, CONVERT(INT, @productPrice) - 10000, 30000,
     CONVERT(INT, @productPrice) - 10000 + 30000, N'["' + @voucherCode + N'"]', N'silver', N'paid', 500,
     @now, @now, N'bank_transfer', NULL);

IF NOT EXISTS (SELECT 1 FROM orders WHERE id = N'TEST-BUSINESS-20261018-001')
    INSERT INTO orders(id, business_date, status, total_amount, refund_amount, is_demo)
    VALUES(N'TEST-BUSINESS-20261018-001', CONVERT(NVARCHAR(10), SYSUTCDATETIME(), 23), N'paid', CONVERT(INT, @productPrice) - 10000 + 30000, 0, 1);

DECLARE @records TABLE(module NVARCHAR(255), title NVARCHAR(500), data_json NVARCHAR(MAX), status NVARCHAR(100));
INSERT INTO @records(module, title, data_json, status) VALUES
    (N'inventory', N'Mẫu kiểm thử · Phiếu nhập kho', N'{"sku":"' + @productId + N'","location":"Kho chính","quantity":"120","note":"Bổ sung dữ liệu kiểm thử"}', N'Đang dùng'),
    (N'logistics', N'Mẫu kiểm thử · Giao đơn Store', N'{"order":"' + @orderId + N'","carrier":"Store Express","status":"Đang xử lý","eta":"2026-10-20"}', N'Đang xử lý'),
    (N'returns', N'Mẫu kiểm thử · Yêu cầu đổi hàng', N'{"customer":"letam10","order":"' + @orderId + N'","reason":"Đổi ý","assignee":"CSKH"}', N'Chờ duyệt'),
    (N'order-types', N'Mẫu kiểm thử · Đơn ưu tiên', N'{"priority":"Cao","sla":"24 giờ","note":"Đơn kiểm tra luồng Admin"}', N'Đang dùng'),
    (N'support', N'Mẫu kiểm thử · Hỗ trợ mua hàng', N'{"customer":"letam10","topic":"Hỗ trợ mua hàng","assignee":"CSKH 01","email":"ledominhtam1998@gmail.com","message":"Yêu cầu kiểm tra đơn mẫu."}', N'Chờ duyệt'),
    (N'staff', N'Mẫu kiểm thử · Nhân viên CSKH', N'{"role":"CSKH","shift":"Ca sáng","login":"support.demo"}', N'Đang dùng'),
    (N'overtime', N'Mẫu kiểm thử · Khen thưởng', N'{"kind":"Khen thưởng","value":"100 điểm","note":"Xử lý đơn mẫu đúng hạn"}', N'Đã duyệt');

INSERT INTO admin_records(module, title, data_json, status, created_at, updated_at)
SELECT r.module, r.title, r.data_json, r.status, @now, @now
FROM @records r
WHERE NOT EXISTS (SELECT 1 FROM admin_records a WHERE a.module = r.module AND a.title = r.title);

COMMIT TRANSACTION;
GO

SELECT
    (SELECT COUNT(*) FROM catalog_products) AS catalog_count,
    (SELECT COUNT(*) FROM customers) AS customer_count,
    (SELECT COUNT(*) FROM customer_orders) AS customer_order_count,
    (SELECT COUNT(*) FROM product_reviews) AS review_count,
    (SELECT COUNT(*) FROM customer_vouchers) AS voucher_count,
    (SELECT COUNT(*) FROM admin_records) AS admin_record_count;
GO
