import { requestLimit } from '../../lib/security.js';
import { verifyPassword, createSession, sessionCookie, json } from '../../lib/auth.js';

export async function onRequestPost({ request, env }) {
  let body; try { body = await request.json(); if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error(); } catch { return json({ error: '请求格式错误' }, 400); }
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (email.length > 200 || password.length > 200 || !email || !password) return json({ error: '邮箱或密码不正确' }, 400);
  if (!await requestLimit(request, env, 'login', 20, 600000)) return json({ error: '登录尝试过于频繁，请 10 分钟后再试' }, 429);

  const user = await env.DB.prepare('SELECT id, pass FROM users WHERE email=?').bind(email).first();
  const ok = user && await verifyPassword(password, user.pass);
  if (!ok) return json({ error: '邮箱或密码不正确' }, 401); // 不透露邮箱是否存在

  const token = await createSession(env, user.id);
  return json({ email }, 200, { 'Set-Cookie': sessionCookie(token) });
}
