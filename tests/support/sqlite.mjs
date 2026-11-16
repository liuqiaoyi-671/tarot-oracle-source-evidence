import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
// 用真实 SQLite 执行生产 SQL；batch 模拟 D1 的事务与回滚契约。
export function fixture() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../../schema.sql', import.meta.url), 'utf8'));
  sql.exec("INSERT INTO users(id,email,pass,created_at,credits) VALUES(1,'test@example.com','test',0,3)");
  const db = {
    prepare(query) {
      let args = [];
      return {
        bind(...values) { args = values; return this; },
        async first() { return sql.prepare(query).get(...args) || null; },
        async all() { return { results: sql.prepare(query).all(...args) }; },
        async run() {
          const r = sql.prepare(query).run(...args);
          return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
        },
        // batch 执行不能在 await 之间让出事务。
        execute() {
          const r = sql.prepare(query).run(...args);
          return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
        }
      };
    },
    async batch(statements) {
      sql.exec('BEGIN IMMEDIATE');
      try {
        const results = statements.map(s => s.execute());
        sql.exec('COMMIT');
        return results;
      } catch (error) { sql.exec('ROLLBACK'); throw error; }
    }
  };
  return { sql, db };
}
