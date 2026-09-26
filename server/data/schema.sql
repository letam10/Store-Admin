-- PostgreSQL Schema for Store and Store-Admin
-- Compatible with PostgreSQL 14, 15, 16, 17, 18+

CREATE TABLE IF NOT EXISTS backend_owner (
  singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
  pid INTEGER NOT NULL,
  token TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_username_lower ON admins(LOWER(username));

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('support', 'admin')),
  owner_key TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  memory_json TEXT NOT NULL DEFAULT '{}',
  compact_status TEXT NOT NULL DEFAULT 'not_needed',
  last_compacted_message_id INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_conversations_owner ON conversations(kind, owner_key, updated_at);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 1,
  sources_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, id);

CREATE TABLE IF NOT EXISTS chat_turns (
  id SERIAL PRIMARY KEY,
  request_id TEXT NOT NULL,
  owner_key TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('support', 'admin')),
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  assistant_message_id INTEGER,
  user_content TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'failed', 'stopped')),
  assistant_content TEXT NOT NULL DEFAULT '',
  sources_json TEXT NOT NULL DEFAULT '[]',
  report_json TEXT NOT NULL DEFAULT 'null',
  verified_json TEXT NOT NULL DEFAULT 'null',
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(owner_key, request_id)
);
CREATE INDEX IF NOT EXISTS idx_chat_turns_conversation ON chat_turns(conversation_id, id);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  business_date TEXT NOT NULL,
  status TEXT NOT NULL,
  total_amount INTEGER NOT NULL CHECK(total_amount >= 0),
  refund_amount INTEGER NOT NULL DEFAULT 0 CHECK(refund_amount >= 0),
  is_demo INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS catalog_products (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price INTEGER NOT NULL CHECK(price >= 0),
  description TEXT NOT NULL,
  image TEXT NOT NULL,
  features_json TEXT NOT NULL DEFAULT '[]',
  tone TEXT NOT NULL,
  symbol TEXT NOT NULL,
  label TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_price_cents INTEGER NOT NULL CHECK(source_price_cents >= 0),
  source_currency TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  discount_percent INTEGER NOT NULL DEFAULT 0 CHECK(discount_percent BETWEEN 0 AND 90),
  stock_count INTEGER NOT NULL DEFAULT 20 CHECK(stock_count >= 0),
  UNIQUE(source, source_id)
);
CREATE INDEX IF NOT EXISTS idx_catalog_products_category ON catalog_products(category, name);

CREATE TABLE IF NOT EXISTS product_views (
  product_id TEXT PRIMARY KEY,
  view_count INTEGER NOT NULL DEFAULT 0 CHECK(view_count >= 0)
);

CREATE TABLE IF NOT EXISTS admin_records (
  id SERIAL PRIMARY KEY,
  module TEXT NOT NULL,
  title TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'Đang dùng',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_records_module ON admin_records(module, updated_at);

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  paid_goods_total INTEGER NOT NULL DEFAULT 0,
  spin_credits INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_username_lower ON customers(LOWER(username));
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email_lower ON customers(LOWER(email));

CREATE TABLE IF NOT EXISTS customer_sessions (
  token_hash TEXT PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS voucher_codes (
  code TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_vouchers (
  code TEXT PRIMARY KEY REFERENCES voucher_codes(code),
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('amount','percent')),
  value INTEGER NOT NULL CHECK(value > 0),
  scope TEXT NOT NULL DEFAULT 'goods' CHECK(scope IN ('goods','shipping')),
  expires_at TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_customer_vouchers_owner ON customer_vouchers(customer_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_customer_vouchers_expiry ON customer_vouchers(expires_at);

CREATE TABLE IF NOT EXISTS customer_favorites (
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(customer_id, product_id)
);

CREATE TABLE IF NOT EXISTS product_reviews (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL,
  admin_reply TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  replied_at TEXT,
  UNIQUE(customer_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_id, created_at);

CREATE TABLE IF NOT EXISTS customer_orders (
  id TEXT PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  items_json TEXT NOT NULL,
  recipient TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  fulfillment TEXT NOT NULL,
  region TEXT NOT NULL,
  distance_km INTEGER NOT NULL DEFAULT 0,
  weight_kg DOUBLE PRECISION NOT NULL DEFAULT 1,
  subtotal INTEGER NOT NULL,
  discount INTEGER NOT NULL,
  goods_total INTEGER NOT NULL,
  shipping_fee INTEGER NOT NULL,
  total INTEGER NOT NULL,
  voucher_codes_json TEXT NOT NULL,
  tier TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','paid')),
  points_earned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  paid_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_customer_orders_owner ON customer_orders(customer_id, created_at);
