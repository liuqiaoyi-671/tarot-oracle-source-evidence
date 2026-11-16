import { issueEmailCode, requestLimit } from '../../lib/security.js';
import { getUser, json } from '../../lib/auth.js';
import { sendVerifyMail } from '../../lib/mail.js';

// 登录后验证邮箱（解锁更多免费额度）第一步：POST（无需 body）→ 往当前登录用户的邮箱发 6 位验证码。
// 验证码复用 email_codes 表（按 email 存），与找回密码/旧注册码同一套存储。
export async function onRequestPost({ request, env }) {
  const u = await getUser(request, env);
  if (!u) return json({ error: '请先登录', code: 'NEED_LOGIN' }, 401);

  const email = String(u.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: '账号邮箱无效' }, 400);

  // 已验证就不用再发
  const urow = await env.DB.prepare('SELECT email_verified FROM users WHERE id=?').bind(u.id).first();
  if (urow && urow.email_verified) return json({ ok: true, already: true });

  if (!await requestLimit(request, env, 'email', 10)) return json({ error: '邮件请求过于频繁，请稍后再试' }, 429);
  const issued = await issueEmailCode(env.DB, email, 'verify');
  if (!issued) return json({ error: '请等待 60 秒后再获取验证码' }, 429);
  const { code } = issued;

  try {
    await sendVerifyMail(env, email, code, /^en\b/i.test(request.headers.get('Accept-Language') || '') ? 'en' : 'zh');
  } catch (e) {
    await env.DB.prepare('DELETE FROM email_codes WHERE email=? AND code_hash=?').bind(email, issued.hash).run();
    return json({ error: '验证码发送失败，请稍后再试' }, 500);
  }
  return json({ ok: true });
}
