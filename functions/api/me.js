import { getUser, json, freeCapFor } from '../../lib/auth.js';

export async function onRequestGet({ request, env }) {
  const u = await getUser(request, env);
  if (!u) return json({ error: 'not logged in' }, 401);
  const row = await env.DB.prepare('SELECT credits, membership, free_used, email_verified FROM users WHERE id=?').bind(u.id).first();
  const now = Date.now();
  const memberUntil = parseInt((row && row.membership) || '0', 10) || 0;
  const emailVerified = !!(row && row.email_verified);
  const freeCap = freeCapFor(env, emailVerified);          // 未验证邮箱额度更低，验证后抬高
  const freeUsed = (row && row.free_used) || 0;
  // 是否已用过"新人首单"优惠（批次名以 first 开头）→ 前端据此隐藏首单 SKU，避免重复购买
  const fo = await env.DB.prepare(
    "SELECT EXISTS(SELECT 1 FROM redeem_codes WHERE used_by=? AND batch LIKE 'first%') AS c"
  ).bind(u.id).first();
  return json({
    id: u.id,
    first_order_used: !!(fo && fo.c > 0),
    email: u.email,
    is_device: String(u.email || '').endsWith('@device.local'),  // 设备账号（无邮箱/密码，一键创建）
    email_verified: emailVerified,
    credits: (row && row.credits) || 0,
    member_until: memberUntil,           // 会员到期时间戳(ms)，0=非会员
    is_member: memberUntil > now,
    free_used: freeUsed,
    free_cap: freeCap,
    free_left: Math.max(0, freeCap - freeUsed),
    free_cap_verified: parseInt(env.FREE_CAP || '3', 10),  // 验证后可达的免费上限（前端提示"再得N次"）
  });
}
