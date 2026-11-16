import { consumeEmailCode } from '../../lib/security.js';
import { hashPassword, createSession, sessionCookie, json } from '../../lib/auth.js';

// 重置密码：POST { email, code, password }
export async function onRequestPost({ request, env }) {
  let body; try { body = await request.json(); if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error(); } catch { return json({ error: '请求格式错误' }, 400); }
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const code = String(body.code || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: '邮箱格式不正确' }, 400);
  if (password.length < 8) return json({ error: '密码至少 8 位' }, 400);
  if (password.length > 200) return json({ error: '密码过长' }, 400);
  if (!/^\d{6}$/.test(code)) return json({ error: '请输入 6 位验证码' }, 400);

  const user = await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first();
  if (!user) return json({ error: '该邮箱未注册' }, 404);

  if (!await consumeEmailCode(env.DB, email, code, 'reset')) {
    return json({ error: '验证码无效、已使用或已过期，请重新获取' }, 400);
  }

  const pass = await hashPassword(password);
  // 收到并通过邮箱验证码 = 证明拥有该邮箱，顺带标记为已验证（解锁完整免费额度）
  await env.DB.prepare('UPDATE users SET pass=?, email_verified=1 WHERE id=?').bind(pass, user.id).run();
  await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id).run();     // 旧会话全部失效
  const token = await createSession(env, user.id);                                       // 重置后直接登录
  return json({ email }, 200, { 'Set-Cookie': sessionCookie(token) });
}
