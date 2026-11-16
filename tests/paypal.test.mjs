import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './support/sqlite.mjs';
import { createSession } from '../lib/auth.js';
import { createOrder, captureOrder, webhook, handle, publicConfig } from '../lib/paypal.js';
const origin = 'https://www.tarot-oracle-from-joy.top';
async function setup(mode = 'live') {
  const { sql, db } = fixture();
  const env = { DB: db, PAYPAL_ENV: mode, PAYPAL_CHECKOUT_ENABLED: 'true', PAYPAL_LIVE_APPROVED: 'true',
    PAYPAL_SANDBOX_USER_IDS: '1', PAYPAL_CLIENT_ID: 'test-id', PAYPAL_CLIENT_SECRET: 'test-secret', PAYPAL_MERCHANT_ID: 'SELLER123', PAYPAL_WEBHOOK_ID: 'WEBHOOK123' };
  const sid = await createSession(env,1);
  const request = (body, headers = {}, cookie = sid) => new Request(`${origin}/api/paypal/test`, {
    method: 'POST', headers: { Origin: origin, Cookie: `sid=${cookie}`, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body)
  });
  const state = { id: null, status: 'APPROVED', captureStatus: 'COMPLETED', captured: false,
    amount: '3.99', currency: 'USD', merchant: 'SELLER123', custom: null, verified: true, calls: [] };
  const capture = () => ({ id: 'CAPTURE123', status: state.captureStatus, amount: { currency_code: state.currency,value: state.amount },
    supplementary_data: { related_ids: { order_id: 'ORDER123' } } });
  const order = () => ({ id: 'ORDER123', intent: 'CAPTURE', status: state.status, purchase_units: [{ custom_id: state.custom || state.id,
    payee: { merchant_id: state.merchant }, amount: { currency_code: state.currency,value: state.amount },
    ...(state.captured ? { payments: { captures: [capture()] } } : {}) }] });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    state.calls.push({ url, options });
    if (url.endsWith('/v1/oauth2/token')) return Response.json({ access_token: 'TEST-TOKEN' });
    if (url.endsWith('/verify-webhook-signature')) return Response.json({ verification_status: state.verified ? 'SUCCESS' : 'FAILURE' });
    if (url.endsWith('/v2/checkout/orders') && options.method === 'POST') {
      const body = JSON.parse(options.body);
      state.id = body.purchase_units[0].custom_id;
      assert.equal(body.purchase_units[0].amount.value,'3.99');
      assert.equal(body.purchase_units[0].payee.merchant_id,'SELLER123');
      assert.equal(body.payment_source.paypal.experience_context.return_url,`${origin}/paypal-return`);
      return Response.json({ id:'ORDER123', links: [{ rel:'payer-action', href: mode === 'live' ? 'https://www.paypal.com/checkoutnow?token=ORDER123' : 'https://www.sandbox.paypal.com/checkoutnow?token=ORDER123' }] });
    }
    if (url.endsWith('/ORDER123/capture')) { state.captured = true; state.status = 'COMPLETED'; if (state.captureNetworkFailure) throw new Error('Simulated lost capture response'); return Response.json(order()); }
    if (url.endsWith('/orders/ORDER123')) return Response.json(order());
    if (url.endsWith('/captures/CAPTURE123')) return Response.json(capture());
    throw new Error(`Unexpected test URL ${url}`);
  };
  return { env,sql,state,request,restore() { globalThis.fetch = originalFetch; sql.close(); },
    async create(key = 'request-key-123456789') { return createOrder(request({ product:'readings10', request_key:key, amount:'0.01', user_id:99 }),env); },
    credits() { return sql.prepare('SELECT credits FROM users WHERE id=1').get().credits; },
    event(type = 'PAYMENT.CAPTURE.COMPLETED', id = 'EVENT123') {
      return request({ id,event_type:type,resource: type === 'PAYMENT.CAPTURE.REFUNDED'
        ? { id:'REFUND123',links:[{rel:'up',href:`https://api${mode === 'sandbox' ? '.sandbox' : ''}.paypal.com/v2/payments/captures/CAPTURE123`}] }
        : capture() }, { 'paypal-auth-algo':'SHA256withRSA','paypal-cert-url':'https://api.paypal.com/cert','paypal-transmission-id':'TX123',
          'paypal-transmission-sig':'SIGNATURE','paypal-transmission-time':new Date().toISOString() });
    }
  };
}
test('checkout remains disabled without complete config and explicit live approval',()=>{
  assert.equal(publicConfig({}).enabled,false);
  const env = { PAYPAL_ENV:'live',PAYPAL_CHECKOUT_ENABLED:'true',PAYPAL_CLIENT_ID:'a',PAYPAL_CLIENT_SECRET:'b',PAYPAL_MERCHANT_ID:'c',PAYPAL_WEBHOOK_ID:'d' };
  assert.equal(publicConfig(env).enabled,false);
  assert.equal(publicConfig({...env,PAYPAL_LIVE_APPROVED:'true'}).enabled,true);
  assert.equal(JSON.stringify(publicConfig(env)).includes('CLIENT_SECRET'),false);
});
test('server price, reusable create, capture and webhook replay add exactly 10 credits',async()=>{
  const f = await setup(); try {
    const one = await f.create(), two = await f.create();
    assert.equal(one.order_id,two.order_id);
    assert.equal(f.state.calls.filter(x => x.url.endsWith('/v2/checkout/orders')).length,1);
    f.env.PAYPAL_CHECKOUT_ENABLED = 'false'; // Existing payments still settle.
    const result = await captureOrder(f.request({order_id:one.order_id}),f.env);
    assert.equal(result.credits_added,10); assert.equal(f.credits(),13);
    await captureOrder(f.request({order_id:one.order_id}),f.env);
    await Promise.all([webhook(f.event(),f.env),webhook(f.event(),f.env)]);
    assert.equal(f.credits(),13);
    assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM paypal_credit_ledger').get().n,1);
  } finally { f.restore(); }
});
test('sandbox records test success without granting real account credits',async()=>{
  const f = await setup('sandbox'); try {
    await f.create();
    const result = await captureOrder(f.request({order_id:'ORDER123'}),f.env);
    assert.equal(result.status,'completed'); assert.equal(result.sandbox,true);
    assert.equal(result.credits_added,0); assert.equal(f.credits(),3);
  } finally { f.restore(); }
});
test('webhook fulfills payment even when the customer does not return',async()=>{
  const f = await setup(); try {
    await f.create(); f.state.status='COMPLETED'; f.state.captured=true;
    await webhook(f.event(),f.env);
    assert.equal(f.credits(),13);
  } finally { f.restore(); }
});
test('unapproved and pending payments do not grant credits; pending webhook requests retry',async()=>{
  const f = await setup(); try {
    await f.create(); f.state.status='CREATED';
    const result = await captureOrder(f.request({order_id:'ORDER123'}),f.env);
    assert.equal(result.status,'created'); assert.equal(f.credits(),3);
    f.state.status='COMPLETED';f.state.captured=true;f.state.captureStatus='PENDING';
    const response = await handle(webhook,f.event(),f.env);
    assert.equal(response.status,503);assert.equal(f.credits(),3);
    assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM paypal_events').get().n,0);
  } finally { f.restore(); }
});
test('wrong amount, currency, seller or local order reference never grant credits',async()=>{
  for (const [key,value] of [['amount','0.01'],['currency','EUR'],['merchant','OTHER123'],['custom','other-order']]) {
    const f = await setup(); try {
      await f.create();f.state[key]=value;
      const response = await handle(captureOrder,f.request({order_id:'ORDER123'}),f.env);
      assert.equal(response.status,409,key);assert.equal(f.credits(),3,key);
    } finally { f.restore(); }
  }
});
test('account ownership, origin, missing login and invalid webhook signature are rejected',async()=>{
  const f = await setup(); try {
    await f.create();
    f.sql.exec("INSERT INTO users(id,email,pass,created_at) VALUES(2,'other@example.com','x',0)");
    const other = await createSession(f.env,2);
    assert.equal((await handle(captureOrder,f.request({order_id:'ORDER123'},{},other),f.env)).status,404);
    assert.equal((await handle(captureOrder,f.request({order_id:'ORDER123'},{},'invalid'),f.env)).status,401);
    assert.equal((await handle(createOrder,f.request({product:'readings10',request_key:'request-key-123456789'},{Origin:'https://evil.example'}),f.env)).status,403);
    f.state.verified=false;
    assert.equal((await handle(webhook,f.event(),f.env)).status,400);
    assert.equal(f.credits(),3);
  } finally { f.restore(); }
});
test('refund reclaims credits once, including spent credits; stale completion cannot regrant',async()=>{
  const f = await setup(); try {
    await f.create();await captureOrder(f.request({order_id:'ORDER123'}),f.env);
    f.sql.exec('UPDATE users SET credits=1 WHERE id=1');
    f.state.captureStatus='REFUNDED';
    await webhook(f.event('PAYMENT.CAPTURE.REFUNDED','REFUND-EVENT'),f.env);
    await webhook(f.event('PAYMENT.CAPTURE.REFUNDED','REFUND-EVENT2'),f.env);
    assert.equal(f.credits(),-9);
    f.state.captureStatus='COMPLETED';
    await webhook(f.event('PAYMENT.CAPTURE.COMPLETED','STALE-EVENT'),f.env);
    assert.equal(f.credits(),-9);
    assert.equal(f.sql.prepare('SELECT status FROM paypal_orders').get().status,'refunded');
  } finally { f.restore(); }
});
test('refund before fulfillment prevents grant; reversal and partial refund are tracked',async()=>{
  for (const status of ['REFUNDED','PARTIALLY_REFUNDED','REVERSED']) {
    const f = await setup(); try {
      await f.create();f.state.status='COMPLETED';f.state.captured=true;
      f.state.captureStatus=status === 'REVERSED' ? 'COMPLETED' : status;
      await webhook(f.event(status === 'REVERSED' ? 'PAYMENT.CAPTURE.REVERSED' : 'PAYMENT.CAPTURE.REFUNDED'),f.env);
      assert.equal(f.credits(),3);
      const result = await captureOrder(f.request({order_id:'ORDER123'}),f.env);
      assert.equal(result.credits_added,0);
      assert.ok(['refunded','review','reversed'].includes(result.status));
    } finally { f.restore(); }
  }
});
test('refund notification with an unsettled provider status is retried, not discarded',async()=>{
  const f = await setup();try {
    await f.create();await captureOrder(f.request({order_id:'ORDER123'}),f.env);
    assert.equal((await handle(webhook,f.event('PAYMENT.CAPTURE.REFUNDED'),f.env)).status,503);
    assert.equal(f.credits(),13);
    f.state.captureStatus='REFUNDED';
    await webhook(f.event('PAYMENT.CAPTURE.REFUNDED'),f.env);
    assert.equal(f.credits(),3);
  } finally {f.restore();}
});

test('lost capture response recovers provider state instead of creating another charge',async()=>{
  const f = await setup();try {
    await f.create();f.state.captureNetworkFailure=true;
    const result=await captureOrder(f.request({order_id:'ORDER123'}),f.env);
    assert.equal(result.credits_added,10);assert.equal(f.credits(),13);
    await captureOrder(f.request({order_id:'ORDER123'}),f.env);
    assert.equal(f.state.calls.filter(call=>call.url.endsWith('/ORDER123/capture')).length,1);
  }finally{f.restore();}
});
test('credit write failure rolls back fulfillment status, then retry safely recovers',async()=>{
  const f = await setup();try {
    await f.create();
    f.sql.exec("CREATE TRIGGER fail_paypal_credit BEFORE UPDATE OF credits ON users BEGIN SELECT RAISE(ABORT,'test write failure');END");
    await assert.rejects(captureOrder(f.request({order_id:'ORDER123'}),f.env));
    assert.equal(f.sql.prepare('SELECT status FROM paypal_orders').get().status,'created');
    assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM paypal_credit_ledger').get().n,0);
    assert.equal(f.credits(),3);
    f.sql.exec('DROP TRIGGER fail_paypal_credit');
    const result=await captureOrder(f.request({order_id:'ORDER123'}),f.env);
    assert.equal(result.credits_added,10);assert.equal(f.credits(),13);
  }finally{f.restore();}
});

test('unsigned or malformed notifications are rejected before acquiring a provider token',async()=>{
  const f = await setup();try {
    const response=await handle(webhook,f.request({id:'UNSIGNED',event_type:'PAYMENT.CAPTURE.COMPLETED'}),f.env);
    assert.equal(response.status,400);assert.equal(f.state.calls.length,0);
    const malformed=await handle(webhook,f.request(null),f.env);
    assert.equal(malformed.status,400);assert.equal(f.state.calls.length,0);assert.equal(f.credits(),3);
  }finally{f.restore();}
});

test('sandbox purchases require a named test account even when checkout is configured',async()=>{
  const f=await setup('sandbox');try {
    f.env.PAYPAL_SANDBOX_USER_IDS='';
    const response=await handle(createOrder,f.request({product:'readings10',request_key:'sandbox-denied-request'}),f.env);
    assert.equal(response.status,403);assert.equal(f.state.calls.length,0);assert.equal(f.credits(),3);
    const route=await import('../functions/api/paypal/config.js');
    assert.equal((await (await route.onRequestGet({request:f.request({}),env:f.env})).json()).enabled,false);
    f.env.PAYPAL_SANDBOX_USER_IDS='1';
    assert.equal((await (await route.onRequestGet({request:f.request({}),env:f.env})).json()).enabled,true);
    assert.equal((await (await route.onRequestGet({request:f.request({},{},'not-logged-in'),env:f.env})).json()).enabled,false);
  }finally{f.restore();}
});
