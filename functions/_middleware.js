export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  const path = decodeURIComponent(url.pathname);
  if (/^\/(?:schema\.sql|wrangler\.jsonc|反馈1\.xlsx|\.dev\.vars|README\.md|RELEASE\.md|ACCEPTANCE\.md|chatgpt-export[^/]*)(?:$|\/)|^\/(?:\.claude|\.wrangler|\.git)(?:\/|$)/.test(path)) {
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  if (url.pathname.startsWith('/api/') && !['GET','HEAD','OPTIONS'].includes(request.method)) {
    const origin = request.headers.get('Origin');
    if (origin && origin !== url.origin) return new Response('Forbidden origin', { status: 403 });
  }
  const response = await next();
  const secured = new Response(response.body, response);
  if (url.pathname.startsWith('/api/')) secured.headers.set('Cache-Control', 'no-store');
  secured.headers.set('X-Content-Type-Options', 'nosniff');
  secured.headers.set('X-Frame-Options', 'DENY');
  secured.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return secured;
}
