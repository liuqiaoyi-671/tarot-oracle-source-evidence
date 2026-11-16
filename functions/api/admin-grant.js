import { json } from '../../lib/auth.js';

// 后台：按邮箱给账号加次数（用于人工审核优质反馈后发放）。
// 受 ADMIN_TOKEN 保护：请求头 x-admin-token 必须等于该密钥（用 wrangler pages secret put ADMIN_TOKEN 设置）。
// POST { email, credits }  →  给该邮箱的用户加 credits 次数。
function safeEqual(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_TOKEN) return json({ error: '后台未配置（缺少 ADMIN_TOKEN）' }, 503);
  const token = request.headers.get('x-admin-token') || '';
  if (!safeEqual(token, env.ADMIN_TOKEN)) return json({ error: '无权限' }, 403);

  let b; try { b = await request.json(); if (!b || typeof b !== 'object' || Array.isArray(b)) throw new Error(); } catch { return json({ error: '请求格式错误' }, 400); }
  const email = String(b.email || '').trim().toLowerCase();
  const credits = parseInt(b.credits, 10);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: '邮箱格式不正确' }, 400);
  if (!Number.isInteger(credits) || credits === 0 || credits < -100 || credits > 100) {
    return json({ error: '次数需为 -100~100 的非零整数' }, 400);
  }

  const user = await env.DB.prepare('SELECT id, credits FROM users WHERE email=?').bind(email).first();
  if (!user) return json({ error: '该邮箱未注册（对方需先注册登录一次）', code: 'NO_USER' }, 404);

  // 扣减时不允许扣成负数
  const res = await env.DB.prepare(
    'UPDATE users SET credits = MAX(0, credits + ?) WHERE id=?'
  ).bind(credits, user.id).run();
  if (!res.meta.changes) return json({ error: '发放失败' }, 500);

  const after = await env.DB.prepare('SELECT credits FROM users WHERE id=?').bind(user.id).first();
  return json({ ok: true, email, credits_added: credits, credits_total: (after && after.credits) || 0 });
}
