// lib/auth.js — 账号系统共享工具（仅用 Web Crypto，可跑在 Cloudflare Pages Functions / Workers）
const PBKDF2_ITERATIONS = 100000;
const SESSION_DAYS = 30;
const enc = new TextEncoder();

function b64(buf) { return btoa(String.fromCharCode(...new Uint8Array(buf))); }
function ub64(str) { return Uint8Array.from(atob(str), c => c.charCodeAt(0)); }

async function deriveBits(password, salt, iterations = PBKDF2_ITERATIONS) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await deriveBits(password, salt);
  return `${PBKDF2_ITERATIONS}:${b64(salt)}:${b64(bits)}`;
}

export async function verifyPassword(password, stored) {
  try {
    const [iterStr, saltB64, hashB64] = String(stored).split(':');
    const bits = await deriveBits(password, ub64(saltB64), parseInt(iterStr, 10));
    const a = new Uint8Array(bits), b = ub64(hashB64);
    if (a.length !== b.length) return false;
    let diff = 0; for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]; // 常数时间比较
    return diff === 0;
  } catch { return false; }
}

function newToken() {
  return b64(crypto.getRandomValues(new Uint8Array(32))).replace(/[+/=]/g, '');
}
export async function sha256hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
  return [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('');
}

function parseCookies(request) {
  const h = request.headers.get('Cookie') || '';
  const out = {};
  h.split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = p.slice(i + 1).trim(); });
  return out;
}

export function sessionCookie(token) {
  return `sid=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}`;
}
export function clearCookie() {
  return `sid=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export async function createSession(env, userId) {
  const token = newToken();
  const th = await sha256hex(token);
  const expires = Date.now() + SESSION_DAYS * 86400 * 1000;
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires) VALUES (?,?,?)').bind(th, userId, expires).run();
  return token;
}

export async function destroySession(request, env) {
  const token = parseCookies(request).sid;
  if (token) {
    const th = await sha256hex(token);
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(th).run();
  }
}

// 返回当前登录用户 {id,email,credits}，未登录返回 null
export async function getUser(request, env) {
  const token = parseCookies(request).sid;
  if (!token) return null;
  const th = await sha256hex(token);
  const row = await env.DB.prepare(
    'SELECT s.user_id AS id, s.expires AS expires, u.email AS email, u.credits AS credits ' +
    'FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?'
  ).bind(th).first();
  if (!row) return null;
  if (row.expires < Date.now()) { await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(th).run(); return null; }
  return { id: row.id, email: row.email, credits: row.credits };
}

// 该用户的免费额度上限：已验证邮箱 → FREE_CAP；未验证 → FREE_CAP_UNVERIFIED（默认 1）。
// 验证邮箱只是把上限抬高，free_used 不变，所以验证后 free_left 自然增加。
export function freeCapFor(env, emailVerified) {
  const capV = parseInt(env.FREE_CAP || '3', 10);
  const capU = parseInt(env.FREE_CAP_UNVERIFIED || '1', 10);
  return emailVerified ? capV : capU;
}

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extraHeaders },
  });
}
