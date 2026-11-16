import { getUser, json, sha256hex, freeCapFor } from '../../lib/auth.js';
import { guestKeys, guestLimits, positiveInt } from '../../lib/guest.js';
import { reserveReading, refundReading, finishReading, cleanReadingRequests } from '../../lib/reading-billing.js';
import { requestLimit } from '../../lib/security.js';

export const ENGLISH_READING_STYLE = `Write the entire response in natural, contemporary English, including headings and card names. Any Chinese source notes are reference material to interpret, not text to quote.
Use fluent, conversational English rather than literal translations, ritual slogans or canned reassurance. Respect the chosen reading voice without theatrical excess. Do not assume nationality, gender, religion, family roles or relationship expectations.
Lead with an answer to the question, then explain the relevant cards, their positions, orientation and connections. Ground claims in the supplied cards and facts. Separate symbolic possibilities from facts and unknowns; do not guess private motives, promise outcomes or agree with a preferred answer.
Be decisive about a proposed action, not about unverified personal facts. For example, the Magician can invite taking stock of resources; it does not prove the reader already has every tool, is competent or is ready. An upright card does not prove the absence of external obstacles. Do not diagnose motives or frame hesitation as a refusal without supplied evidence. Offer conditional applications when context is missing.
Describe only imagery explicitly supported by the supplied references. Do not invent counts, locations or small visual details, or turn decorative quantities into an objective rule.
Go beyond generic keywords: explain why a symbol matters in this particular context and how neighboring cards strengthen or challenge it. Keep paragraphs focused. Use short headings or a few practical options only when useful, not a fixed template for every card. Never repeat the question under every card.
For a follow-up, answer the new question directly using the existing spread and prior answer. Do not retell the whole reading or invent newly drawn cards. Make suggestions concrete and leave the final choice to the reader. Match detail to the question; depth does not require padding.`;

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
function streamResponse(body, headers) {
  return new Response(body, { headers: { 'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-store', ...headers } });
}
function replayResponse(text, headers) {
  const content = JSON.stringify({ choices: [{ delta: { content: text } }] });
  return streamResponse(`data: ${content}\n\ndata: [DONE]\n\n`, headers);
}

// 服务端读取 SSE 并结算。上游异常退还预占；主动取消且已有内容则保留计费。
function settledStream(response, env, row, signal, waitUntil) {
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = '', text = '', complete = false, settled = false;
  const cleanup = async (action) => {
    if (settled) return;
    settled = true;
    if (action === 'refund') await refundReading(env.DB, row);
    else await finishReading(env.DB, row, text, action);
  };
  const observe = value => {
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n'); buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') { complete = true; continue; }
      try {
        const event = JSON.parse(data);
        if (event.error) throw new Error('upstream error');
        const content = event.choices?.[0]?.delta?.content;
        if (typeof content === 'string') {
          text += content;
          if (text.length > 50000) throw new Error('response too long');
        }
      } catch (error) {
        if (error.message === 'upstream error' || error.message === 'response too long') throw error;
      }
    }
  };
  return new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          if (!complete || !text.trim()) throw new Error('incomplete stream');
          await cleanup('complete'); controller.close(); return;
        }
        observe(value);
        if (complete && text.trim()) await cleanup('complete');
        controller.enqueue(value);
      } catch {
        signal.abort(); await reader.cancel().catch(() => {});
        await cleanup('refund');
        controller.enqueue(new TextEncoder().encode('event: error\ndata: {"error":"解读中断，额度已退回，请重试","code":"STREAM_FAILED"}\n\n'));
        controller.close();
      }
    },
    cancel() {
      signal.abort();
      const task = reader.cancel().catch(() => {}).then(() => cleanup(complete && text.trim() ? 'complete' : text.trim() ? 'interrupted' : 'refund'));
      if (waitUntil) waitUntil(task);
      return task;
    }
  });
}

export async function onRequestPost({ request, env, waitUntil }) {
  if (!env.DEEPSEEK_API_KEY) return json({ error: '官方通道暂未开放' }, 503);
  let b; try { b = await request.json(); if (!b || typeof b !== 'object' || Array.isArray(b)) throw new Error(); } catch { return json({ error: '请求格式错误' }, 400); }
  if (!b || typeof b !== 'object') return json({ error: '请求格式错误' }, 400);
  const messages = b.messages;
  if (!Array.isArray(messages) || !messages.length || messages.some(m => !m ||
    !['system','user','assistant'].includes(m.role) || typeof m.content !== 'string')) {
    return json({ error: '解读内容格式不正确' }, 400);
  }
  const kind = b.kind === 'chat' ? 'chat' : 'summary';
  // 追问包含原牌阵和首次解读；输入仍有上限，输出额度规则不变。
  if (JSON.stringify(messages).length > (kind === 'chat' ? 36000 : 24000)) return json({ error: '内容过长' }, 400);
  const english = b.language === 'en';
  // English uses the reasoning model by default, with the existing standard allowance.
  // The opt-in two-credit deep tier is retained for Chinese readings.
  const deep = !english && b.deep === true && kind === 'summary';
  const reasoning = deep || english;
  const requestId = String(b.request_id || '');
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(requestId)) return json({ error: '请刷新页面后重试', code: 'REQUEST_ID_REQUIRED' }, 400);
  const user = await getUser(request, env);
  const keys = await guestKeys(request, b.guest_id);
  const owner = user ? 'user:' + user.id : 'guest:' + keys.key.split('|')[0];
  const id = await sha256hex(owner + ':' + requestId);
  const hash = await sha256hex(JSON.stringify({ messages, kind, deep, ...(english ? { language: 'en' } : {}) }));
  await cleanReadingRequests(env.DB);
  const previous = await env.DB.prepare('SELECT * FROM reading_requests WHERE id=?').bind(id).first();
  const headers = {};
  async function existing(row) {
    if (row.payload_hash !== hash || row.owner !== owner) return json({ error: '请求标识冲突，请刷新后重试', code: 'REQUEST_CONFLICT' }, 409);
    if (row.status === 'complete' && row.output_text) return replayResponse(row.output_text, { ...headers, 'x-reading-replayed': '1' });
    return json({ error: row.status === 'reserved' ? '解读仍在生成，请稍候再试' : '此请求已结束，请重新发起解读',
      code: row.status === 'reserved' ? 'REQUEST_IN_PROGRESS' : 'REQUEST_FINISHED' }, 409);
  }
  if (previous) return existing(previous);
  if (!await requestLimit(request, env, 'reading', 60, 600000)) return json({ error: '解读请求过于频繁，请稍后再试', code: 'READING_RATE_LIMIT' }, 429);

  let mode, cost = deep ? Math.max(1, positiveInt(env.DEEP_COST, 2)) : 1, limits, key;
  if (!user) {
    if (deep) return json({ error: '深度解读需登录并使用付费额度', code: 'NO_CREDITS' }, 402);
    mode = kind === 'chat' ? 'guest-chat' : 'guest'; limits = guestLimits(env); key = keys.key;
  } else {
    const row = await env.DB.prepare('SELECT credits,membership,free_used,email_verified FROM users WHERE id=?').bind(user.id).first();
    if (!row) return json({ error: '请重新登录' }, 401);
    limits = { free: freeCapFor(env, !!row.email_verified), member: positiveInt(env.MEMBER_DAILY_CAP, 20) };
    if (Number(row.membership) > Date.now()) mode = deep ? 'member-deep' : 'member';
    else if (!deep && row.free_used < limits.free) mode = 'free';
    else if (row.credits >= cost) mode = deep ? 'credit-deep' : 'credit';
    else return json({ error: deep ? `深度解读需 ${cost} 次付费额度` : '免费额度已用完，请充值或开通会员', code: 'NO_CREDITS' }, 402);
    key = user.id + '|' + new Date().toISOString().slice(0,10);
  }
  const { row, fresh } = await reserveReading(env.DB, { id, owner, hash, mode, cost, key,
    kind, ipKey: !user ? keys.ipKey : '', userId: user?.id }, limits);
  if (!fresh) return existing(row);
  if (row.status !== 'reserved') {
    const member = mode.startsWith('member');
    return json({ error: !user ? '今日游客免费额度已用完，请登录继续' : member ? '今日会员剩余额度不足，请明天再来' : '额度不足，请刷新后重试',
      code: !user ? 'GUEST_LIMIT' : member ? 'MEMBER_CAP' : 'NO_CREDITS' }, member ? 429 : 402);
  }
  if (user) {
    const balance = await env.DB.prepare('SELECT credits,free_used FROM users WHERE id=?').bind(user.id).first();
    headers['x-credits-left'] = String(balance.credits);
    headers['x-free-left'] = String(Math.max(0, limits.free - balance.free_used));
  } else {
    const usage = await env.DB.prepare('SELECT summ,chat FROM guest_quota WHERE k=?').bind(key).first();
    const ipUsage = await env.DB.prepare('SELECT summ,chat FROM guest_quota WHERE k=?').bind(keys.ipKey).first();
    headers['x-guest'] = '1';
    headers['x-guest-summ-left'] = String(Math.max(0, Math.min(limits.free-usage.summ, limits.ipFree-ipUsage.summ)));
    headers['x-guest-chat-left'] = String(Math.max(0, Math.min(limits.chat-usage.chat, limits.ipChat-ipUsage.chat)));
  }
  headers['x-pay-mode'] = mode;
  const configuredModel = reasoning ? env.DEEPSEEK_DEEP_MODEL : env.DEEPSEEK_MODEL;
  const model = !configuredModel || ['deepseek-chat', 'deepseek-reasoner'].includes(configuredModel) ? 'deepseek-flash' : configuredModel;
  const abort = new AbortController();
  let response;
  try {
    response = await fetch(DEEPSEEK_URL, { method: 'POST', signal: AbortSignal.any([abort.signal, AbortSignal.timeout(240000)]),
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + env.DEEPSEEK_API_KEY },
      body: JSON.stringify({ model, thinking: { type: reasoning ? 'enabled' : 'disabled' },
        messages: english ? [{ role: 'system', content: ENGLISH_READING_STYLE }, ...messages] : messages,
        stream: true, max_tokens: reasoning ? 8192 : 2048, ...(reasoning ? {} : { temperature: 1 }) }) });
    if (!response.ok || !response.body) throw new Error('upstream unavailable');
  } catch {
    await refundReading(env.DB, row);
    return json({ error: '解读服务暂时不可用，额度已退回，请重试', code: 'UPSTREAM_FAILED' }, 502);
  }
  return streamResponse(settledStream(response, env, row, abort, waitUntil), headers);
}
