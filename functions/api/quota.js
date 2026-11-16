import { getUser, json, freeCapFor } from '../../lib/auth.js';
import { guestKeys, guestLimits } from '../../lib/guest.js';

// 轻量额度查询：GET /api/quota
// 前端在抽牌前用它判断"官方通道还有没有额度"，没额度就不让抽牌（避免抽完才神谕沉默）。
// 登录用户 → 返回 free_left/credits/会员；游客 → 按 IP 返回今日剩余免费解读/追问。
export async function onRequestGet({ request, env }) {
  const u = await getUser(request, env);

  if (u) {
    const row = await env.DB.prepare('SELECT credits, membership, free_used, email_verified FROM users WHERE id=?').bind(u.id).first();
    const freeCap = freeCapFor(env, !!(row && row.email_verified));
    const memberUntil = parseInt((row && row.membership) || '0', 10) || 0;
    return json({
      logged_in: true,
      is_device: String(u.email || '').endsWith('@device.local'),
      email_verified: !!(row && row.email_verified),
      is_member: memberUntil > Date.now(),
      free_left: Math.max(0, freeCap - ((row && row.free_used) || 0)),
      credits: (row && row.credits) || 0,
    });
  }

  // 游客：优先按 浏览器游客ID(?g=) 记额度，跟 IP 无关；没带则回退 IP
  const gid = String(new URL(request.url).searchParams.get('g') || '').slice(0, 64);
  const keys = await guestKeys(request, gid);
  const row = await env.DB.prepare('SELECT summ, chat FROM guest_quota WHERE k=?').bind(keys.key).first();
  const ipRow = await env.DB.prepare('SELECT summ, chat FROM guest_quota WHERE k=?').bind(keys.ipKey).first();
  const limits = guestLimits(env);
  return json({
    logged_in: false,
    guest_summ_left: Math.max(0, Math.min(limits.free - (row?.summ || 0), limits.ipFree - (ipRow?.summ || 0))),
    guest_chat_left: Math.max(0, Math.min(limits.chat - (row?.chat || 0), limits.ipChat - (ipRow?.chat || 0))),
  });
}
