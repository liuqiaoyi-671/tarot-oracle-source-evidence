// 跨实例持久闸门。失败/崩溃也占用当日计算次数，租约到期可恢复，避免失败重试耗尽业务配额。
export async function acquireJob(db, key, dailyLimit = 2147483647, now = Date.now()) {
  const day = new Date(now).toISOString().slice(0,10);
  const token = crypto.randomUUID();
  return db.prepare(`INSERT INTO maintenance_jobs(k,token,next_run,day,runs) VALUES(?,?,?,?,1)
    ON CONFLICT(k) DO UPDATE SET token=excluded.token,next_run=excluded.next_run,day=excluded.day,
      runs=CASE WHEN maintenance_jobs.day=excluded.day THEN maintenance_jobs.runs+1 ELSE 1 END
    WHERE maintenance_jobs.next_run<=? AND (maintenance_jobs.day<>excluded.day OR maintenance_jobs.runs<?)
    RETURNING token,runs`).bind(key,token,now+120000,day,now,dailyLimit).first();
}

export async function finishJob(db, key, token, intervalMs) {
  await db.prepare('UPDATE maintenance_jobs SET next_run=? WHERE k=? AND token=?')
    .bind(Date.now()+intervalMs,key,token).run();
}
