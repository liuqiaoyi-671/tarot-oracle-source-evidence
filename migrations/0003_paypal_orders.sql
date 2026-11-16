-- PayPal 独立订单和次数账本；不改变已有用户数据。
CREATE TABLE IF NOT EXISTS paypal_orders (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  request_key TEXT NOT NULL,
  mode TEXT NOT NULL CHECK(mode IN ('sandbox','live')),
  paypal_id TEXT UNIQUE,
  capture_id TEXT UNIQUE,
  approval_url TEXT,
  status TEXT NOT NULL DEFAULT 'created',
  credits INTEGER NOT NULL DEFAULT 10,
  amount TEXT NOT NULL DEFAULT '3.99',
  currency TEXT NOT NULL DEFAULT 'USD',
  merchant_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id,request_key)
);
CREATE INDEX IF NOT EXISTS idx_paypal_orders_user ON paypal_orders(user_id,created_at);
CREATE TABLE IF NOT EXISTS paypal_credit_ledger (
  order_id TEXT NOT NULL REFERENCES paypal_orders(id),
  kind TEXT NOT NULL CHECK(kind IN ('grant','revoke')),
  user_id INTEGER NOT NULL REFERENCES users(id),
  delta INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(order_id,kind)
);
CREATE TRIGGER IF NOT EXISTS paypal_apply_credit AFTER INSERT ON paypal_credit_ledger
BEGIN
  UPDATE users SET credits=credits+NEW.delta WHERE id=NEW.user_id;
END;
CREATE TABLE IF NOT EXISTS paypal_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  order_id TEXT,
  processed_at INTEGER NOT NULL
);
