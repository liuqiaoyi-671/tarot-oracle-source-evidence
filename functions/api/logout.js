import { destroySession, clearCookie, json } from '../../lib/auth.js';

export async function onRequestPost({ request, env }) {
  await destroySession(request, env);
  return json({ ok: true }, 200, { 'Set-Cookie': clearCookie() });
}
