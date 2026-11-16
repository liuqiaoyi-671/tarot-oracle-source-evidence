-- 塔罗神谕 · 账号系统 D1 (SQLite) 表结构
-- 应用方式：wrangler d1 execute <db> --file=schema.sql  （--local 本地 / --remote 线上）

CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  email          TEXT UNIQUE NOT NULL,
  pass           TEXT NOT NULL,              -- PBKDF2 格式： 迭代次数:salt_b64:hash_b64
  created_at     INTEGER NOT NULL,
  credits        INTEGER NOT NULL DEFAULT 0, -- 付费次数余额（1 credit = 1 次 AI 生成）
  membership     TEXT    NOT NULL DEFAULT '', -- 会员到期时间戳(ms)字符串，空=非会员
  free_used      INTEGER NOT NULL DEFAULT 0, -- 已用免费额度
  email_verified INTEGER NOT NULL DEFAULT 0  -- 邮箱是否已验证：0=未验证(免费额度 FREE_CAP_UNVERIFIED) 1=已验证(免费额度 FREE_CAP)
);
-- 若 users 已存在（早于 email_verified 列），线上补列 + 把存量用户标记为已验证
-- （旧注册流程都收过邮箱验证码，视为已验证，避免加字段后他们免费额度骤降）：
--   wrangler d1 execute tarot --remote --command="ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;"
--   wrangler d1 execute tarot --remote --command="UPDATE users SET email_verified=1;"

-- 兑换码（充值/会员）：只存 code 的 SHA-256，明文不入库
CREATE TABLE IF NOT EXISTS redeem_codes (
  code_hash       TEXT PRIMARY KEY,
  credits         INTEGER NOT NULL DEFAULT 0,  -- 兑换得到的次数
  membership_days INTEGER NOT NULL DEFAULT 0,  -- 兑换得到的会员天数
  batch           TEXT,                        -- 批次标记（便于管理/对账）
  created_at      INTEGER NOT NULL,
  used_by         INTEGER,                     -- 兑换者 user_id（NULL=未用）
  used_at         INTEGER                      -- 兑换时间戳(ms)
);
CREATE INDEX IF NOT EXISTS idx_redeem_batch ON redeem_codes(batch);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,           -- 只存 token 的 SHA-256，cookie 里才是原 token
  user_id    INTEGER NOT NULL,
  expires    INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS readings (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  question   TEXT,
  spread     TEXT,
  cards      TEXT,                        -- JSON：[{id,reversed,position}]
  reading    TEXT,                        -- 解读正文
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_readings_user ON readings(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS daily (
  user_id  INTEGER NOT NULL,
  date     TEXT NOT NULL,                 -- YYYY-MM-DD
  card     INTEGER NOT NULL,
  reversed INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

-- 会员每日用量（k = user_id|YYYY-MM-DD），限制会员每日解读次数，防滥用/防亏损
CREATE TABLE IF NOT EXISTS member_daily (
  k     TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);

-- 注册邮箱验证码（每个邮箱同一时刻只留一条，发新码即覆盖旧码）
CREATE TABLE IF NOT EXISTS email_codes (
  email     TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,                -- SHA-256(code + email)，不存明文
  expires   INTEGER NOT NULL,            -- 过期时间戳(ms)
  sent_at   INTEGER NOT NULL,            -- 上次发送时间戳(ms)，用于 60s 频率限制
  attempts  INTEGER NOT NULL DEFAULT 0   -- 校验失败次数，超限作废
);

-- 游客/限流计数：浏览器游客哈希和 IP 哈希各自按日期计数；未带游客 ID 时回退 IP。
-- summ/chat = 已用免费解读/追问，regip/reggid 前缀用 acct 记录注册次数。
-- limit 前缀用 acct 记录登录、邮件等时间窗口内的请求次数；不存原始 IP。
CREATE TABLE IF NOT EXISTS guest_quota (
  k     TEXT PRIMARY KEY,
  summ  INTEGER NOT NULL DEFAULT 0,   -- 已用免费解读
  chat  INTEGER NOT NULL DEFAULT 0,   -- 已用免费追问
  acct  INTEGER NOT NULL DEFAULT 0    -- 当日该 IP 已创建的设备账号数（防白嫖建号）
);
-- 若 guest_quota 已存在（早于本列），线上补列：
--   wrangler d1 execute tarot --remote --command="ALTER TABLE guest_quota ADD COLUMN acct INTEGER NOT NULL DEFAULT 0;"

-- ═══════════════ 行为埋点（用户旅程 / 漏斗 / 停留时长分析）═══════════════
-- 每一条 = 用户在某个阶段触发的一次事件。匿名访客也记录（anon_id），登录后带 user_id。
-- "停留时长" 在分析端用 同一 session 内相邻事件的 ts 差值（窗口函数 LEAD）计算，
-- 每次会话结束时前端会补发一条 stage='exit'，用来收尾最后一个阶段的时长。
CREATE TABLE IF NOT EXISTS events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ts         INTEGER NOT NULL,   -- 事件发生时间（客户端 Date.now() 毫秒）——排序与时长计算基准
  recv_ts    INTEGER NOT NULL,   -- 服务端接收时间（毫秒）——排错/防篡改参考
  session_id TEXT    NOT NULL,   -- 一次访问（页面会话）唯一，前端 sessionStorage 生成
  anon_id    TEXT    NOT NULL,   -- 浏览器持久匿名 ID，前端 localStorage 生成（跨会话识别回访）
  user_id    INTEGER,            -- 登录用户 id（可空）；由服务端按 cookie 解析，客户端不可伪造
  stage      TEXT    NOT NULL,   -- 阶段/事件名：landing/enter_app/spread_select/.../reading_done/exit
  meta       TEXT,               -- JSON 附加信息（如 {spread,engine,deck,code}）
  ref        TEXT,               -- 来源 referrer 的 host（无则空）
  device     TEXT,               -- 'mobile' | 'desktop'
  lang       TEXT                -- 'zh' | 'en'
);
-- 海外 Premium 候补名单（支付上线前收集购买意向 + 邮箱，验证海外需求）
CREATE TABLE IF NOT EXISTS waitlist (
  email      TEXT PRIMARY KEY,
  plan       TEXT,
  user_id    INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id, ts);
CREATE INDEX IF NOT EXISTS idx_events_stage   ON events(stage, ts);
CREATE INDEX IF NOT EXISTS idx_events_ts      ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_anon    ON events(anon_id, ts);
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
