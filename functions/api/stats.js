import { getUser, json } from '../../lib/auth.js';
import { acquireJob, finishJob } from '../../lib/maintenance.js';
import { summarizeEvents } from '../../lib/stats-summary.js';

// 单次最多 20,000 条事件；所有日期范围合计每天最多重算 8 次。
const MAX_EVENTS=20000, SNAPSHOT_TTL=3*3600000;

async function authorized(request, env) {
  const key = request.headers.get('x-stats-key') || new URL(request.url).searchParams.get('key') || '';
  if (env.STATS_KEY && key && key === env.STATS_KEY) return true;
  if (env.ADMIN_EMAIL) {
    try { const u = await getUser(request, env); if (u && u.email === env.ADMIN_EMAIL) return true; } catch {}
  }
  return false;
}

export async function onRequestGet({ request, env }) {
  if (!await authorized(request,env)) return json({error:'未授权，请使用管理员账号或统计密钥。'},401);
  const days=Number(new URL(request.url).searchParams.get('days')||'1');
  if(![1,7,30,90].includes(days)) return json({error:'请选择 1、7、30 或 90 天。'},400);
  const DB=env.DB,now=Date.now();
  let snapshot=null,job=null;
  function cached(reason='') {
    const data=JSON.parse(snapshot.payload);
    return json({...data,cache:{status:reason?'stale':'cached',reason,updated_at:snapshot.updated_at,next_refresh_at:snapshot.updated_at+SNAPSHOT_TTL}});
  }
  try {
    snapshot=await DB.prepare('SELECT payload,updated_at FROM stats_snapshots WHERE days=?').bind(days).first();
    if(snapshot && now-snapshot.updated_at<SNAPSHOT_TTL) return cached();
    job=await acquireJob(DB,'stats',8,now);
    if(!job) return snapshot?cached('budget_or_cooldown'):json({error:'看板正在更新或今日计算预算已用完，请稍后查看已有快照。登录与解读优先使用数据库额度。',code:'STATS_BUDGET'},503,{'Retry-After':'900'});
    const {results}=await DB.prepare(`SELECT id,ts,session_id,anon_id,user_id,stage,meta,ref,device,lang
      FROM events INDEXED BY idx_events_ts WHERE ts>=? ORDER BY ts,id LIMIT ?`)
      .bind(now-days*86400000,MAX_EVENTS+1).all();
    if(results.length>MAX_EVENTS) return snapshot?cached('range_too_large'):json({error:'该时间范围的数据过多，请选择更短的时间范围。为保证服务稳定，此次没有生成统计。',code:'STATS_RANGE_TOO_LARGE'},503);
    const data=summarizeEvents(results,days,now);
    await DB.prepare(`INSERT INTO stats_snapshots(days,payload,updated_at) VALUES(?,?,?)
      ON CONFLICT(days) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at`)
      .bind(days,JSON.stringify(data),now).run();
    return json({...data,cache:{status:'fresh',updated_at:now,next_refresh_at:now+SNAPSHOT_TTL}});
  } catch(e) {
    console.error('stats unavailable',e?.message);
    return snapshot?cached('unavailable'):json({error:'统计暂不可用，请稍后重试。',code:'STATS_UNAVAILABLE'},503);
  } finally {
    if(job) {try{await finishJob(DB,'stats',job.token,60000);}catch(e){console.error('stats lease release failed',e?.message);}}
  }
}
