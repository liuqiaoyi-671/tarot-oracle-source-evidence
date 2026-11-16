-- 反馈者还未注册或尚未验证邮箱时，按邮箱预留一次性奖励。
CREATE TABLE IF NOT EXISTS pending_feedback_rewards (
  email TEXT PRIMARY KEY,
  reward_key TEXT NOT NULL UNIQUE,
  credits INTEGER NOT NULL CHECK(credits > 0),
  created_at INTEGER NOT NULL,
  mail_status TEXT NOT NULL DEFAULT 'pending',
  mailed_at INTEGER
);

-- 完成邮箱验证时才绑定账号；feedback_reward_grant 会在插入奖励账本后加次数。
CREATE TRIGGER IF NOT EXISTS pending_feedback_reward_claim
AFTER UPDATE OF email_verified ON users
WHEN NEW.email_verified = 1 AND OLD.email_verified <> 1
BEGIN
  INSERT OR IGNORE INTO feedback_rewards(reward_key,user_id,email,credits,created_at)
  SELECT reward_key,NEW.id,email,credits,created_at
  FROM pending_feedback_rewards WHERE email=NEW.email;
END;
