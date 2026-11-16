import { fixture } from './support/sqlite.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { reserveReading, refundReading, cleanReadingRequests } from '../lib/reading-billing.js';
import { onRequestPost as redeem } from '../functions/api/redeem.js';
import { onRequestPost as reading } from '../functions/api/reading.js';
import { sha256hex } from '../lib/auth.js';

async function redeemFixture() {
  const f = fixture();
  f.sql.prepare('INSERT INTO sessions VALUES(?,?,?)').run(await sha256hex('test-token'), 1, Date.now() + 100000);
  f.add = async (code, batch = 'regular', credits = 5, days = 0) => {
    f.sql.prepare('INSERT INTO redeem_codes(code_hash,credits,membership_days,batch,created_at) VALUES(?,?,?,?,0)')
      .run(await sha256hex(code), credits, days, batch);
  };
  f.redeem = code => redeem({ request: new Request('https://local/api/redeem', {
    method: 'POST', headers: { cookie: 'sid=test-token' }, body: JSON.stringify({ code })
  }), env: { DB: f.db } });
  return f;
}

test('同一码并发只能成功一次；不同首单码并发也只能成功一次', async () => {
  const f = await redeemFixture();
  try {
    await f.add('REGULAR01');
    const same = await Promise.all([f.redeem('REGULAR01'), f.redeem('REGULAR01')]);
    assert.deepEqual(same.map(r => r.status).sort(), [200, 409]);
    assert.equal(f.sql.prepare('SELECT credits FROM users').get().credits, 8);
    await f.add('FIRST001', 'first-a'); await f.add('FIRST002', 'first-b');
    const first = await Promise.all([f.redeem('FIRST001'), f.redeem('FIRST002')]);
    assert.deepEqual(first.map(r => r.status).sort(), [200, 409]);
    assert.equal(f.sql.prepare('SELECT credits FROM users').get().credits, 13);
    assert.equal(f.sql.prepare("SELECT count(*) n FROM redeem_codes WHERE batch LIKE 'first%' AND used_by IS NOT NULL").get().n, 1);
  } finally { f.sql.close(); }
});

test('标记兑换失败时权益整体回滚；会员续期累加现有到期时间', async () => {
  const f = await redeemFixture();
  try {
    await f.add('ROLLBACK1');
    f.sql.exec("CREATE TRIGGER fail_mark BEFORE UPDATE ON redeem_codes BEGIN SELECT RAISE(ABORT,'test failure'); END");
    await assert.rejects(f.redeem('ROLLBACK1'), /test failure/);
    assert.equal(f.sql.prepare('SELECT credits FROM users').get().credits, 3);
    assert.equal(f.sql.prepare('SELECT used_by FROM redeem_codes').get().used_by, null);
    f.sql.exec('DROP TRIGGER fail_mark');
    const until = Date.now() + 10 * 86400000;
    f.sql.prepare('UPDATE users SET membership=?').run(String(until));
    await f.add('MEMBER001', 'regular', 0, 30);
    await f.add('MEMBER002', 'regular', 0, 7);
    const results = await Promise.all([f.redeem('MEMBER001'), f.redeem('MEMBER002')]);
    assert.ok(results.every(r => r.status === 200));
    assert.equal(Number(f.sql.prepare('SELECT membership FROM users').get().membership), until + 37 * 86400000);
  } finally { f.sql.close(); }
});

test('解读接口：上游失败退费；预占阻止并发透支；深度额度不足不调用上游', async () => {
  const f = await redeemFixture(), originalFetch = globalThis.fetch;
  const env = { DB: f.db, DEEPSEEK_API_KEY: 'test', FREE_CAP_UNVERIFIED: '1' };
  const request = (deep=false) => new Request('https://local/api/reading', {
    method:'POST', headers:{cookie:'sid=test-token'},
    body:JSON.stringify({request_id:crypto.randomUUID(),messages:[{role:'user',content:'test'}],deep})
  });
  try {
    globalThis.fetch = async () => new Response('unavailable',{status:503});
    assert.equal((await reading({request:request(),env})).status,502);
    assert.equal(f.sql.prepare('SELECT free_used FROM users').get().free_used,0);
    f.sql.exec('UPDATE users SET credits=0');
    let calls=0;
    globalThis.fetch = async () => { calls++; return new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n'); };
    const responses = await Promise.all([reading({request:request(),env}),reading({request:request(),env})]);
    assert.deepEqual(responses.map(r=>r.status).sort(),[200,402]); assert.equal(calls,1);
    const success=responses.find(r=>r.status===200); await success.text();
    assert.equal(success.headers.get('x-free-left'),'0');
    assert.equal(f.sql.prepare('SELECT free_used FROM users').get().free_used,1);
    f.sql.prepare('UPDATE users SET membership=?').run(String(Date.now()+86400000));
    f.sql.prepare('INSERT INTO member_daily(k,count) VALUES(?,19)').run('1|'+new Date().toISOString().slice(0,10));
    assert.equal((await reading({request:request(true),env})).status,429); assert.equal(calls,1);
  } finally {globalThis.fetch=originalFetch;f.sql.close();}
});

const usage = (id,mode='free',extra={}) => ({id,owner:'user:1',hash:'hash',mode,cost:1,key:'1|day',userId:1,...extra});
const limits = {free:1,member:20,chat:1,ipFree:3,ipChat:6};
test('预占请求幂等；余额不足不会连接上游；退款重复执行不会重复加余额', async () => {
  const f=fixture();
  try {
    const first=await reserveReading(f.db,usage('same'),limits);
    assert.equal(first.row.status,'reserved');
    assert.equal((await reserveReading(f.db,usage('same'),limits)).fresh,false);
    assert.equal((await reserveReading(f.db,usage('other'),limits)).row.status,'denied');
    assert.equal(f.sql.prepare('SELECT free_used FROM users').get().free_used,1);
    await Promise.all([refundReading(f.db,first.row),refundReading(f.db,first.row)]);
    assert.equal(f.sql.prepare('SELECT free_used FROM users').get().free_used,0);
    const credit=await reserveReading(f.db,usage('deep','credit-deep',{cost:2}),limits);
    assert.equal(f.sql.prepare('SELECT credits FROM users').get().credits,1);
    await refundReading(f.db,credit.row);await refundReading(f.db,credit.row);
    assert.equal(f.sql.prepare('SELECT credits FROM users').get().credits,3);
    f.sql.exec("INSERT INTO member_daily(k,count) VALUES('1|day',19)");
    assert.equal((await reserveReading(f.db,usage('member','member-deep',{cost:2}),limits)).row.status,'denied');
  } finally {f.sql.close();}
});

test('更换游客 ID 仍受 IP 上限保护；解读前不能追问；退款返还两层额度', async () => {
  const f=fixture();
  const guest=(id,kind='summary')=>usage(id,kind==='chat'?'guest-chat':'guest',{owner:'guest:'+id,userId:undefined,key:id,ipKey:'shared-ip',kind});
  try {
    assert.equal((await reserveReading(f.db,guest('no-summary','chat'),limits)).row.status,'denied');
    const accepted=[];
    for(let i=0;i<4;i++) accepted.push(await reserveReading(f.db,guest('g'+i),limits));
    assert.deepEqual(accepted.map(r=>r.row.status),['reserved','reserved','reserved','denied']);
    assert.equal(f.sql.prepare("SELECT summ FROM guest_quota WHERE k='g3'").get(),undefined);
    await refundReading(f.db,accepted[0].row);
    assert.equal(f.sql.prepare("SELECT summ FROM guest_quota WHERE k='shared-ip'").get().summ,2);
    const chat=await reserveReading(f.db,guest('g1-chat','chat'),limits);
    assert.equal(chat.row.status,'denied');
    const validChat=await reserveReading(f.db,{...guest('g1-followup','chat'),key:'g1'},limits);
    assert.equal(validChat.row.status,'reserved'); await refundReading(f.db,validChat.row);
    assert.equal(f.sql.prepare("SELECT chat FROM guest_quota WHERE k='g1'").get().chat,0);
  } finally {f.sql.close();}
});

test('完成流可恢复相同结果且不重复扣费；异常流退款；取消已输出内容保留计费', async () => {
  const f=await redeemFixture(),originalFetch=globalThis.fetch;
  const env={DB:f.db,DEEPSEEK_API_KEY:'test',FREE_CAP_UNVERIFIED:'0'};
  const request=id=>new Request('https://local/api/reading',{method:'POST',headers:{cookie:'sid=test-token'},body:JSON.stringify({request_id:id,messages:[{role:'user',content:'test'}]})});
  try {
    let calls=0;
    globalThis.fetch=async()=>{calls++;return new Response('data: {"choices":[{"delta":{"content":"完成结果"}}]}\n\ndata: [DONE]\n\n');};
    const id=crypto.randomUUID();const first=await reading({request:request(id),env});
    await first.text();const replay=await reading({request:request(id),env});
    assert.equal(replay.headers.get('x-reading-replayed'),'1');assert.match(await replay.text(),/完成结果/);assert.equal(calls,1);
    assert.equal(f.sql.prepare('SELECT credits FROM users').get().credits,2);
    globalThis.fetch=async()=>new Response('data: {"choices":[{"delta":{"content":"截断"}}]}\n\n');
    const broken=await reading({request:request(crypto.randomUUID()),env});
    assert.match(await broken.text(),/STREAM_FAILED/);assert.equal(f.sql.prepare('SELECT credits FROM users').get().credits,2);
    globalThis.fetch=async()=>new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"部分内容"}}]}\n\n'));}}));
    const partial=await reading({request:request(crypto.randomUUID()),env});
    const reader=partial.body.getReader();await reader.read();await reader.cancel();
    assert.equal(f.sql.prepare('SELECT credits FROM users').get().credits,1);
    assert.equal(f.sql.prepare("SELECT COUNT(*) n FROM reading_requests WHERE status='interrupted'").get().n,1);
  } finally {globalThis.fetch=originalFetch;f.sql.close();}
});

test('遗留预占超时补偿；账本第二步失败整体回滚',async()=>{
  const f=fixture();
  try{
    const first=await reserveReading(f.db,usage('stale','credit'),limits);
    f.sql.prepare('UPDATE reading_requests SET created_at=? WHERE id=?').run(Date.now()-700000,first.row.id);
    await cleanReadingRequests(f.db);assert.equal(f.sql.prepare('SELECT credits FROM users').get().credits,3);
    f.sql.exec("CREATE TRIGGER fail_usage BEFORE UPDATE ON reading_requests BEGIN SELECT RAISE(ABORT,'usage failure');END");
    await assert.rejects(reserveReading(f.db,usage('rollback','credit'),limits),/usage failure/);
    assert.equal(f.sql.prepare('SELECT credits FROM users').get().credits,3);
    assert.equal(f.sql.prepare("SELECT id FROM reading_requests WHERE id='rollback'").get(),undefined);
  }finally{f.sql.close();}
});
