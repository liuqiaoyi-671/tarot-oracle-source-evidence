// User-supplied credentials are forwarded only to this fixed official endpoint.
// Do not log or persist the authorization header, prompts or upstream errors.
const ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const MAX_BYTES = 200000;
function error(message, status) {
  return Response.json({error: {message}}, {status, headers: {'Cache-Control': 'no-store'}});
}
export async function onRequestPost({request}) {
  if (request.headers.get('Origin') !== new URL(request.url).origin) return error('Forbidden origin', 403);
  const authorization = request.headers.get('Authorization') || '';
  if (!/^Bearer [^\s]{1,1024}$/.test(authorization)) return error('API key required', 401);
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return error('JSON required', 415);
  if (Number(request.headers.get('Content-Length')) > MAX_BYTES) return error('Request too large', 413);
  let body;
  try {
    const reader = request.body?.getReader();
    if (!reader) return error('Invalid request', 400);
    const chunks = []; let length = 0;
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BYTES) { await reader.cancel(); return error('Request too large', 413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch { return error('Invalid request', 400); }
  if (!body || typeof body.model !== 'string' || !/^glm-[a-z0-9.-]{1,80}$/i.test(body.model) || body.stream !== true ||
      !Array.isArray(body.messages) || !body.messages.length || body.messages.length > 100 ||
      body.messages.some(m => !m || !['system','user','assistant'].includes(m.role) || typeof m.content !== 'string')) {
    return error('Invalid model or messages', 400);
  }
  try {
    const upstream = await fetch(ENDPOINT, {
      method: 'POST', redirect: 'error',
      headers: {'Content-Type': 'application/json', Authorization: authorization},
      body: JSON.stringify({model: body.model, stream: true, messages: body.messages.map(({role, content}) => ({role, content}))}),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(180000)])
    });
    return new Response(upstream.body, {status: upstream.status, headers: {
      'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'
    }});
  } catch { return error('Unable to connect to Zhipu. Please retry later. / 暂时无法连接智谱，请稍后重试。', 502); }
}
