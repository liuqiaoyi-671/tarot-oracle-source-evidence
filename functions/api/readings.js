import { getUser, json } from '../../lib/auth.js';

function readingFields(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return null;
  const cards = JSON.stringify(b.cards || []);
  const reading = String(b.reading || '');
  // 不截断 JSON：截断后的记录无法恢复，也不应该向用户报告保存成功。
  if (cards.length > 6000 || reading.length > 40000) return null;
  try {
    if (!Array.isArray(b.cards)) return null;
    const parsed = JSON.parse(reading);
    if (!parsed || typeof parsed !== 'object') return null;
  } catch { return null; }
  return { question: String(b.question || '').slice(0, 500),
    spread: String(b.spread || '').slice(0, 60), cards, reading };
}

// 列出当前用户最近的占卜记录
export async function onRequestGet({ request, env }) {
  const u = await getUser(request, env);
  if (!u) return json({ error: 'not logged in' }, 401);
  const { results } = await env.DB.prepare(
    'SELECT id, created_at, question, spread, cards, reading FROM readings WHERE user_id=? ORDER BY created_at DESC LIMIT 100'
  ).bind(u.id).all();
  return json({ readings: results || [] });
}

// 保存一条占卜记录
export async function onRequestPost({ request, env }) {
  const u = await getUser(request, env);
  if (!u) return json({ error: 'not logged in' }, 401);
  let b; try { b = await request.json(); if (!b || typeof b !== 'object' || Array.isArray(b)) throw new Error(); } catch { return json({ error: '请求格式错误' }, 400); }
  const fields = readingFields(b);
  if (!fields) return json({ error: '记录格式不正确或内容过长，请缩短后重试' }, 400);
  const { question, spread, cards, reading } = fields;
  const res = await env.DB.prepare(
    'INSERT INTO readings (user_id, created_at, question, spread, cards, reading) VALUES (?,?,?,?,?,?)'
  ).bind(u.id, Date.now(), question, spread, cards, reading).run();
  // 每人最多留 100 条，超出删最旧的
  await env.DB.prepare(
    'DELETE FROM readings WHERE user_id=? AND id NOT IN (SELECT id FROM readings WHERE user_id=? ORDER BY created_at DESC LIMIT 100)'
  ).bind(u.id, u.id).run();
  return json({ ok: true, id: res.meta.last_row_id });
}

// 更新已有记录，用户只能更新自己的记录；不改变首次保存时间。
export async function onRequestPatch({ request, env }) {
  const u = await getUser(request, env);
  if (!u) return json({ error: 'not logged in' }, 401);
  let b; try { b = await request.json(); if (!b || typeof b !== 'object' || Array.isArray(b)) throw new Error(); } catch { return json({ error: '请求格式错误' }, 400); }
  const id = Number(b && b.id);
  const fields = readingFields(b);
  if (!Number.isSafeInteger(id) || id <= 0 || !fields) return json({ error: '记录格式不正确或内容过长' }, 400);
  const result = await env.DB.prepare(
    'UPDATE readings SET question=?, spread=?, cards=?, reading=? WHERE id=? AND user_id=?'
  ).bind(fields.question, fields.spread, fields.cards, fields.reading, id, u.id).run();
  if (!result.meta.changes) return json({ error: '记录不存在或已删除' }, 404);
  return json({ ok: true, id });
}

// 删除一条：DELETE /api/readings?id=123
export async function onRequestDelete({ request, env }) {
  const u = await getUser(request, env);
  if (!u) return json({ error: 'not logged in' }, 401);
  const rawId = new URL(request.url).searchParams.get('id');
  const id = Number(rawId);
  if (rawId !== null && (!Number.isSafeInteger(id) || id <= 0)) return json({ error: '记录编号无效' }, 400);
  if (rawId !== null) {
    await env.DB.prepare('DELETE FROM readings WHERE id=? AND user_id=?').bind(id, u.id).run();
  } else {
    await env.DB.prepare('DELETE FROM readings WHERE user_id=?').bind(u.id).run(); // 无 id = 清空全部
  }
  return json({ ok: true });
}
