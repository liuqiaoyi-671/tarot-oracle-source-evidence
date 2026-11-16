import { getUser, json, sha256hex } from '../../lib/auth.js';

// 兑换码充值：POST { code } → 加次数 / 会员天数
export async function onRequestPost({ request, env }) {
  const u = await getUser(request, env);
  if (!u) return json({ error: '请先登录' }, 401);
  let b; try { b = await request.json(); if (!b || typeof b !== 'object' || Array.isArray(b)) throw new Error(); } catch { return json({ error: '请求格式错误' }, 400); }
  // 归一化：去掉空格/连字符、转大写（展示时可分组带 - ，兑换时无所谓）
  const code = String(b.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[A-Z0-9]{8,32}$/.test(code)) return json({ error: '兑换码格式不正确' }, 400);

  const hash = await sha256hex(code);
  const row = await env.DB.prepare(
    'SELECT credits, membership_days, used_by, batch FROM redeem_codes WHERE code_hash=?'
  ).bind(hash).first();
  if (!row) return json({ error: '兑换码无效' }, 404);
  if (row.used_by) return json({ error: '该兑换码已被使用' }, 409);

  // 新人首单优惠（批次名以 first 开头）：每个账号仅限兑换一次。必须在"标记已用"之前检查。
  const isFirstOrder = /^first/i.test(row.batch || '');
  if (isFirstOrder) {
    const prior = await env.DB.prepare(
      "SELECT EXISTS(SELECT 1 FROM redeem_codes WHERE used_by=? AND batch LIKE 'first%') AS c"
    ).bind(u.id).first();
    if (prior && prior.c > 0) {
      return json({ error: '新人首单优惠每个账号仅限兑换 1 次', code: 'FIRST_ORDER_USED' }, 409);
    }
  }

  const addCredits = row.credits || 0;
  const days = row.membership_days || 0;
  const now = Date.now();
  // D1 batch 是事务：先在 SQL 内再次检查可兑换性，再发放并标记。
  // 第二句只在第一句确实更新了用户时执行；任何 SQL 失败会整体回滚。
  const result = await env.DB.batch([
    env.DB.prepare(`UPDATE users SET
      credits = credits + ?,
      membership = CASE WHEN ? > 0 THEN CAST(MAX(CAST(membership AS INTEGER), ?) + ? AS TEXT) ELSE membership END
      WHERE id=? AND EXISTS (
        SELECT 1 FROM redeem_codes WHERE code_hash=? AND used_by IS NULL
      ) AND (? = 0 OR NOT EXISTS (
        SELECT 1 FROM redeem_codes WHERE used_by=? AND batch LIKE 'first%'
      ))`).bind(addCredits, days, now, days * 86400000, u.id, hash, isFirstOrder ? 1 : 0, u.id),
    env.DB.prepare(`UPDATE redeem_codes SET used_by=?, used_at=?
      WHERE code_hash=? AND used_by IS NULL AND changes() > 0`).bind(u.id, now, hash)
  ]);
  if (!result[0].meta.changes) {
    const used = await env.DB.prepare('SELECT used_by FROM redeem_codes WHERE code_hash=?').bind(hash).first();
    if (used && used.used_by) return json({ error: '该兑换码已被使用' }, 409);
    return json({ error: '新人首单优惠每个账号仅限兑换 1 次', code: 'FIRST_ORDER_USED' }, 409);
  }

  return json({ ok: true, credits_added: addCredits, membership_days: days });
}
