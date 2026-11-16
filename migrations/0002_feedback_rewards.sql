CREATE TABLE IF NOT EXISTS feedback_rewards (
  reward_key TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  credits INTEGER NOT NULL CHECK(credits > 0),
  created_at INTEGER NOT NULL,
  mail_status TEXT NOT NULL DEFAULT 'pending',
  mailed_at INTEGER
);
CREATE TRIGGER IF NOT EXISTS feedback_reward_grant
AFTER INSERT ON feedback_rewards
BEGIN
  UPDATE users SET credits = credits + NEW.credits WHERE id = NEW.user_id;
END;
