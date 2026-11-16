-- 新增请求账本；不修改现有用户、兑换码或历史数据。
CREATE TABLE IF NOT EXISTS reading_requests (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','reserved','denied','complete','failed','interrupted')),
  pay_mode TEXT NOT NULL,
  cost INTEGER NOT NULL,
  quota_key TEXT NOT NULL,
  ip_key TEXT NOT NULL DEFAULT '',
  user_id INTEGER,
  created_at INTEGER NOT NULL,
  refunded INTEGER NOT NULL DEFAULT 0,
  output_text TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_reading_requests_created ON reading_requests(created_at);
