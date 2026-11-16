import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
function setup(fetch) {
  let checks=0,stops=0;
  const context=vm.createContext({fetch,crypto:webcrypto,TextDecoder,Error,Map,JSON,AbortController,
    setTimeout:callback=>callback(), makeIdleAbort:()=>({signal:new AbortController().signal,bump(){},stop(){stops++;}}),
    localizedError:message=>message,guestId:()=> 'test-guest',t:(_,cn)=>cn,renderAIText:text=>text,
    checkAuth:async()=>{checks++;},refreshOfficialQuota(){}});
  vm.runInContext("let currentUser=null,guestQuota=null;let _historySession={requests:new Map()};"+
    app.slice(app.indexOf('async function streamOfficial('),app.indexOf('// 额度文案')),context);
  const attributes=new Set();
  context.el={innerHTML:'',setAttribute:key=>attributes.add(key),removeAttribute:key=>attributes.delete(key)};
  return {run:()=>vm.runInContext("streamOfficial([{role:'user',content:'test'}],el)",context),attributes,checks:()=>checks,stops:()=>stops};
}
const complete=()=>new Response('data: {"choices":[{"delta":{"content":"回答"}}]}\n\ndata: [DONE]\n\n');
test('前端连接重试和用户重试复用请求 ID；完成后清理状态',async()=>{
  const ids=[];let count=0;
  const f=setup(async(_,init)=>{ids.push(JSON.parse(init.body).request_id);if(++count===1)throw new Error('network');return complete();});
  assert.equal(await f.run(),'回答');assert.equal(await f.run(),'回答');
  assert.equal(new Set(ids).size,1);assert.equal(f.attributes.size,0);assert.equal(f.checks(),2);assert.ok(f.stops()>0);
});
test('服务端退款错误流不会被当成成功回答；下次请求使用新 ID',async()=>{
  const ids=[];let failed=true;
  const f=setup(async(_,init)=>{ids.push(JSON.parse(init.body).request_id);return failed?new Response('event: error\ndata: {"error":"已退款","code":"STREAM_FAILED"}\n\n'):complete();});
  await assert.rejects(f.run(),/已退款/);assert.equal(f.attributes.size,0);failed=false;
  await f.run();assert.notEqual(ids[0],ids[1]);assert.equal(f.checks(),2);
});
test('没有 DONE 的截断流保留请求 ID 以恢复已结算结果',async()=>{
  const ids=[];let failed=true;
  const f=setup(async(_,init)=>{ids.push(JSON.parse(init.body).request_id);return failed?new Response('data: {"choices":[{"delta":{"content":"部分"}}]}\n\n'):complete();});
  await assert.rejects(f.run(),/解读中断/);failed=false;await f.run();assert.equal(ids[0],ids[1]);
});
