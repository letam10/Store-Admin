/*
  FILE NOTE
  - Mục đích: Khởi tạo schema cơ sở dữ liệu SQL Server cho hệ thống Store & Store-Admin
  - Liên kết trực tiếp: Store-Admin/sync-db.ps1, Store-Admin/server-dotnet/Data/StoreDb.cs
  - Vùng ảnh hưởng khi sửa: Toàn bộ cấu trúc bảng và khóa ngoại khi thành viên chạy sync-db
*/
-- =========================================================
-- SQL Server Migration Script for Store / Store-Admin
-- Compatible with Microsoft SQL Server 2017 / 2019 / 2022 / LocalDB
-- =========================================================

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'StoreDb')
BEGIN
    CREATE DATABASE StoreDb;
END
GO

USE StoreDb;
GO

-- 1. Table: backend_owner
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'backend_owner')
CREATE TABLE backend_owner (
  singleton INT PRIMARY KEY CHECK(singleton = 1),
  pid INT NOT NULL,
  token NVARCHAR(MAX) NOT NULL
);
GO

-- 2. Table: admins
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'admins')
CREATE TABLE admins (
  id INT IDENTITY(1,1) PRIMARY KEY,
  username NVARCHAR(255) NOT NULL UNIQUE,
  password_salt NVARCHAR(MAX) NOT NULL,
  password_hash NVARCHAR(MAX) NOT NULL,
  created_at NVARCHAR(100) NOT NULL,
  role NVARCHAR(20) NOT NULL DEFAULT 'admin',
  display_name NVARCHAR(255) NOT NULL DEFAULT '',
  email NVARCHAR(255) NOT NULL DEFAULT '',
  active BIT NOT NULL DEFAULT 1
);
GO
IF COL_LENGTH('admins', 'role') IS NULL
  ALTER TABLE admins ADD role NVARCHAR(20) NOT NULL DEFAULT 'admin';
GO
IF COL_LENGTH('admins', 'display_name') IS NULL
  ALTER TABLE admins ADD display_name NVARCHAR(255) NOT NULL DEFAULT '';
GO
IF COL_LENGTH('admins', 'email') IS NULL
  ALTER TABLE admins ADD email NVARCHAR(255) NOT NULL DEFAULT '';
GO
IF COL_LENGTH('admins', 'active') IS NULL
  ALTER TABLE admins ADD active BIT NOT NULL DEFAULT 1;
GO

-- 3. Table: admin_sessions
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'admin_sessions')
CREATE TABLE admin_sessions (
  token_hash NVARCHAR(255) PRIMARY KEY,
  admin_id INT NOT NULL FOREIGN KEY REFERENCES admins(id) ON DELETE CASCADE,
  expires_at NVARCHAR(100) NOT NULL,
  created_at NVARCHAR(100) NOT NULL,
  last_seen_at DATETIMEOFFSET NULL
);
GO
IF COL_LENGTH('admin_sessions', 'last_seen_at') IS NULL
  ALTER TABLE admin_sessions ADD last_seen_at DATETIMEOFFSET NULL;
GO

-- 4. Table: settings
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'settings')
CREATE TABLE settings (
  [key] NVARCHAR(255) PRIMARY KEY,
  value NVARCHAR(MAX) NOT NULL,
  updated_at NVARCHAR(100) NOT NULL
);
GO

-- 5. Table: conversations
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'conversations')
CREATE TABLE conversations (
  id NVARCHAR(255) PRIMARY KEY,
  kind NVARCHAR(50) NOT NULL CHECK(kind IN ('support', 'admin')),
  owner_key NVARCHAR(255) NOT NULL,
  summary NVARCHAR(MAX) NOT NULL DEFAULT '',
  memory_json NVARCHAR(MAX) NOT NULL DEFAULT '{}',
  compact_status NVARCHAR(50) NOT NULL DEFAULT 'not_needed',
  last_compacted_message_id INT NOT NULL DEFAULT 0,
  created_at NVARCHAR(100) NOT NULL,
  updated_at NVARCHAR(100) NOT NULL
);
GO

-- 6. Table: messages
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'messages')
CREATE TABLE messages (
  id INT IDENTITY(1,1) PRIMARY KEY,
  conversation_id NVARCHAR(255) NOT NULL FOREIGN KEY REFERENCES conversations(id) ON DELETE CASCADE,
  role NVARCHAR(50) NOT NULL CHECK(role IN ('user', 'assistant')),
  content NVARCHAR(MAX) NOT NULL,
  completed INT NOT NULL DEFAULT 1,
  sources_json NVARCHAR(MAX) NOT NULL DEFAULT '[]',
  created_at NVARCHAR(100) NOT NULL
);
GO

-- 7. Table: chat_turns
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'chat_turns')
CREATE TABLE chat_turns (
  id INT IDENTITY(1,1) PRIMARY KEY,
  request_id NVARCHAR(255) NOT NULL,
  owner_key NVARCHAR(255) NOT NULL,
  kind NVARCHAR(50) NOT NULL CHECK(kind IN ('support', 'admin')),
  conversation_id NVARCHAR(255) NOT NULL FOREIGN KEY REFERENCES conversations(id) ON DELETE CASCADE,
  user_message_id INT NOT NULL FOREIGN KEY REFERENCES messages(id) ON DELETE NO ACTION,
  assistant_message_id INT NULL,
  user_content NVARCHAR(MAX) NOT NULL,
  status NVARCHAR(50) NOT NULL CHECK(status IN ('running', 'completed', 'failed', 'stopped')),
  assistant_content NVARCHAR(MAX) NOT NULL DEFAULT '',
  sources_json NVARCHAR(MAX) NOT NULL DEFAULT '[]',
  report_json NVARCHAR(MAX) NOT NULL DEFAULT 'null',
  verified_json NVARCHAR(MAX) NOT NULL DEFAULT 'null',
  error_code NVARCHAR(255) NULL,
  created_at NVARCHAR(100) NOT NULL,
  updated_at NVARCHAR(100) NOT NULL,
  CONSTRAINT UQ_chat_turns_owner_req UNIQUE(owner_key, request_id)
);
GO

-- 8. Table: orders
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'orders')
CREATE TABLE orders (
  id NVARCHAR(255) PRIMARY KEY,
  business_date NVARCHAR(50) NOT NULL,
  status NVARCHAR(50) NOT NULL,
  total_amount INT NOT NULL CHECK(total_amount >= 0),
  refund_amount INT NOT NULL DEFAULT 0 CHECK(refund_amount >= 0),
  is_demo INT NOT NULL DEFAULT 0
);
GO

-- 9. Table: catalog_products
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'catalog_products')
CREATE TABLE catalog_products (
  id NVARCHAR(255) PRIMARY KEY,
  source NVARCHAR(100) NOT NULL DEFAULT 'local',
  source_id NVARCHAR(255) NOT NULL DEFAULT '',
  name NVARCHAR(500) NOT NULL,
  category NVARCHAR(255) NOT NULL,
  price BIGINT NOT NULL CHECK(price >= 0),
  description NVARCHAR(MAX) NOT NULL,
  image NVARCHAR(MAX) NOT NULL,
  features_json NVARCHAR(MAX) NOT NULL DEFAULT '[]',
  tone NVARCHAR(100) NOT NULL DEFAULT 'neutral',
  symbol NVARCHAR(50) NOT NULL DEFAULT '',
  label NVARCHAR(255) NOT NULL DEFAULT '',
  source_url NVARCHAR(MAX) NOT NULL DEFAULT '',
  source_price_cents INT NOT NULL DEFAULT 0 CHECK(source_price_cents >= 0),
  source_currency NVARCHAR(20) NOT NULL DEFAULT 'VND',
  imported_at NVARCHAR(100) NOT NULL DEFAULT '',
  discount_percent INT NOT NULL DEFAULT 0 CHECK(discount_percent BETWEEN 0 AND 90),
  stock_count INT NOT NULL DEFAULT 20 CHECK(stock_count >= 0)
);
GO

-- 10. Table: product_views
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'product_views')
CREATE TABLE product_views (
  product_id NVARCHAR(255) PRIMARY KEY,
  view_count INT NOT NULL DEFAULT 0 CHECK(view_count >= 0)
);
GO
-- Don dep ban ghi mo coi truoc khi gan khoa ngoai de tranh loi conflict Msg 547
DELETE FROM product_views WHERE product_id NOT IN (SELECT id FROM catalog_products);
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_product_views_catalog_products')
  ALTER TABLE product_views ADD CONSTRAINT FK_product_views_catalog_products
    FOREIGN KEY (product_id) REFERENCES catalog_products(id) ON DELETE CASCADE;
GO

-- 11. Table: admin_records
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'admin_records')
CREATE TABLE admin_records (
  id INT IDENTITY(1,1) PRIMARY KEY,
  module NVARCHAR(255) NOT NULL,
  title NVARCHAR(500) NOT NULL,
  data_json NVARCHAR(MAX) NOT NULL DEFAULT '{}',
  status NVARCHAR(100) NOT NULL DEFAULT N'Đang dùng',
  created_at NVARCHAR(100) NOT NULL,
  updated_at NVARCHAR(100) NOT NULL
);
GO

-- 12. Table: customers
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'customers')
CREATE TABLE customers (
  id BIGINT IDENTITY(1,1) PRIMARY KEY,
  username NVARCHAR(255) NOT NULL UNIQUE,
  email NVARCHAR(255) NOT NULL UNIQUE,
  password_salt NVARCHAR(MAX) NOT NULL,
  password_hash NVARCHAR(MAX) NOT NULL,
  points INT NOT NULL DEFAULT 0,
  paid_goods_total BIGINT NOT NULL DEFAULT 0,
  spin_credits INT NOT NULL DEFAULT 0,
  created_at NVARCHAR(100) NOT NULL,
  google_sub NVARCHAR(255) NULL,
  totp_secret NVARCHAR(MAX) NULL,
  totp_enabled INT NOT NULL DEFAULT 0,
  totp_pending_secret NVARCHAR(MAX) NULL,
  totp_verified_at NVARCHAR(100) NULL
);
GO
IF COL_LENGTH('customers', 'google_sub') IS NULL ALTER TABLE customers ADD google_sub NVARCHAR(255) NULL;
GO
IF COL_LENGTH('customers', 'totp_secret') IS NULL ALTER TABLE customers ADD totp_secret NVARCHAR(MAX) NULL;
GO
IF COL_LENGTH('customers', 'totp_enabled') IS NULL ALTER TABLE customers ADD totp_enabled INT NOT NULL DEFAULT 0;
GO
IF COL_LENGTH('customers', 'totp_pending_secret') IS NULL ALTER TABLE customers ADD totp_pending_secret NVARCHAR(MAX) NULL;
GO
IF COL_LENGTH('customers', 'totp_verified_at') IS NULL ALTER TABLE customers ADD totp_verified_at NVARCHAR(100) NULL;
GO

-- 13. Table: customer_sessions
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'customer_sessions')
CREATE TABLE customer_sessions (
  token_hash NVARCHAR(255) PRIMARY KEY,
  customer_id BIGINT NOT NULL FOREIGN KEY REFERENCES customers(id) ON DELETE CASCADE,
  expires_at NVARCHAR(100) NOT NULL
);
GO

-- 14. Table: voucher_codes
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'voucher_codes')
CREATE TABLE voucher_codes (
  code NVARCHAR(255) PRIMARY KEY,
  created_at NVARCHAR(100) NOT NULL
);
GO

-- 15. Table: customer_vouchers
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'customer_vouchers')
CREATE TABLE customer_vouchers (
  code NVARCHAR(255) PRIMARY KEY FOREIGN KEY REFERENCES voucher_codes(code),
  customer_id BIGINT NULL FOREIGN KEY REFERENCES customers(id) ON DELETE CASCADE,
  label NVARCHAR(255) NOT NULL,
  type NVARCHAR(50) NOT NULL CHECK(type IN ('amount','percent')),
  value INT NOT NULL CHECK(value > 0),
  scope NVARCHAR(50) NOT NULL DEFAULT 'goods' CHECK(scope IN ('goods','shipping')),
  expires_at NVARCHAR(100) NOT NULL,
  source NVARCHAR(255) NOT NULL,
  created_at NVARCHAR(100) NOT NULL
);
GO
IF COL_LENGTH('customer_vouchers', 'customer_id') IS NOT NULL
  ALTER TABLE customer_vouchers ALTER COLUMN customer_id BIGINT NULL;
GO

-- 16. Table: customer_favorites
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'customer_favorites')
CREATE TABLE customer_favorites (
  customer_id BIGINT NOT NULL FOREIGN KEY REFERENCES customers(id) ON DELETE CASCADE,
  product_id NVARCHAR(255) NOT NULL,
  created_at NVARCHAR(100) NOT NULL,
  PRIMARY KEY(customer_id, product_id)
);
GO
DELETE FROM customer_favorites WHERE product_id NOT IN (SELECT id FROM catalog_products);
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_customer_favorites_catalog_products')
  ALTER TABLE customer_favorites ADD CONSTRAINT FK_customer_favorites_catalog_products
    FOREIGN KEY (product_id) REFERENCES catalog_products(id) ON DELETE CASCADE;
GO

-- 17. Table: product_reviews
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'product_reviews')
CREATE TABLE product_reviews (
  id BIGINT IDENTITY(1,1) PRIMARY KEY,
  customer_id BIGINT NOT NULL FOREIGN KEY REFERENCES customers(id) ON DELETE CASCADE,
  customer_name NVARCHAR(255) NULL,
  product_id NVARCHAR(255) NOT NULL,
  rating INT NOT NULL CHECK(rating BETWEEN 1 AND 5),
  comment NVARCHAR(MAX) NOT NULL,
  admin_reply NVARCHAR(MAX) NOT NULL DEFAULT '',
  created_at NVARCHAR(100) NOT NULL,
  replied_at NVARCHAR(100) NULL,
  CONSTRAINT UQ_reviews_customer_product UNIQUE(customer_id, product_id)
);
GO
IF COL_LENGTH('product_reviews', 'customer_name') IS NULL
  ALTER TABLE product_reviews ADD customer_name NVARCHAR(255) NULL;
GO
DELETE FROM product_reviews WHERE product_id NOT IN (SELECT id FROM catalog_products);
GO
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_product_reviews_catalog_products')
  ALTER TABLE product_reviews ADD CONSTRAINT FK_product_reviews_catalog_products
    FOREIGN KEY (product_id) REFERENCES catalog_products(id) ON DELETE CASCADE;
GO

-- 18. Table: customer_orders
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'customer_orders')
CREATE TABLE customer_orders (
  id NVARCHAR(255) PRIMARY KEY,
  customer_id BIGINT NOT NULL FOREIGN KEY REFERENCES customers(id) ON DELETE CASCADE,
  items_json NVARCHAR(MAX) NOT NULL,
  recipient NVARCHAR(255) NOT NULL DEFAULT '',
  phone NVARCHAR(50) NOT NULL DEFAULT '',
  address NVARCHAR(MAX) NOT NULL DEFAULT '',
  fulfillment NVARCHAR(100) NOT NULL,
  region NVARCHAR(100) NOT NULL,
  distance_km INT NOT NULL DEFAULT 0,
  weight_kg FLOAT NOT NULL DEFAULT 1,
  subtotal INT NOT NULL,
  discount INT NOT NULL,
  goods_total INT NOT NULL,
  shipping_fee INT NOT NULL,
  total INT NOT NULL,
  voucher_codes_json NVARCHAR(MAX) NOT NULL DEFAULT '[]',
  tier NVARCHAR(50) NOT NULL,
  status NVARCHAR(50) NOT NULL DEFAULT 'pending',
  points_earned INT NOT NULL DEFAULT 0,
  created_at NVARCHAR(100) NOT NULL,
  paid_at NVARCHAR(100) NULL,
  payment_method NVARCHAR(100) NOT NULL DEFAULT 'bank_transfer',
  scheduled_at NVARCHAR(100) NULL,
  invoice_email_sent_at NVARCHAR(100) NULL,
  refund_amount BIGINT NOT NULL DEFAULT 0,
  delivery_status NVARCHAR(30) NOT NULL DEFAULT 'processing',
  delivered_at DATETIMEOFFSET NULL,
  extra_paid BIGINT NOT NULL DEFAULT 0,
  current_items_json NVARCHAR(MAX) NULL,
  current_goods_total BIGINT NULL,
  reward_policy_version TINYINT NOT NULL DEFAULT 1
);
GO
IF COL_LENGTH('customer_orders', 'refund_amount') IS NULL
  ALTER TABLE customer_orders ADD refund_amount BIGINT NOT NULL DEFAULT 0;
GO
IF COL_LENGTH('customer_orders', 'payment_method') IS NULL
  ALTER TABLE customer_orders ADD payment_method NVARCHAR(100) NOT NULL DEFAULT 'bank_transfer';
GO
IF COL_LENGTH('customer_orders', 'scheduled_at') IS NULL
  ALTER TABLE customer_orders ADD scheduled_at NVARCHAR(100) NULL;
GO
IF COL_LENGTH('customer_orders', 'weight_kg') IS NULL
  ALTER TABLE customer_orders ADD weight_kg FLOAT NOT NULL DEFAULT 1;
GO
IF COL_LENGTH('customer_orders', 'invoice_email_sent_at') IS NULL
  ALTER TABLE customer_orders ADD invoice_email_sent_at NVARCHAR(100) NULL;
GO
IF COL_LENGTH('customer_orders', 'delivery_status') IS NULL
  ALTER TABLE customer_orders ADD delivery_status NVARCHAR(30) NOT NULL DEFAULT 'processing';
GO
IF COL_LENGTH('customer_orders', 'reward_policy_version') IS NULL
  ALTER TABLE customer_orders ADD reward_policy_version TINYINT NOT NULL DEFAULT 1;
GO
IF COL_LENGTH('customer_orders', 'delivered_at') IS NULL
  ALTER TABLE customer_orders ADD delivered_at DATETIMEOFFSET NULL;
GO
IF COL_LENGTH('customer_orders', 'extra_paid') IS NULL
  ALTER TABLE customer_orders ADD extra_paid BIGINT NOT NULL DEFAULT 0;
GO
IF COL_LENGTH('customer_orders', 'current_items_json') IS NULL
  ALTER TABLE customer_orders ADD current_items_json NVARCHAR(MAX) NULL;
GO
IF COL_LENGTH('customer_orders', 'current_goods_total') IS NULL
  ALTER TABLE customer_orders ADD current_goods_total BIGINT NULL;
GO

-- 19. Table: checkout_intents
IF OBJECT_ID('checkout_intents') IS NULL
CREATE TABLE checkout_intents(
  order_id NVARCHAR(255) PRIMARY KEY REFERENCES customer_orders(id),
  customer_id BIGINT NOT NULL,
  request_id NVARCHAR(64) NOT NULL,
  request_hash NVARCHAR(64) NOT NULL,
  state NVARCHAR(30) NOT NULL,
  expires_at DATETIMEOFFSET NULL,
  bank_json NVARCHAR(MAX) NULL,
  stock_reserved BIT NOT NULL DEFAULT 0,
  reported_at DATETIMEOFFSET NULL,
  report_reference NVARCHAR(100) NULL,
  payment_reference NVARCHAR(100) NULL,
  received_at DATETIMEOFFSET NULL,
  UNIQUE(customer_id, request_id)
);
GO

-- 20. Table: checkout_voucher_holds
IF OBJECT_ID('checkout_voucher_holds') IS NULL
CREATE TABLE checkout_voucher_holds(
  code NVARCHAR(255) PRIMARY KEY REFERENCES customer_vouchers(code),
  order_id NVARCHAR(255) NOT NULL REFERENCES customer_orders(id)
);
GO

-- 21. Table: bank_payment_receipts
IF OBJECT_ID('bank_payment_receipts') IS NULL
CREATE TABLE bank_payment_receipts(
  reference_hash NVARCHAR(64) PRIMARY KEY,
  order_id NVARCHAR(255) NOT NULL UNIQUE,
  reference NVARCHAR(100) NOT NULL,
  amount BIGINT NOT NULL,
  received_at DATETIMEOFFSET NOT NULL
);
GO

-- 22. Table: notification_outbox
IF OBJECT_ID('notification_outbox') IS NULL
CREATE TABLE notification_outbox(
  job_key NVARCHAR(160) PRIMARY KEY,
  kind NVARCHAR(40) NOT NULL,
  payload NVARCHAR(MAX) NOT NULL,
  status NVARCHAR(20) NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  available_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  leased_until DATETIMEOFFSET NULL,
  sent_at DATETIMEOFFSET NULL,
  last_error NVARCHAR(500) NULL
);
GO

-- 23. Table: after_sales_refunds
IF OBJECT_ID('after_sales_refunds') IS NULL
CREATE TABLE after_sales_refunds(
  case_id NVARCHAR(100) PRIMARY KEY,
  reference_hash NVARCHAR(64) NOT NULL UNIQUE,
  reference NVARCHAR(100) NOT NULL,
  amount BIGINT NOT NULL,
  refunded_at DATETIMEOFFSET NOT NULL
);
GO

-- 24. Table: sepay_transactions
IF OBJECT_ID('sepay_transactions') IS NULL
BEGIN
  CREATE TABLE sepay_transactions(
    transaction_id BIGINT PRIMARY KEY,
    fingerprint NVARCHAR(64) NOT NULL,
    payment_id NVARCHAR(100) NULL,
    reference NVARCHAR(100) NOT NULL,
    amount BIGINT NOT NULL,
    received_at DATETIMEOFFSET NOT NULL,
    content NVARCHAR(2000) NOT NULL,
    state NVARCHAR(30) NOT NULL,
    reason NVARCHAR(100) NULL,
    imported_at DATETIMEOFFSET NOT NULL
  );
  CREATE INDEX IX_sepay_payment ON sepay_transactions(payment_id, received_at);
END;
GO

-- 25. Table: checkout_unmatched_payments
IF OBJECT_ID('checkout_unmatched_payments') IS NULL
BEGIN
  CREATE TABLE checkout_unmatched_payments(
    id NVARCHAR(100) PRIMARY KEY,
    order_id NVARCHAR(255) NOT NULL REFERENCES customer_orders(id),
    request_id NVARCHAR(64) NOT NULL,
    request_hash NVARCHAR(64) NOT NULL,
    reference NVARCHAR(100) NOT NULL,
    amount BIGINT NOT NULL CHECK(amount > 0),
    received_at DATETIMEOFFSET NOT NULL,
    reason NVARCHAR(1000) NOT NULL,
    recorded_by BIGINT NOT NULL,
    created_at DATETIMEOFFSET NOT NULL,
    refund_reference NVARCHAR(100) NULL,
    refunded_at DATETIMEOFFSET NULL,
    refunded_by BIGINT NULL,
    refund_hash NVARCHAR(64) NULL,
    UNIQUE(order_id, request_id)
  );
  CREATE INDEX IX_checkout_unmatched_order ON checkout_unmatched_payments(order_id, created_at);
END;
GO

-- 26. Table: admin_events
IF OBJECT_ID('admin_events') IS NULL
CREATE TABLE admin_events(
  id BIGINT IDENTITY(1,1) PRIMARY KEY,
  event_key NVARCHAR(160) NOT NULL UNIQUE,
  kind NVARCHAR(40) NOT NULL,
  payload NVARCHAR(MAX) NOT NULL,
  created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);
GO

-- 27. Table: password_resets
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'password_resets')
CREATE TABLE password_resets (
  token_hash NVARCHAR(255) PRIMARY KEY,
  customer_id BIGINT NOT NULL FOREIGN KEY REFERENCES customers(id) ON DELETE CASCADE,
  expires_at NVARCHAR(100) NOT NULL,
  used_at NVARCHAR(100) NULL,
  created_at NVARCHAR(100) NOT NULL
);
GO

-- 28. Table: oauth_states
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'oauth_states')
CREATE TABLE oauth_states (
  state NVARCHAR(255) PRIMARY KEY,
  next_url NVARCHAR(500) NOT NULL DEFAULT '/account',
  expires_at NVARCHAR(100) NOT NULL,
  created_at NVARCHAR(100) NOT NULL
);
GO

-- 29. Table: login_challenges
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'login_challenges')
CREATE TABLE login_challenges (
  id NVARCHAR(255) PRIMARY KEY,
  customer_id BIGINT NOT NULL FOREIGN KEY REFERENCES customers(id) ON DELETE CASCADE,
  expires_at NVARCHAR(100) NOT NULL,
  created_at NVARCHAR(100) NOT NULL
);
GO

-- 30. Table: customer_totp_backups
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'customer_totp_backups')
CREATE TABLE customer_totp_backups (
  id BIGINT IDENTITY(1,1) PRIMARY KEY,
  customer_id BIGINT NOT NULL FOREIGN KEY REFERENCES customers(id) ON DELETE CASCADE,
  code_hash NVARCHAR(255) NOT NULL,
  used_at NVARCHAR(100) NULL,
  created_at NVARCHAR(100) NOT NULL
);
GO

-- 31. Table: Products (Yêu cầu đề thi giáo viên: Id, Name, Price, Category)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Products')
CREATE TABLE Products (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  Name NVARCHAR(255) NOT NULL,
  Price DECIMAL(18,2) NOT NULL,
  Category NVARCHAR(255) NOT NULL,
  Description NVARCHAR(MAX) NULL,
  Image NVARCHAR(MAX) NULL
);
GO

-- Seed sample data vào Products nếu bảng rỗng
IF NOT EXISTS (SELECT 1 FROM Products)
BEGIN
    INSERT INTO Products (Name, Price, Category, Description, Image) VALUES
    (N'Tai nghe Everyday', 890000, N'Điện tử', N'Tai nghe chống ồn công nghệ cao', N'/products/headphones.svg'),
    (N'Túi Everyday Tote', 249000, N'Trang phục', N'Túi vải Canvas phong cách tối giản', N'/products/bag.svg'),
    (N'Đồng hồ Minimal', 1290000, N'Phụ kiện', N'Đồng hồ đeo tay phong cách Bauhaus', N'/products/watch.svg'),
    (N'Ly cà phê Morning', 159000, N'Đồ gia dụng', N'Ly sứ giữ nhiệt cao cấp', N'/products/cup.svg'),
    (N'Bàn phím cơ Không Dây', 1450000, N'Điện tử', N'Bàn phím cơ layout 75% switch êm ái', N'/products/keyboard.svg'),
    (N'Bình nước thể thao 1L', 180000, N'Đồ gia dụng', N'Bình giữ nhiệt inox 304', N'/products/bottle.svg');
END
GO
