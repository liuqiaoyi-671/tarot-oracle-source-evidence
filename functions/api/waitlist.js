import { requestLimit } from '../../lib/security.js';
import { getUser, json } from '../../lib/auth.js';

// 海外 Premium 候补名单：POST { email, plan }
// 支付（Lemon Squeezy/Paddle）上线前，用它收集购买意向 + 邮箱，验证海外需求。
// 邮箱唯一（重复提交=更新），带登录态时记 user_id。
export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); if (!b || typeof b !== 'object' || Array.isArray(b)) throw new Error(); } catch { return json({ error: 'bad request' }, 400); }
  const email = String(b.email || '').trim().toLowerCase().slice(0, 200);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'invalid email' }, 400);
  const plan = String(b.plan || '').slice(0, 40);

  if (!await requestLimit(request, env, 'waitlist', 10, 3600000)) return json({ error: '请求过于频繁，请稍后再试' }, 429);
  let userId = null;
  try { const u = await getUser(request, env); if (u) userId = u.id; } catch {}

  try {
    await env.DB.prepare(
      'INSERT INTO waitlist (email, plan, user_id, created_at) VALUES (?,?,?,?) ' +
      'ON CONFLICT(email) DO UPDATE SET plan=excluded.plan, user_id=COALESCE(excluded.user_id, waitlist.user_id)'
    ).bind(email, plan, userId, Date.now()).run();
  } catch (e) {
    return json({ error: 'save failed' }, 500);
  }
  return json({ ok: true });
}
