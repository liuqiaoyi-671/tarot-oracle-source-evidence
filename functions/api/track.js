import { getUser } from '../../lib/auth.js';

// 行为埋点接收端：POST /api/track
// 请求体：{ anon_id, session_id, ref, device, lang, events:[{ts, stage, meta}, ...] }
// 设计要点：
//   · 匿名可用，不需要登录；若带 cookie 则服务端解析出 user_id（客户端无法伪造）
//   · 支持批量（一次请求多条事件），并兼容 navigator.sendBeacon（离开页面时补发 exit）
//   · 尽量轻：失败静默返回，绝不影响主站；对字段长度/条数做上限，防滥用
//   · 只写入分析所需字段，不落任何 PII（邮箱/问题正文等一律不收）

const MAX_EVENTS = 40;          // 单请求最多事件数
const clip = (v, n) => (v == null ? null : String(v).slice(0, n));

export async function onRequestPost({ request, env }) {
  // 无论成功与否都回 204：埋点失败不该让前端看到错误
  const done = () => new Response(null, { status: 204 });

  let body;
  try { body = await request.json(); if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error(); } catch { return done(); }
  if (!body || typeof body !== 'object') return done();

  const events = Array.isArray(body.events) ? body.events.slice(0, MAX_EVENTS) : [];
  if (!events.length) return done();

  const session_id = clip(body.session_id, 64);
  const anon_id = clip(body.anon_id, 64);
  if (!session_id || !anon_id) return done();

  const ref = clip(body.ref, 120);
  const device = clip(body.device, 16);
  const lang = clip(body.lang, 8);
  const recv = Date.now();

  // 登录态解析（best-effort，一次请求只查一次）
  let userId = null;
  try { const u = await getUser(request, env); if (u) userId = u.id; } catch {}

  try {
    const stmt = env.DB.prepare(
      'INSERT INTO events (ts, recv_ts, session_id, anon_id, user_id, stage, meta, ref, device, lang) ' +
      'VALUES (?,?,?,?,?,?,?,?,?,?)'
    );
    const rows = [];
    for (const e of events) {
      const stage = clip(e && e.stage, 40);
      if (!stage) continue;
      // ts 容错：客户端时间异常时回退到接收时间
      let ts = parseInt(e.ts, 10);
      if (!Number.isFinite(ts) || ts < 1e12 || ts > recv + 6e5) ts = recv;
      let meta = null;
      if (e.meta != null) {
        try { meta = clip(typeof e.meta === 'string' ? e.meta : JSON.stringify(e.meta), 500); } catch {}
      }
      rows.push(stmt.bind(ts, recv, session_id, anon_id, userId, stage, meta, ref, device, lang));
    }
    if (rows.length) await env.DB.batch(rows);
  } catch {}

  return done();
}
