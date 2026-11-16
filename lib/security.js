import { sha256hex } from './auth.js';
import { clientIP } from './guest.js';

// 限流记录复用 guest_quota 的 acct；key 前缀与业务额度隔离。
export async function rateLimit(db, key, cap) {
  return !!(await db.prepare(`INSERT INTO guest_quota(k,summ,chat,acct) SELECT ?,0,0,1 WHERE ?>0
    ON CONFLICT(k) DO UPDATE SET acct=acct+1 WHERE acct<? RETURNING acct`).bind(key, cap, cap).first());
}
export async function requestLimit(request, env, scope, cap = 10, windowMs = 3600000) {
  const ipHash = await sha256hex(clientIP(request));
  return rateLimit(env.DB, `limit:${scope}:${ipHash}:${Math.floor(Date.now()/windowMs)}`, cap);
}
export async function codeHash(code, email, purpose) {
  return sha256hex(`${purpose}:${code}:${email}`);
}
export async function issueEmailCode(db, email, purpose) {
  const now = Date.now();
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 900000 + 100000);
  const hash = await codeHash(code, email, purpose);
  const result = await db.prepare(`INSERT INTO email_codes(email,code_hash,expires,sent_at,attempts) VALUES(?,?,?,?,0)
    ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash,expires=excluded.expires,sent_at=excluded.sent_at,attempts=0
    WHERE email_codes.sent_at<=? RETURNING email`).bind(email, hash, now+600000, now, now-60000).first();
  return result ? { code, hash } : null;
}
export async function consumeEmailCode(db, email, code, purpose) {
  const hash = await codeHash(code, email, purpose);
  const row = await db.prepare(`DELETE FROM email_codes WHERE email=? AND code_hash=? AND expires>=? AND attempts<5
    RETURNING email`).bind(email, hash, Date.now()).first();
  if (row) return true;
  await db.prepare('UPDATE email_codes SET attempts=attempts+1 WHERE email=? AND attempts<5').bind(email).run();
  return false;
}
