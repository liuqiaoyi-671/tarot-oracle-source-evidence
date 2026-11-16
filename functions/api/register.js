import { clientIP } from '../../lib/guest.js';
import { hashPassword, createSession, sessionCookie, json, sha256hex } from '../../lib/auth.js';

// 免验证码注册：邮箱 + 密码即可，秒进（邮箱验证码是最大注册卡点，见 guest-free-reading-model）。
// 邮箱在这里只作登录身份用；免费额度默认给未验证档(FREE_CAP_UNVERIFIED)，验证邮箱后抬到 FREE_CAP。
// 密码两遍一致由前端保证（confirm 字段），后端只校验长度。
//
// 防白嫖：免验证码后，理论上可反复乱输邮箱建号薅免费。两道软性防线（拦不死死磕党，但堵住顺手白嫖）：
//   1) 未验证邮箱只给很少免费额度（真正的免费在验证邮箱后才解锁，见 verify-email.js）
//   2) 同一浏览器(guest_id) / 同一 IP 每天限建号数（REG_GID_CAP / REG_IP_CAP），用 guest_quota.acct 计数
export async function onRequestPost({ request, env }) {
  let body; try { body = await request.json(); if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error(); } catch { return json({ error: '请求格式错误' }, 400); }
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const gid = (body && body.guest_id) ? String(body.guest_id).slice(0, 64) : '';
  if (email.length > 200 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: '邮箱格式不正确' }, 400);
  if (password.length < 8) return json({ error: '密码至少 8 位' }, 400);
  if (password.length > 200) return json({ error: '密码过长' }, 400);

  const exists = await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first();
  if (exists) return json({ error: '该邮箱已注册，请直接登录', code: 'EXISTS' }, 409);

  // ── 建号限流（防白嫖）──
  const ip = clientIP(request);
  const day = new Date().toISOString().slice(0, 10);
  const ipCap = parseInt(env.REG_IP_CAP || '5', 10);
  const gidCap = parseInt(env.REG_GID_CAP || '3', 10);
  const ipKey = 'regip:' + (await sha256hex(ip)) + '|' + day;                 // 只存 IP 哈希
  const gidKey = gid ? ('reggid:' + (await sha256hex(gid)) + '|' + day) : '';
  const ipRow = await env.DB.prepare('SELECT acct FROM guest_quota WHERE k=?').bind(ipKey).first();
  if (((ipRow && ipRow.acct) || 0) >= ipCap) return json({ error: '今日注册过于频繁，请明天再试或直接登录', code: 'REG_LIMIT' }, 429);
  if (gidKey) {
    const gidRow = await env.DB.prepare('SELECT acct FROM guest_quota WHERE k=?').bind(gidKey).first();
    if (((gidRow && gidRow.acct) || 0) >= gidCap) return json({ error: '该设备今日注册次数已达上限，请直接登录', code: 'REG_LIMIT' }, 429);
  }

  const pass = await hashPassword(password);
  const now = Date.now();
  let results;
  try {
    const statements = [env.DB.prepare(`INSERT INTO users(email,pass,created_at,email_verified)
      SELECT ?,?,?,0 WHERE COALESCE((SELECT acct FROM guest_quota WHERE k=?),0)<?
      AND (?='' OR COALESCE((SELECT acct FROM guest_quota WHERE k=?),0)<?)`)
      .bind(email, pass, now, ipKey, ipCap, gidKey, gidKey, gidCap),
      env.DB.prepare(`INSERT INTO guest_quota(k,summ,chat,acct) SELECT ?,0,0,1 WHERE changes()>0
        ON CONFLICT(k) DO UPDATE SET acct=acct+1`).bind(ipKey)];
    if (gidKey) statements.push(env.DB.prepare(`INSERT INTO guest_quota(k,summ,chat,acct)
      SELECT ?,0,0,1 WHERE changes()>0 ON CONFLICT(k) DO UPDATE SET acct=acct+1`).bind(gidKey));
    results = await env.DB.batch(statements);
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) return json({ error: '该邮箱已注册，请直接登录', code: 'EXISTS' }, 409);
    throw error;
  }
  if (!results[0].meta.changes) return json({ error: '今日注册过于频繁，请明天再试或直接登录', code: 'REG_LIMIT' }, 429);
  const token = await createSession(env, results[0].meta.last_row_id);
  return json({ email, email_verified: false }, 200, { 'Set-Cookie': sessionCookie(token) });
}
