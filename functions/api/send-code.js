import { issueEmailCode, requestLimit } from '../../lib/security.js';
import { json } from '../../lib/auth.js';
import { sendCodeMail } from '../../lib/mail.js';

// 发送注册验证码：POST { email }
export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); if (!b || typeof b !== 'object' || Array.isArray(b)) throw new Error(); } catch { return json({ error: '请求格式错误' }, 400); }
  const email = String(b.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) return json({ error: '邮箱格式不正确' }, 400);

  // 已注册的邮箱不再发注册码
  const exists = await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first();
  if (exists) return json({ error: '该邮箱已注册，请直接登录' }, 409);

  if (!await requestLimit(request, env, 'email', 10)) return json({ error: '邮件请求过于频繁，请稍后再试' }, 429);
  const issued = await issueEmailCode(env.DB, email, 'register');
  if (!issued) return json({ error: '请等待 60 秒后再获取验证码' }, 429);
  const { code } = issued;

  try {
    await sendCodeMail(env, email, code, /^en\b/i.test(request.headers.get('Accept-Language') || '') ? 'en' : 'zh');
  } catch (e) {
    await env.DB.prepare('DELETE FROM email_codes WHERE email=? AND code_hash=?').bind(email, issued.hash).run();
    return json({ error: '验证码发送失败，请稍后再试' }, 500);
  }
  return json({ ok: true });
}
