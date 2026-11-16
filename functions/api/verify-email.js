import { consumeEmailCode } from '../../lib/security.js';
import { getUser, json } from '../../lib/auth.js';
import { sendGrantedRewardNotice } from '../../lib/feedback-reward-mail.js';

// 登录后验证邮箱第二步：POST { code } → 校验验证码，通过则标记 email_verified=1（免费额度抬到 FREE_CAP）。
export async function onRequestPost({ request, env }) {
  const u = await getUser(request, env);
  if (!u) return json({ error: '请先登录', code: 'NEED_LOGIN' }, 401);

  let b; try { b = await request.json(); if (!b || typeof b !== 'object' || Array.isArray(b)) throw new Error(); } catch { return json({ error: '请求格式错误' }, 400); }
  const code = String(b.code || '').trim();
  if (!/^\d{6}$/.test(code)) return json({ error: '请输入 6 位验证码' }, 400);

  const email = String(u.email || '').trim().toLowerCase();
  if (!await consumeEmailCode(env.DB, email, code, 'verify')) {
    return json({ error: '验证码无效、已使用或已过期，请重新获取' }, 400);
  }

  await env.DB.prepare('UPDATE users SET email_verified=1 WHERE id=?').bind(u.id).run();
  const reward = await env.DB.prepare('SELECT reward_key FROM pending_feedback_rewards WHERE email=?').bind(email).first();
  if (reward) await sendGrantedRewardNotice(env, email, reward.reward_key);
  return json({ ok: true, email_verified: true });
}
