// Orders v2 hosted approval; secrets and money validation stay server-side.
import { getUser, json } from './auth.js';
import { rateLimit } from './security.js';
export const PACK = Object.freeze({ id: 'readings10', credits: 10, amount: '3.99', currency: 'USD' });
class PaymentError extends Error {
  constructor(message, status = 502) { super(message); this.status = status; }
}
function settings(env, mode = env.PAYPAL_ENV || 'sandbox') {
  if (!['sandbox','live'].includes(mode) || mode !== (env.PAYPAL_ENV || 'sandbox') ||
      !env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET || !env.PAYPAL_MERCHANT_ID || !env.PAYPAL_WEBHOOK_ID) {
    throw new PaymentError('Payments are not configured yet.', 503);
  }
  const origin = new URL(env.PAYPAL_SITE_ORIGIN || 'https://www.tarot-oracle-from-joy.top');
  if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.username || origin.password || origin.search || origin.hash) {
    throw new PaymentError('Payment configuration needs review.', 503);
  }
  return { mode, origin: origin.origin, base: mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com',
    approvalHost: mode === 'live' ? 'www.paypal.com' : 'www.sandbox.paypal.com' };
}
function checkoutEnabled(env) {
  try { const cfg = settings(env); return env.PAYPAL_CHECKOUT_ENABLED === 'true' &&
    (cfg.mode === 'sandbox' || env.PAYPAL_LIVE_APPROVED === 'true'); } catch { return false; }
}
export function sandboxUserAllowed(env, user) {
  if ((env.PAYPAL_ENV || 'sandbox') === 'live') return true;
  return !!user && String(env.PAYPAL_SANDBOX_USER_IDS || '').split(',').map(id => id.trim()).includes(String(user.id));
}
export function publicConfig(env, request) {
  const enabled = checkoutEnabled(env);
  return { enabled: enabled && (!request || new URL(request.url).origin === settings(env).origin), sandbox: (env.PAYPAL_ENV || 'sandbox') !== 'live', product: PACK };
}
function approvalUrl(value, cfg) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== cfg.approvalHost || url.port || url.username || url.password) {
    throw new PaymentError('Invalid checkout response.');
  }
  return url.href;
}
function validId(id) { return typeof id === 'string' && /^[A-Z0-9]{6,40}$/.test(id); }
function assert(value) { if (!value) throw new PaymentError('Payment details do not match this order.', 409); }
async function client(env, mode) {
  const cfg = settings(env, mode);
  const tokenResponse = await fetch(`${cfg.base}/v1/oauth2/token`, { method: 'POST',
    signal: AbortSignal.timeout(15000), headers: { Authorization: `Basic ${btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
  if (!tokenResponse.ok) throw new PaymentError('Payment service is temporarily unavailable.');
  const token = await tokenResponse.json();
  if (!token.access_token) throw new PaymentError('Payment service is temporarily unavailable.');
  return { cfg, async call(path, method = 'GET', body, key) {
    const response = await fetch(`${cfg.base}${path}`, { method, signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json',
        ...(key ? { 'PayPal-Request-Id': key } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) throw new PaymentError('Payment service is temporarily unavailable. Please retry the same order.');
    return response.json();
  }};
}
async function bodyOf(request) {
  const text = await request.text();
  if (text.length > 64000) throw new PaymentError('Request too large.', 413);
  try {
    const body = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid body');
    return body;
  } catch { throw new PaymentError('Invalid request.', 400); }
}
async function loggedIn(request, env) {
  const user = await getUser(request, env);
  if (!user) throw new PaymentError('Please sign in to your original account, then retry.', 401);
  if (/@device\.local$/i.test(user.email)) throw new PaymentError('Please use an email account to purchase readings.', 403);
  return user;
}
function sameOrigin(request) {
  if (request.headers.get('Origin') !== new URL(request.url).origin) throw new PaymentError('Forbidden origin.', 403);
}
export async function createOrder(request, env) {
  sameOrigin(request);
  if (!checkoutEnabled(env)) throw new PaymentError('Payments are not available yet.', 503);
  const user = await loggedIn(request, env);
  if (!sandboxUserAllowed(env,user)) throw new PaymentError('Sandbox checkout is restricted to test accounts.',403);
  const input = await bodyOf(request);
  if (input.product !== PACK.id || typeof input.request_key !== 'string' || !/^[a-zA-Z0-9-]{16,64}$/.test(input.request_key)) {
    throw new PaymentError('Invalid product or request.', 400);
  }
  if (!await rateLimit(env.DB, `limit:paypal-create:${user.id}:${Math.floor(Date.now()/60000)}`, 10)) {
    throw new PaymentError('Please wait a minute before trying again.', 429);
  }
  const cfg = settings(env), now = Date.now();
  if (new URL(request.url).origin !== cfg.origin) throw new PaymentError("Please use the official site to purchase.",403);
  await env.DB.prepare(`INSERT OR IGNORE INTO paypal_orders
    (id,user_id,request_key,mode,merchant_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?)`)
    .bind(crypto.randomUUID(), user.id, input.request_key, cfg.mode, env.PAYPAL_MERCHANT_ID, now, now).run();
  const row = await env.DB.prepare('SELECT * FROM paypal_orders WHERE user_id=? AND request_key=?').bind(user.id,input.request_key).first();
  assert(row.mode === cfg.mode && row.merchant_id === env.PAYPAL_MERCHANT_ID);
  if (row.status !== 'created') throw new PaymentError('This order has already been processed. Start a new purchase.', 409);
  if (row.paypal_id) return { order_id: row.paypal_id, approval_url: approvalUrl(row.approval_url, cfg), sandbox: cfg.mode === 'sandbox' };
  // PayPal retains request ids for a limited period; never retry ambiguous old creates as a new charge.
  if (now - row.created_at > 5 * 3600000) throw new PaymentError('This checkout has expired. Start a new purchase.', 409);
  const paypal = await client(env);
  const order = await paypal.call('/v2/checkout/orders', 'POST', {
    intent: 'CAPTURE', purchase_units: [{ reference_id: row.id, custom_id: row.id, invoice_id: row.id,
      description: 'Tarot Oracle — 10 reading credits', payee: { merchant_id: row.merchant_id },
      amount: { currency_code: row.currency, value: row.amount } }],
    payment_source: { paypal: { experience_context: { user_action: 'PAY_NOW', shipping_preference: 'NO_SHIPPING',
      return_url: `${cfg.origin}/paypal-return`, cancel_url: `${cfg.origin}/paypal-return?cancelled=1` } } }
  }, row.id);
  assert(validId(order.id));
  const url = approvalUrl(order.links?.find(link => ['payer-action','approve'].includes(link.rel))?.href, cfg);
  await env.DB.prepare('UPDATE paypal_orders SET paypal_id=?,approval_url=?,updated_at=? WHERE id=? AND paypal_id IS NULL')
    .bind(order.id,url,Date.now(),row.id).run();
  return { order_id: order.id, approval_url: url, sandbox: cfg.mode === 'sandbox' };
}
function validateOrder(order, row) {
  assert(order.id === row.paypal_id && order.intent === 'CAPTURE' && order.purchase_units?.length === 1);
  const unit = order.purchase_units[0];
  assert(unit.custom_id === row.id && unit.payee?.merchant_id === row.merchant_id &&
    unit.amount?.currency_code === row.currency && unit.amount?.value === row.amount);
  const captures = unit.payments?.captures || [];
  assert(captures.length <= 1);
  return captures[0];
}
function validateCapture(capture, row, id) {
  assert(capture.id === id && capture.amount?.currency_code === row.currency && capture.amount?.value === row.amount);
  if (capture.supplementary_data?.related_ids?.order_id) assert(capture.supplementary_data.related_ids.order_id === row.paypal_id);
}
async function result(env, row) {
  const fresh = await env.DB.prepare('SELECT status FROM paypal_orders WHERE id=?').bind(row.id).first();
  const grant = await env.DB.prepare("SELECT delta FROM paypal_credit_ledger WHERE order_id=? AND kind='grant'").bind(row.id).first();
  return { status: fresh.status, sandbox: row.mode === 'sandbox', credits_added: fresh.status === 'completed' ? (grant?.delta || 0) : 0 };
}
async function revoke(env, row, status, captureId) {
  await env.DB.batch([
    env.DB.prepare('UPDATE paypal_orders SET status=?,capture_id=COALESCE(capture_id,?),updated_at=? WHERE id=?')
      .bind(status,captureId,Date.now(),row.id),
    env.DB.prepare(`INSERT OR IGNORE INTO paypal_credit_ledger(order_id,kind,user_id,delta,created_at)
      SELECT order_id,'revoke',user_id,-delta,? FROM paypal_credit_ledger WHERE order_id=? AND kind='grant'`)
      .bind(Date.now(),row.id)
  ]);
}
async function reconcile(env, row, paypal, order) {
  const summary = validateOrder(order, row);
  if (!summary) return result(env,row);
  assert(validId(summary.id));
  const capture = await paypal.call(`/v2/payments/captures/${summary.id}`);
  validateCapture(capture,row,summary.id);
  if (capture.status === 'REFUNDED') await revoke(env,row,'refunded',capture.id);
  else if (capture.status === 'PARTIALLY_REFUNDED') {
    await env.DB.prepare("UPDATE paypal_orders SET status='review',capture_id=?,updated_at=? WHERE id=? AND status NOT IN ('refunded','reversed')")
      .bind(capture.id,Date.now(),row.id).run();
  } else if (capture.status === 'COMPLETED' && order.status === 'COMPLETED') {
    // Sandbox only records a successful test: it never changes real account credits.
    await env.DB.batch([
      env.DB.prepare("UPDATE paypal_orders SET status='completed',capture_id=?,updated_at=? WHERE id=? AND status IN ('created','completed')")
        .bind(capture.id,Date.now(),row.id),
      env.DB.prepare(`INSERT OR IGNORE INTO paypal_credit_ledger(order_id,kind,user_id,delta,created_at)
        SELECT id,'grant',user_id,credits,? FROM paypal_orders WHERE id=? AND status='completed' AND mode='live'`)
        .bind(Date.now(),row.id)
    ]);
  }
  return result(env,row);
}
export async function captureOrder(request, env) {
  sameOrigin(request);
  const user = await loggedIn(request,env), input = await bodyOf(request);
  if (!validId(input.order_id)) throw new PaymentError('Invalid order.', 400);
  const row = await env.DB.prepare('SELECT * FROM paypal_orders WHERE paypal_id=? AND user_id=?').bind(input.order_id,user.id).first();
  if (!row) throw new PaymentError('Order not found for this account.', 404);
  if (!await rateLimit(env.DB, `limit:paypal-capture:${user.id}:${Math.floor(Date.now()/60000)}`, 15)) throw new PaymentError('Please retry in a minute.', 429);
  // Disabling new checkout must not prevent an existing paid order from being fulfilled.
  const paypal = await client(env,row.mode);
  let order = await paypal.call(`/v2/checkout/orders/${row.paypal_id}`);
  validateOrder(order,row);
  if (order.status === 'APPROVED' && row.status === 'created') {
    try { await paypal.call(`/v2/checkout/orders/${row.paypal_id}/capture`,'POST',{},`${row.id}-c`); }
    catch { /* Re-read after ambiguous network failure or simultaneous webhook. */ }
    order = await paypal.call(`/v2/checkout/orders/${row.paypal_id}`);
  }
  return reconcile(env,row,paypal,order);
}
export async function webhook(request, env) {
  const event = await bodyOf(request);
  if (typeof event.id !== 'string' || event.id.length > 120 || typeof event.event_type !== 'string') throw new PaymentError('Invalid event.',400);
  const headers = Object.fromEntries(['auth-algo','cert-url','transmission-id','transmission-sig','transmission-time']
    .map(key => [key.replaceAll('-','_'),request.headers.get(`paypal-${key}`)]));
  if (Object.values(headers).some(value => !value)) throw new PaymentError('Missing signature.',400);
  const paypal = await client(env);
  // cert_url is handed to PayPal verification, never fetched directly by this server.
  const verified = await paypal.call('/v1/notifications/verify-webhook-signature','POST', {
    ...headers, webhook_id: env.PAYPAL_WEBHOOK_ID, webhook_event: event
  });
  if (verified.verification_status !== 'SUCCESS') throw new PaymentError('Invalid signature.',400);
  if (await env.DB.prepare('SELECT id FROM paypal_events WHERE id=?').bind(event.id).first()) return { received: true };
  const supported = ['PAYMENT.CAPTURE.COMPLETED','PAYMENT.CAPTURE.REFUNDED','PAYMENT.CAPTURE.REVERSED'];
  if (!supported.includes(event.event_type)) return { received: true };
  const resource = event.resource || {};
  let captureId = event.event_type === 'PAYMENT.CAPTURE.REFUNDED' ? resource.supplementary_data?.related_ids?.capture_id : resource.id;
  if (!captureId && event.event_type === 'PAYMENT.CAPTURE.REFUNDED') {
    const up = resource.links?.find(link => link.rel === 'up')?.href;
    if (up) {
      const url = new URL(up);
      const hosts = paypal.cfg.mode === 'live' ? ['api.paypal.com','api-m.paypal.com'] : ['api.sandbox.paypal.com','api-m.sandbox.paypal.com'];
      if (url.protocol === 'https:' && hosts.includes(url.hostname) && !url.port && !url.username && !url.password) {
        captureId = url.pathname.match(/^\/v2\/payments\/captures\/([A-Z0-9]+)$/)?.[1];
      }
    }
  }
  let row = validId(captureId) ? await env.DB.prepare('SELECT * FROM paypal_orders WHERE capture_id=?').bind(captureId).first() : null;
  let orderId = resource.supplementary_data?.related_ids?.order_id;
  if (!row && validId(captureId) && !validId(orderId)) {
    const capture = await paypal.call(`/v2/payments/captures/${captureId}`);
    orderId = capture.supplementary_data?.related_ids?.order_id;
  }
  if (!row && validId(orderId)) row = await env.DB.prepare('SELECT * FROM paypal_orders WHERE paypal_id=?').bind(orderId).first();
  // Retry unmapped site payment events: persistence may lag the provider notification.
  if (!row) throw new PaymentError('Order not persisted yet. Retry delivery.',503);
  assert(row.mode === paypal.cfg.mode);
  const order = await paypal.call(`/v2/checkout/orders/${row.paypal_id}`);
  const capture = validateOrder(order,row);
  if (event.event_type === 'PAYMENT.CAPTURE.REVERSED') {
    assert(capture && capture.id === captureId);
    await revoke(env,row,'reversed',captureId);
  } else {
    const outcome = await reconcile(env,row,paypal,order);
    if (event.event_type === 'PAYMENT.CAPTURE.REFUNDED' && !['refunded','reversed','review'].includes(outcome.status)) {
      throw new PaymentError('Refund confirmation is pending. Retry delivery.',503);
    }
    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED' && outcome.status === 'created') {
      throw new PaymentError('Payment confirmation is pending. Retry delivery.',503);
    }
  }
  await env.DB.prepare('INSERT OR IGNORE INTO paypal_events(id,event_type,order_id,processed_at) VALUES(?,?,?,?)')
    .bind(event.id,event.event_type,row.id,Date.now()).run();
  return { received: true };
}
export async function handle(operation, request, env) {
  try { return json(await operation(request,env)); }
  catch (error) {
    // No provider bodies, access tokens or personal information in logs/responses.
    if (!(error instanceof PaymentError)) console.error('PayPal operation failed:', error?.name || 'Error');
    return json({ error: error instanceof PaymentError ? error.message : 'Unable to confirm payment. Please retry or contact support.', },error.status || 502);
  }
}
