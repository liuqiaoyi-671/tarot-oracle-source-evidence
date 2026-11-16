import { acquireJob, finishJob } from './maintenance.js';

// 请求账本与额度预占必须放在同一个 D1 batch 事务中。
export async function reserveReading(db, r, limits) {
  const exists = "EXISTS (SELECT 1 FROM reading_requests WHERE id=? AND status='pending')";
  const statements = [db.prepare(`INSERT OR IGNORE INTO reading_requests
    (id,owner,payload_hash,status,pay_mode,cost,quota_key,ip_key,user_id,created_at)
    VALUES (?,?,?,'pending',?,?,?,?,?,?)`)
    .bind(r.id, r.owner, r.hash, r.mode, r.cost, r.key, r.ipKey || '', r.userId ?? null, Date.now())];
  if (r.mode.startsWith('guest')) {
    const column = r.kind === 'chat' ? 'chat' : 'summ';
    const cap = r.kind === 'chat' ? limits.chat : limits.free;
    const ipCap = r.kind === 'chat' ? limits.ipChat : limits.ipFree;
    const ipAvailable = `COALESCE((SELECT ${column} FROM guest_quota WHERE k=?),0) < ?`;
    if (r.kind === 'summary') {
      statements.push(db.prepare(`INSERT INTO guest_quota (k,summ,chat)
        SELECT ?,1,0 WHERE ? > 0 AND ${exists} AND ${ipAvailable}
        ON CONFLICT(k) DO UPDATE SET summ=summ+1 WHERE summ < ? RETURNING summ,chat`)
        .bind(r.key, cap, r.id, r.ipKey, ipCap, cap));
    } else {
      statements.push(db.prepare(`UPDATE guest_quota SET chat=chat+1
        WHERE k=? AND summ>0 AND chat<? AND ${exists} AND ${ipAvailable} RETURNING summ,chat`)
        .bind(r.key, cap, r.id, r.ipKey, ipCap));
    }
    statements.push(db.prepare(`INSERT INTO guest_quota (k,summ,chat)
      SELECT ?,?,? WHERE changes()>0
      ON CONFLICT(k) DO UPDATE SET ${column}=${column}+1`)
      .bind(r.ipKey, r.kind === 'summary' ? 1 : 0, r.kind === 'chat' ? 1 : 0));
  } else if (r.mode.startsWith('member')) {
    statements.push(db.prepare(`INSERT INTO member_daily (k,count)
      SELECT ?,? WHERE ?<=? AND ${exists}
      ON CONFLICT(k) DO UPDATE SET count=count+? WHERE count+?<=?`)
      .bind(r.key, r.cost, r.cost, limits.member, r.id, r.cost, r.cost, limits.member));
  } else if (r.mode === 'free') {
    statements.push(db.prepare(`UPDATE users SET free_used=free_used+1
      WHERE id=? AND free_used<? AND ${exists}`).bind(r.userId, limits.free, r.id));
  } else {
    statements.push(db.prepare(`UPDATE users SET credits=credits-?
      WHERE id=? AND credits>=? AND ${exists}`).bind(r.cost, r.userId, r.cost, r.id));
  }
  statements.push(db.prepare(`UPDATE reading_requests SET status=CASE WHEN changes()>0 THEN 'reserved' ELSE 'denied' END
    WHERE id=? AND status='pending'`).bind(r.id));
  const results = await db.batch(statements);
  const row = await db.prepare('SELECT * FROM reading_requests WHERE id=?').bind(r.id).first();
  return { row, fresh: results[0].meta.changes > 0 };
}

export async function refundReading(db, r) {
  const refundable = "EXISTS (SELECT 1 FROM reading_requests WHERE id=? AND status='failed' AND refunded=0)";
  const statements = [db.prepare("UPDATE reading_requests SET status='failed' WHERE id=? AND status='reserved'").bind(r.id)];
  if (r.pay_mode.startsWith('guest')) {
    const column = r.pay_mode === 'guest-chat' ? 'chat' : 'summ';
    for (const key of [r.quota_key, r.ip_key]) statements.push(db.prepare(
      `UPDATE guest_quota SET ${column}=MAX(0,${column}-1) WHERE k=? AND ${refundable}`).bind(key, r.id));
  } else if (r.pay_mode.startsWith('member')) {
    statements.push(db.prepare(`UPDATE member_daily SET count=MAX(0,count-?) WHERE k=? AND ${refundable}`)
      .bind(r.cost, r.quota_key, r.id));
  } else if (r.pay_mode === 'free') {
    statements.push(db.prepare(`UPDATE users SET free_used=MAX(0,free_used-1) WHERE id=? AND ${refundable}`).bind(r.user_id, r.id));
  } else {
    statements.push(db.prepare(`UPDATE users SET credits=credits+? WHERE id=? AND ${refundable}`).bind(r.cost, r.user_id, r.id));
  }
  statements.push(db.prepare("UPDATE reading_requests SET refunded=1 WHERE id=? AND status='failed' AND refunded=0").bind(r.id));
  await db.batch(statements);
}

export async function finishReading(db, r, text, status = 'complete') {
  await db.prepare("UPDATE reading_requests SET status=?,output_text=? WHERE id=? AND status='reserved'")
    .bind(status, text.slice(0, 50000), r.id).run();
}

export async function cleanReadingRequests(db) {
  const job=await acquireJob(db,'reading_cleanup');
  if(!job) return;
  try {
    const { results }=await db.prepare("SELECT * FROM reading_requests INDEXED BY idx_reading_reserved_created WHERE status='reserved' AND created_at<? ORDER BY created_at LIMIT 20")
      .bind(Date.now()-600000).all();
    for(const row of results||[]) await refundReading(db,row);
    await db.prepare(`UPDATE reading_requests SET output_text='' WHERE id IN (
      SELECT id FROM reading_requests INDEXED BY idx_reading_output_created
      WHERE output_text<>'' AND created_at<? ORDER BY created_at LIMIT 50)`)
      .bind(Date.now()-86400000).run();
    await db.prepare(`DELETE FROM reading_requests WHERE id IN (
      SELECT id FROM reading_requests INDEXED BY idx_reading_finished_created WHERE created_at<? AND status<>'reserved' ORDER BY created_at LIMIT 50)`)
      .bind(Date.now()-30*86400000).run();
  } finally {
    await finishJob(db,'reading_cleanup',job.token,60000);
  }
}
