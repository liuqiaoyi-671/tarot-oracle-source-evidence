import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './support/sqlite.mjs';
import { issueEmailCode, consumeEmailCode, rateLimit } from '../lib/security.js';
import { onRequestPost as register } from '../functions/api/register.js';
import { onRequestPost as reset } from '../functions/api/reset-password.js';
import { onRequestDelete as deleteReading } from '../functions/api/readings.js';
import { onRequest as middleware } from '../functions/_middleware.js';
import { sha256hex, verifyPassword } from '../lib/auth.js';

function request(path, body, cookie = '') {
  return new Request('https://local/api/'+path, { method:'POST',
    headers:{'CF-Connecting-IP':'192.0.2.1',cookie},body:JSON.stringify(body) });
}

test('验证码用途隔离、一次性消费、原子发信冷却与错误尝试上限', async () => {
  const f=fixture();
  try {
    const codes=await Promise.all([issueEmailCode(f.db,'test@example.com','verify'),issueEmailCode(f.db,'test@example.com','verify')]);
    assert.equal(codes.filter(Boolean).length,1);const issued=codes.find(Boolean);
    assert.equal(await consumeEmailCode(f.db,'test@example.com',issued.code,'reset'),false);
    const consumed=await Promise.all([consumeEmailCode(f.db,'test@example.com',issued.code,'verify'),consumeEmailCode(f.db,'test@example.com',issued.code,'verify')]);
    assert.deepEqual(consumed.sort(),[false,true]);
    const fresh=await issueEmailCode(f.db,'test@example.com','reset');
    for(let i=0;i<5;i++) await consumeEmailCode(f.db,'test@example.com','wrong','reset');
    assert.equal(await consumeEmailCode(f.db,'test@example.com',fresh.code,'reset'),false);
    const limited=await Promise.all(Array.from({length:10},()=>rateLimit(f.db,'test-limit',3)));
    assert.equal(limited.filter(Boolean).length,3);
    assert.equal(await rateLimit(f.db,'disabled',0),false);
  } finally {f.sql.close();}
});

test('并发注册原子执行 IP 限额；失败注册不创建用户',async()=>{
  const f=fixture();
  try{
    const env={DB:f.db,REG_IP_CAP:'1',REG_GID_CAP:'1'};
    const responses=await Promise.all(['one','two'].map(name=>register({env,request:request('register',{email:name+'@example.com',password:'password123',guest_id:'device'})})));
    assert.deepEqual(responses.map(r=>r.status).sort(),[200,429]);
    assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM users').get().n,2);
    assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM sessions').get().n,1);
  }finally{f.sql.close();}
});

test('重置密码令旧会话失效；同一验证码不能并发重复重置',async()=>{
  const f=fixture();
  try{
    f.sql.prepare('INSERT INTO sessions VALUES(?,?,?)').run(await sha256hex('old'),1,Date.now()+100000);
    const issued=await issueEmailCode(f.db,'test@example.com','reset');
    const responses=await Promise.all([reset({env:{DB:f.db},request:request('reset-password',{email:'test@example.com',code:issued.code,password:'new-password-123'})}),
      reset({env:{DB:f.db},request:request('reset-password',{email:'test@example.com',code:issued.code,password:'other-password-123'})})]);
    assert.deepEqual(responses.map(r=>r.status).sort(),[200,400]);
    assert.equal(f.sql.prepare('SELECT token_hash FROM sessions WHERE token_hash=?').get(await sha256hex('old')),undefined);
    assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM sessions').get().n,1);
    const winningPassword = responses[0].status === 200 ? 'new-password-123' : 'other-password-123';
    const losingPassword = responses[0].status === 200 ? 'other-password-123' : 'new-password-123';
    const storedPassword = f.sql.prepare('SELECT pass FROM users').get().pass;
    assert.equal(await verifyPassword(winningPassword, storedPassword),true);
    assert.equal(await verifyPassword(losingPassword, storedPassword),false);
  }finally{f.sql.close();}
});

test('无效删除 ID 不会清空历史；跨站写入拒绝；私有响应禁止缓存',async()=>{
  const f=fixture();
  try{
    f.sql.prepare('INSERT INTO sessions VALUES(?,?,?)').run(await sha256hex('token'),1,Date.now()+100000);
    f.sql.exec("INSERT INTO readings(user_id,created_at) VALUES(1,0)");
    const response=await deleteReading({env:{DB:f.db},request:new Request('https://local/api/readings?id=wrong',{method:'DELETE',headers:{cookie:'sid=token'}})});
    assert.equal(response.status,400);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM readings').get().n,1);
    const rejected=await middleware({request:new Request('https://local/api/redeem',{method:'POST',headers:{Origin:'https://evil.example'}}),next:()=>{throw new Error('must not run');}});
    assert.equal(rejected.status,403);
    const secured=await middleware({request:new Request('https://local/api/me'),next:async()=>new Response('{}')});
    assert.equal(secured.headers.get('cache-control'),'no-store');assert.equal(secured.headers.get('x-frame-options'),'DENY');
  }finally{f.sql.close();}
});
