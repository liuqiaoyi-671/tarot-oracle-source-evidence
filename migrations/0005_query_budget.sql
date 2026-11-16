-- 新增持久计算闸门和统计快照；不修改用户余额或解读内容。
CREATE TABLE IF NOT EXISTS maintenance_jobs (
  k TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  next_run INTEGER NOT NULL,
  day TEXT NOT NULL,
  runs INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS stats_snapshots (
  days INTEGER PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_redeem_user_batch ON redeem_codes(used_by,batch);
CREATE INDEX IF NOT EXISTS idx_reading_reserved_created ON reading_requests(created_at) WHERE status='reserved';
CREATE INDEX IF NOT EXISTS idx_reading_output_created ON reading_requests(created_at) WHERE output_text<>'';
CREATE INDEX IF NOT EXISTS idx_reading_finished_created ON reading_requests(created_at) WHERE status<>'reserved';
