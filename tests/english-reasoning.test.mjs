import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './support/sqlite.mjs';
import { onRequestPost as reading, ENGLISH_READING_STYLE } from '../functions/api/reading.js';
import { sha256hex } from '../lib/auth.js';
const stream=()=>new Response('data: {"choices":[{"delta":{"reasoning_content":"consider"}}]}\n\ndata: {"choices":[{"delta":{"content":"The cards suggest a practical next step."}}]}\n\ndata: [DONE]\n\n');
async function setup(){
 const f=fixture(),saved=globalThis.fetch,bodies=[];
 f.sql.prepare('INSERT INTO sessions VALUES(?,?,?)').run(await sha256hex('english-test'),1,Date.now()+100000);
 globalThis.fetch=async(_,init)=>{bodies.push(JSON.parse(init.body));return stream();};
 const env={DB:f.db,DEEPSEEK_API_KEY:'test',FREE_CAP_UNVERIFIED:'1'};
 const run=async(body={},signedIn=true)=>{
  const response=await reading({env,request:new Request('https://local/api/reading',{method:'POST',headers:signedIn?{cookie:'sid=english-test'}:{},body:JSON.stringify({request_id:crypto.randomUUID(),messages:[{role:'user',content:'What could I consider next?'}],language:'en',guest_id:'english-test-guest',...body})})});
  const text=await response.text();return {response,text};
 };
 return {...f,bodies,run,close(){globalThis.fetch=saved;f.sql.close();}};
}
test('English reasoning includes free, paid and member allowances without the two-credit surcharge',async()=>{
 const f=await setup();try{
  let r=await f.run({deep:true});assert.equal(r.response.status,200);assert.equal(r.response.headers.get('x-pay-mode'),'free');
  assert.equal(f.bodies[0].model,'deepseek-flash');assert.equal(f.bodies[0].thinking.type,'enabled');assert.equal(f.bodies[0].max_tokens,8192);assert.equal(f.bodies[0].messages[0].content,ENGLISH_READING_STYLE);assert.match(ENGLISH_READING_STYLE,/not about unverified personal facts/);assert.match(ENGLISH_READING_STYLE,/Do not invent counts/);
  assert.equal(f.sql.prepare('SELECT free_used FROM users').get().free_used,1);
  r=await f.run();assert.equal(r.response.headers.get('x-pay-mode'),'credit');assert.equal(f.sql.prepare('SELECT credits FROM users').get().credits,2);
  f.sql.prepare('UPDATE users SET membership=?').run(String(Date.now()+86400000));
  f.sql.prepare('INSERT INTO member_daily(k,count) VALUES(?,19)').run('1|'+new Date().toISOString().slice(0,10));
  r=await f.run();assert.equal(r.response.status,200);assert.equal(r.response.headers.get('x-pay-mode'),'member');
  assert.equal((await f.run()).response.status,429);
 }finally{f.close();}
});
test('English guests and follow-ups use reasoning; retries replay without an extra upstream call',async()=>{
 const f=await setup();try{
  const request_id=crypto.randomUUID();assert.equal((await f.run({request_id},false)).response.status,200);
  assert.equal((await f.run({request_id},false)).response.headers.get('x-reading-replayed'),'1');assert.equal(f.bodies.length,1);
  assert.equal((await f.run({kind:'chat'},false)).response.status,200);assert.equal(f.bodies[1].model,'deepseek-flash');
  assert.equal((await f.run({kind:'chat'},false)).response.status,402);
  assert.equal((await f.run({request_id,language:'zh'},false)).response.status,409);
 }finally{f.close();}
});
test('Chinese standard and opt-in deep readings retain their model and billing rules',async()=>{
 const f=await setup();try{
  await f.run({language:'zh'});assert.equal(f.bodies[0].model,'deepseek-flash');assert.equal(f.bodies[0].thinking.type,'disabled');
  const r=await f.run({language:'zh',deep:true});assert.equal(f.bodies[1].model,'deepseek-flash');assert.equal(f.bodies[1].thinking.type,'enabled');assert.equal(r.response.headers.get('x-pay-mode'),'credit-deep');
  assert.equal(f.sql.prepare('SELECT credits FROM users').get().credits,1);
 }finally{f.close();}
});

test('Legacy server model variables migrate while retaining standard and reasoning modes',async()=>{
 const f=fixture(),saved=globalThis.fetch,bodies=[];try{
  globalThis.fetch=async(_,init)=>{bodies.push(JSON.parse(init.body));return stream();};
  const env={DB:f.db,DEEPSEEK_API_KEY:'test',DEEPSEEK_MODEL:'deepseek-chat',DEEPSEEK_DEEP_MODEL:'deepseek-reasoner'};
  for(const language of ['zh','en']){
   const res=await reading({env,request:new Request('https://local/api/reading',{method:'POST',body:JSON.stringify({request_id:crypto.randomUUID(),guest_id:'legacy-model-'+language,messages:[{role:'user',content:'test'}],language})})});
   assert.equal(res.status,200);await res.text();
  }
  assert.equal(bodies[0].model,'deepseek-flash');assert.equal(bodies[0].thinking.type,'disabled');
  assert.equal(bodies[1].model,'deepseek-flash');assert.equal(bodies[1].thinking.type,'enabled');
 }finally{globalThis.fetch=saved;f.sql.close();}
});
