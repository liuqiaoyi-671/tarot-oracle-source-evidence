import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './support/sqlite.mjs';
import { onRequestGet as stats } from '../functions/api/stats.js';

test('统计口径保留会话去重、最深漏斗、停留上限、来源与交叉转化',async()=>{
  const f=fixture();try{
    const now=Date.now()-100000;
    const add=f.sql.prepare('INSERT INTO events(ts,recv_ts,session_id,anon_id,user_id,stage,meta,ref,device,lang) VALUES(?,?,?,?,?,?,?,?,?,?)');
    const events=[['landing',{deck:'rws'}],['reading_request',{engine:'official'}],['reading_done',{}],['save_reading',{}],['paywall_shown',{}],['recharge_open',{}],['redeem_success',{}],['auth_success',{mode:'register'}],['draw_complete',{spread:'single'}]];
    events.forEach(([stage,meta],i)=>add.run(now+i*1000,now,'s1','a1',1,stage,JSON.stringify(meta),'example.com','mobile','zh'));
    add.run(now,now,'s2','a1',null,'landing','{}','','desktop','en');
    add.run(now+1800001,now,'s2','a1',null,'exit',null,'','desktop','en');
    const r=await stats({request:new Request('https://local/api/stats?days=7',{headers:{'x-stats-key':'k'}}),env:{DB:f.db,STATS_KEY:'k'}});
    assert.equal(r.status,200);const d=await r.json();
    assert.deepEqual(d.overview,{sessions:2,visitors:1,logged_in_users:1,readings_requested:1,readings_done:1,readings_error:0,readings_paywall:1});
    assert.equal(d.funnel[0].reached,2);assert.equal(d.funnel.find(s=>s.stage==='reading_done').reached,1);
    assert.equal(d.funnel.find(s=>s.stage==='reading_done').exited,1);
    assert.equal(d.dwell.find(s=>s.stage==='landing').avg_ms,1000);
    assert.deepEqual(d.funnels.monetization,{paywall_sessions:1,opened_recharge:1,redeemed:1});
    assert.deepEqual(d.funnels.guest_to_register,{paywall_sessions:1,registered_after_paywall:1,registered_total:1});
    assert.deepEqual(d.funnels.satisfaction,{reading_sessions:1,saved:1});
    assert.equal(d.breakdown.engine[0].k,'official');assert.equal(d.breakdown.spread[0].k,'single');
    assert.equal(d.daily.reduce((sum,r)=>sum+r.c,0),2);
  }finally{f.sql.close();}
});
