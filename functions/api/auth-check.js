import { requestLimit } from '../../lib/security.js';
import { json } from '../../lib/auth.js';

// 邮箱优先登录/注册的第一步：POST { email } → { exists }
// 前端据此决定第二步是「输密码登录」(老用户) 还是「设密码注册」(新用户)。
// 只回一个布尔，不泄露其他信息；后端的 login/register 仍各自二次校验，前端判断错了也不影响正确性。
export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); if (!b || typeof b !== 'object' || Array.isArray(b)) throw new Error(); } catch { return json({ error: '请求格式错误' }, 400); }
  const email = String(b.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) {
    return json({ error: '邮箱格式不正确' }, 400);
  }
  if (!await requestLimit(request, env, 'auth', 60, 600000)) return json({ error: '请求过于频繁，请稍后再试' }, 429);
  const row = await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first();
  return json({ exists: !!row });
}
