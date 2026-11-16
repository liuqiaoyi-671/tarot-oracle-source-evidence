import { getUser, json } from '../../lib/auth.js';

// 取当天已存的每日牌：GET /api/daily?date=YYYY-MM-DD
export async function onRequestGet({ request, env }) {
  const u = await getUser(request, env);
  if (!u) return json({ error: 'not logged in' }, 401);
  const date = String(new URL(request.url).searchParams.get('date') || '').slice(0, 10);
  if (!date) return json({ error: '缺少 date' }, 400);
  const row = await env.DB.prepare('SELECT card, reversed FROM daily WHERE user_id=? AND date=?').bind(u.id, date).first();
  return json({ daily: row || null });
}

// 存当天的每日牌（同一天只存一次，已存则忽略）：POST {date, card, reversed}
export async function onRequestPost({ request, env }) {
  const u = await getUser(request, env);
  if (!u) return json({ error: 'not logged in' }, 401);
  let b; try { b = await request.json(); if (!b || typeof b !== 'object' || Array.isArray(b)) throw new Error(); } catch { return json({ error: '请求格式错误' }, 400); }
  const date = String(b.date || '').slice(0, 10);
  const card = parseInt(b.card, 10);
  const reversed = b.reversed ? 1 : 0;
  if (!date || !(card >= 0 && card <= 77)) return json({ error: '参数错误' }, 400);
  await env.DB.prepare('INSERT OR IGNORE INTO daily (user_id, date, card, reversed) VALUES (?,?,?,?)')
    .bind(u.id, date, card, reversed).run();
  return json({ ok: true });
}
