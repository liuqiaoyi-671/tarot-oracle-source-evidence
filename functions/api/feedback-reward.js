import { json } from '../../lib/auth.js';
import { sendGrantedRewardNotice, sendReservedRewardNotice } from '../../lib/feedback-reward-mail.js';

// 一次性审核批次：只发放已授权的邮箱，每个账号仅发放一次。
const recipients = new Set([
  '1315956506@qq.com', '17396187107@163.com', '3695621995@qq.com',
  '3543595441@qq.com', '1262113342@qq.com', 'yyn09010405@qq.com',
  'm15099561821@163.com', '15962328091@163.com'
]);
const newRecipients = new Set([
  '1775783814@qq.com', '2362440268@qq.com', '1072757556@qq.com'
]);
export async function onRequestPost({ request, env }) {
  const expected = env.FEEDBACK_REWARD_TOKEN;
  if (!expected || request.headers.get('x-reward-token') !== expected) return json({ error: '无权限' }, 403);
  let body;
  try { body = await request.json(); } catch { return json({ error: '请求格式错误' }, 400); }
  const email = String(body?.email || '').trim().toLowerCase();
  const isNew = newRecipients.has(email);
  if (!isNew && !recipients.has(email)) return json({ error: '不在审核批次中' }, 400);
  const user = await env.DB.prepare('SELECT id,email_verified FROM users WHERE email=?').bind(email).first();
  const key = (isNew ? 'feedback-20261015:' : 'feedback1-20261005:') + email;
  if (isNew && (!user || !user.email_verified)) {
    await env.DB.prepare('INSERT OR IGNORE INTO pending_feedback_rewards(email,reward_key,credits,created_at) VALUES(?,?,?,?)')
      .bind(email, key, 5, Date.now()).run();
    await sendReservedRewardNotice(env, email, key);
    const reward = await env.DB.prepare('SELECT credits,mail_status FROM pending_feedback_rewards WHERE reward_key=?').bind(key).first();
    return json({ ok: true, email, status: 'reserved', credits_reserved: reward.credits, mail_status: reward.mail_status });
  }
  if (!user) return json({ error: '该邮箱未注册', code: 'NO_USER' }, 404);
  // INSERT 和触发器的加次数在同一个事务中完成，重复请求不会再次加次数。
  await env.DB.prepare('INSERT OR IGNORE INTO feedback_rewards(reward_key,user_id,email,credits,created_at) VALUES(?,?,?,?,?)')
    .bind(key, user.id, email, 5, Date.now()).run();
  await sendGrantedRewardNotice(env, email, key);
  const reward = await env.DB.prepare('SELECT credits,mail_status FROM feedback_rewards WHERE reward_key=?').bind(key).first();
  return json({ ok: true, email, credits_added: reward.credits, mail_status: reward.mail_status });
}
