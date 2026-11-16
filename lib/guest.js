import { sha256hex } from './auth.js';
export function positiveInt(value, fallback) {
  const number = Number(value ?? fallback);
  return Number.isSafeInteger(number) && number >= 0 ? number : fallback;
}
export function clientIP(request) {
  // Cloudflare 写入的可信头；不信任客户端可伪造的 x-forwarded-for。
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}
export async function guestKeys(request, gid) {
  const day = new Date().toISOString().slice(0, 10);
  const ip = clientIP(request);
  return {
    key: (await sha256hex(gid ? 'gid:' + String(gid).slice(0,64) : 'guest:' + ip)) + '|' + day,
    ipKey: 'guestip:' + (await sha256hex(ip)) + '|' + day
  };
}
export function guestLimits(env) {
  return { free: positiveInt(env.GUEST_FREE_CAP, 1), chat: positiveInt(env.GUEST_CHAT_CAP, 1),
    ipFree: positiveInt(env.GUEST_IP_CAP, 3), ipChat: positiveInt(env.GUEST_IP_CHAT_CAP, 6) };
}
