import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './support/sqlite.mjs';
import { onRequestGet as stats } from '../functions/api/stats.js';
import { cleanReadingRequests } from '../lib/reading-billing.js';
import { acquireJob, finishJob } from '../lib/maintenance.js';
import { readFileSync } from 'node:fs';
import { onRequestGet as me } from '../functions/api/me.js';
import { sha256hex } from '../lib/auth.js';

const request = (days=1, key='test-key') => new Request('https://local/api/stats?days='+days,{headers:{'x-stats-key':key}});
function instrument(f) {
  const reads=[];
  return { reads, db:{...f.db,prepare(sql){reads.push(sql);return f.db.prepare(sql);}} };
}
function seed(f, count=1) {
  const stmt=f.sql.prepare('INSERT INTO events(ts,recv_ts,session_id,anon_id,stage,meta,device,lang) VALUES(?,?,?,?,?,?,?,?)');
  for(let i=0;i<count;i++) stmt.run(Date.now()-10000+i,Date.now(),'s'+i,'a'+i,'landing','{"deck":"rws"}','mobile','zh');
}

test('统计每次只读一次事件；后续请求使用持久快照，未授权不能读快照',async()=>{
  const f=fixture();try{
    seed(f);const observed=instrument(f),env={DB:observed.db,STATS_KEY:'test-key'};
    const first=await stats({request:request(),env});assert.equal(first.status,200);
    assert.equal((await first.json()).overview.sessions,1);
    const eventReads=()=>observed.reads.filter(q=>/FROM events\b/.test(q)).length;
    assert.equal(eventReads(),1,'one bounded event scan per rebuild');
    seed(f,2);
    const cached=await stats({request:request(),env:{...env,DB:instrument(f).db}});
    const body=await cached.json();assert.equal(body.overview.sessions,1);assert.equal(body.cache.status,'cached');
    assert.equal((await stats({request:request(1,'wrong'),env})).status,401);
    assert.equal(eventReads(),1);
  }finally{f.sql.close();}
});

test('看板超过单次事件上限时拒绝生成，绝不返回截断统计',async()=>{
  const f=fixture();try{
    seed(f,20001);const r=await stats({request:request(),env:{DB:f.db,STATS_KEY:'test-key'}});
    assert.equal(r.status,503);assert.equal((await r.json()).code,'STATS_RANGE_TOO_LARGE');
    assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM stats_snapshots').get().n,0);
  }finally{f.sql.close();}
});

test('跨请求并发只有一个重算；每日预算耗尽返回旧快照而不扫描事件',async()=>{
  const f=fixture();try{
    seed(f);const observed=instrument(f),env={DB:observed.db,STATS_KEY:'test-key'};
    const responses=await Promise.all([stats({request:request(),env}),stats({request:request(),env})]);
    assert.ok(responses.some(r=>r.status===200));
    assert.equal(observed.reads.filter(q=>/FROM events\b/.test(q)).length,1);
    f.sql.exec("UPDATE stats_snapshots SET updated_at=0; UPDATE maintenance_jobs SET runs=8,next_run=0 WHERE k='stats'");
    observed.reads.length=0;
    const r=await stats({request:request(),env});assert.equal(r.status,200);
    const body=await r.json();assert.equal(body.cache.status,'stale');assert.equal(body.cache.reason,'budget_or_cooldown');
    assert.equal(observed.reads.filter(q=>/FROM events\b/.test(q)).length,0);
    assert.equal((await stats({request:request(7),env})).status,503);
  }finally{f.sql.close();}
});

test('反复解读不会重复清理历史请求；补偿和正文清理均有批次上限',async()=>{
  const f=fixture();try{
    const add=f.sql.prepare("INSERT INTO reading_requests(id,owner,payload_hash,status,pay_mode,cost,quota_key,created_at,output_text) VALUES(?,'user:1','h','complete','credit',1,'k',?,'old')");
    for(let i=0;i<120;i++) add.run('old'+i,Date.now()-2*86400000);
    const observed=instrument(f);
    await Promise.all([cleanReadingRequests(observed.db),cleanReadingRequests(observed.db)]);
    assert.equal(f.sql.prepare("SELECT COUNT(*) n FROM reading_requests WHERE output_text=''").get().n,50);
    observed.reads.length=0;await cleanReadingRequests(observed.db);
    assert.equal(observed.reads.filter(q=>/FROM reading_requests|UPDATE reading_requests/.test(q)).length,0);
  }finally{f.sql.close();}
});

test('持久租约拒绝旧持有者释放，UTC 新一天恢复预算，迁移可重复执行',async()=>{
  const f=fixture();try{
    const migration=readFileSync(new URL('../migrations/0005_query_budget.sql',import.meta.url),'utf8');
    f.sql.exec(migration);f.sql.exec(migration);
    const now=Date.now(),a=await acquireJob(f.db,'test',1,now);
    assert.ok(a);assert.equal(await acquireJob(f.db,'test',1,now+120001),null);
    const b=await acquireJob(f.db,'test',1,now+86400000);assert.ok(b);
    await finishJob(f.db,'test',a.token,0);
    assert.equal(f.sql.prepare("SELECT token FROM maintenance_jobs WHERE k='test'").get().token,b.token);
    assert.equal(await acquireJob(f.db,'test',1,now+86400001),null);
  }finally{f.sql.close();}
});

test('统计、过期清理与首单查询使用有界范围索引',()=>{
  const f=fixture();try{
    const plan=sql=>f.sql.prepare('EXPLAIN QUERY PLAN '+sql).all().map(r=>r.detail).join('\n');
    assert.match(plan('SELECT id,ts,stage FROM events INDEXED BY idx_events_ts WHERE ts>=100 ORDER BY ts,id LIMIT 20001'),/SEARCH events USING INDEX idx_events_ts/);
    assert.match(plan("SELECT id FROM reading_requests INDEXED BY idx_reading_reserved_created WHERE status='reserved' AND created_at<100 ORDER BY created_at LIMIT 20"),/SEARCH reading_requests USING INDEX idx_reading_reserved_created/);
    assert.match(plan("SELECT id FROM reading_requests INDEXED BY idx_reading_output_created WHERE output_text<>'' AND created_at<100 ORDER BY created_at LIMIT 50"),/SEARCH reading_requests USING INDEX idx_reading_output_created/);
    assert.match(plan("SELECT id FROM reading_requests INDEXED BY idx_reading_finished_created WHERE status<>'reserved' AND created_at<100 ORDER BY created_at LIMIT 50"),/SEARCH reading_requests USING INDEX idx_reading_finished_created/);
    assert.match(plan("SELECT EXISTS(SELECT 1 FROM redeem_codes WHERE used_by=1 AND batch LIKE 'first%')"),/SEARCH redeem_codes USING COVERING INDEX idx_redeem_user_batch/);
  }finally{f.sql.close();}
});

test('首单存在性优化保留账号显示的已兑换状态',async()=>{
  const f=fixture();try{
    f.sql.prepare('INSERT INTO sessions VALUES(?,?,?)').run(await sha256hex('token'),1,Date.now()+600000);
    const call=()=>me({env:{DB:f.db},request:new Request('https://local/api/me',{headers:{cookie:'sid=token'}})});
    assert.equal((await(await call()).json()).first_order_used,false);
    f.sql.exec("INSERT INTO redeem_codes(code_hash,batch,created_at,used_by) VALUES('a','first-test',0,1)");
    assert.equal((await(await call()).json()).first_order_used,true);
  }finally{f.sql.close();}
});
