-- =========================================================
-- SQL Server Migration Script for Store / Store-Admin
-- Compatible with Microsoft SQL Server 2019 / 2022 / 2025
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
  created_at NVARCHAR(100) NOT NULL
);
GO

-- 3. Table: admin_sessions
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'admin_sessions')
CREATE TABLE admin_sessions (
  token_hash NVARCHAR(255) PRIMARY KEY,
  admin_id INT NOT NULL FOREIGN KEY REFERENCES admins(id) ON DELETE CASCADE,
  expires_at NVARCHAR(100) NOT NULL,
  created_at NVARCHAR(100) NOT NULL
);
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
  paid_goods_total INT NOT NULL DEFAULT 0,
  spin_credits INT NOT NULL DEFAULT 0,
  created_at NVARCHAR(100) NOT NULL
);
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
  status NVARCHAR(50) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid')),
  points_earned INT NOT NULL DEFAULT 0,
  created_at NVARCHAR(100) NOT NULL,
  paid_at NVARCHAR(100) NULL,
  invoice_email_sent_at NVARCHAR(100) NULL
);
GO
IF COL_LENGTH('customer_orders', 'invoice_email_sent_at') IS NULL
  ALTER TABLE customer_orders ADD invoice_email_sent_at NVARCHAR(100) NULL;
GO

-- 19. Table: Products (Yêu cầu đề thi giáo viên: Id, Name, Price, Category)
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

-- catalog_products duoc dong bo tu shared/catalog-manifest.json boi StoreDb.SeedDefaultProducts.
-- Khong seed ban ghi mau rieng de tranh tao catalog ngoai 1000 ID da curation.
GO
