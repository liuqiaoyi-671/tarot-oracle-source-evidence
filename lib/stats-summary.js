const STAGES = ['landing','enter_app','spread_select','question_input','shuffle','draw_first','draw_complete','reading_request','reading_done','chat_send'];
const LABELS = ['访问落地','进入应用','选牌阵','输入问题','洗牌','首次抽牌','抽牌完成','请求解读','解读完成','追问'];
const CONVERSIONS = ['support_open','recharge_open','redeem_success','auth_success','save_reading','paywall_shown'];
const missing = value => value === null || value === undefined || value === '' ? '?' : String(value);
function addSet(map,key,value) {
  if(!map.has(key)) map.set(key,new Set());
  map.get(key).add(value);
}
function breakdown(map,limit=Infinity) {
  return [...map].map(([k,v])=>({k,c:v instanceof Set?v.size:v})).sort((a,b)=>b.c-a.c||a.k.localeCompare(b.k)).slice(0,limit);
}

// 事件只读取一次，在内存中复用分组；不存问题、邮箱或解读正文。
export function summarizeEvents(rows,days,generatedAt) {
  const sessions=new Map(),visitors=new Set(),users=new Set(),dwell=new Map(),conv={};
  const device=new Map(),language=new Map(),ref=new Map(),deck=new Map(),spread=new Map(),engine=new Map(),daily=new Map();
  let req=0,done=0,err=0,paywall=0;
  for(const r of rows) {
    let session=sessions.get(r.session_id);
    if(!session) {session={max:-1,flags:new Set(),previous:null};sessions.set(r.session_id,session);}
    visitors.add(r.anon_id);if(r.user_id!==null && r.user_id!==undefined) users.add(r.user_id);
    const i=STAGES.indexOf(r.stage);if(i>session.max) session.max=i;
    let meta={};try{meta=JSON.parse(r.meta)||{};}catch{}
    session.flags.add(r.stage);
    if(r.stage==='auth_success' && meta.mode==='register') session.flags.add('registered');
    if(session.previous) {
      const duration=r.ts-session.previous.ts;
      if(duration>=0 && duration<=1800000) {
        const stage=session.previous.stage,v=dwell.get(stage)||{sum:0,n:0};
        v.sum+=duration;v.n++;dwell.set(stage,v);
      }
    }
    session.previous=r;
    if(r.stage==='landing') {
      addSet(device,missing(r.device),r.session_id);addSet(language,missing(r.lang),r.session_id);
      addSet(ref,r.ref||'(直接访问)',r.session_id);addSet(deck,missing(meta.deck),r.session_id);
      addSet(daily,new Date(r.ts).toISOString().slice(0,10),r.session_id);
    }
    if(r.stage==='draw_complete') {const key=missing(meta.spread);spread.set(key,(spread.get(key)||0)+1);}
    if(r.stage==='reading_request') {const key=missing(meta.engine);engine.set(key,(engine.get(key)||0)+1);req++;}
    if(r.stage==='reading_done') done++;
    if(r.stage==='reading_error') err++;
    if(r.stage==='paywall_shown') paywall++;
    if(CONVERSIONS.includes(r.stage)) conv[r.stage]=(conv[r.stage]||0)+1;
  }
  const histogram=Array(STAGES.length).fill(0);
  let pw=0,pwRc=0,pwRcRd=0,pwReg=0,reg=0,read=0,saved=0;
  for(const s of sessions.values()) {
    if(s.max>=0) histogram[s.max]++;
    const f=s.flags;
    if(f.has('paywall_shown')) {pw++;if(f.has('recharge_open')) {pwRc++;if(f.has('redeem_success')) pwRcRd++;}if(f.has('registered')) pwReg++;}
    if(f.has('registered')) reg++;
    if(f.has('reading_done')) {read++;if(f.has('save_reading')) saved++;}
  }
  const avg=stage=>{const v=dwell.get(stage);return v?Math.round(v.sum/v.n):0;};
  return {
    range_days:days,generated_at:generatedAt,
    overview:{sessions:sessions.size,visitors:visitors.size,logged_in_users:users.size,readings_requested:req,readings_done:done,readings_error:err,readings_paywall:paywall},
    funnel:STAGES.map((stage,i)=>{const reached=histogram.slice(i).reduce((a,b)=>a+b,0);return {stage,label:LABELS[i],reached,exited:histogram[i],pct_of_start:sessions.size?+(reached/sessions.size*100).toFixed(1):0,avg_dwell_ms:avg(stage)};}),
    funnels:{monetization:{paywall_sessions:pw,opened_recharge:pwRc,redeemed:pwRcRd},guest_to_register:{paywall_sessions:pw,registered_after_paywall:pwReg,registered_total:reg},satisfaction:{reading_sessions:read,saved}},
    dwell:STAGES.map((stage,i)=>({stage,label:LABELS[i],avg_ms:avg(stage)})),
    breakdown:{device:breakdown(device),lang:breakdown(language),referrer:breakdown(ref,12),spread:breakdown(spread),engine:breakdown(engine),deck:breakdown(deck)},
    conversions:Object.fromEntries(CONVERSIONS.map(k=>[k,conv[k]||0])),
    daily:[...daily].sort(([a],[b])=>a.localeCompare(b)).map(([d,set])=>({d,c:set.size}))
  };
}
