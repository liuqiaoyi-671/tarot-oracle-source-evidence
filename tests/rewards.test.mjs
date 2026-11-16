import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
test('反馈奖励重复入库只加一次；加次数失败时奖励记录整体回滚', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE users(id INTEGER PRIMARY KEY,credits INTEGER); INSERT INTO users VALUES(1,7);');
  db.exec(readFileSync(new URL('../migrations/0002_feedback_rewards.sql',import.meta.url),'utf8'));
  const grant=db.prepare('INSERT OR IGNORE INTO feedback_rewards(reward_key,user_id,email,credits,created_at) VALUES(?,?,?,?,?)');
  grant.run('batch:user',1,'a@example.com',5,1);grant.run('batch:user',1,'a@example.com',5,1);
  assert.equal(db.prepare('SELECT credits FROM users').get().credits,12);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM feedback_rewards').get().n,1);
  db.exec("CREATE TRIGGER fail_credit BEFORE UPDATE ON users BEGIN SELECT RAISE(ABORT,'fail'); END;");
  assert.throws(()=>grant.run('other',1,'a@example.com',5,1));
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM feedback_rewards').get().n,1);
  assert.equal(db.prepare('SELECT credits FROM users').get().credits,12);
  db.close();
});

test('未注册邮箱奖励在验证后只到账一次', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT UNIQUE,credits INTEGER NOT NULL DEFAULT 0,email_verified INTEGER NOT NULL DEFAULT 0);');
  db.exec(readFileSync(new URL('../migrations/0002_feedback_rewards.sql',import.meta.url),'utf8'));
  db.exec(readFileSync(new URL('../migrations/0004_pending_feedback_rewards.sql',import.meta.url),'utf8'));
  db.prepare('INSERT INTO pending_feedback_rewards(email,reward_key,credits,created_at) VALUES(?,?,?,?)')
    .run('new@example.com','feedback-20261015:new@example.com',5,1);
  db.exec("INSERT INTO users(id,email) VALUES(1,'new@example.com');");
  assert.equal(db.prepare('SELECT credits FROM users').get().credits,0);
  db.exec('UPDATE users SET email_verified=1 WHERE id=1;');
  db.exec('UPDATE users SET email_verified=1 WHERE id=1;');
  assert.equal(db.prepare('SELECT credits FROM users').get().credits,5);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM feedback_rewards').get().n,1);
  db.close();
});
