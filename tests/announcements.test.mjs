import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {existsSync,readFileSync} from 'node:fs';

test('公告静态双语文稿保留已确认的补偿、预计恢复时间和逐字正文',()=>{
 const path=new URL('../notices-data.js',import.meta.url);
 assert.ok(existsSync(path),'公告文稿尚未实现');
 const context=vm.createContext({window:{}});vm.runInContext(readFileSync(path,'utf8'),context);
 const notices=context.window.TAROT_NOTICES;assert.ok(Array.isArray(notices));assert.ok(notices.length);
 const incident=notices.find(n=>n.date==='2026-10-16');assert.ok(incident);assert.ok(incident.id);assert.ok(incident.revision);
 assert.equal(incident.title.zh,'服务异常与补偿说明');assert.ok(incident.title.en);
 assert.deepEqual(Array.from(incident.paragraphs.zh),[
  '今天部分用户遇到了登录和官方解读异常，给大家带来了不便。',
  '我们已为北京时间 10 月 16 日 22:26:10 前注册的邮箱账号，每人补偿 3 次解读额度，已自动到账，无需申请。',
  '预计将在北京时间 10 月 17 日 8:00 恢复正常。当前异常仍在处理中，恢复情况会在这里同步更新。'
 ]);
 assert.equal(incident.paragraphs.en.length,3);
 assert.match(incident.paragraphs.en.join(' '),/October 17/);assert.match(incident.paragraphs.en.join(' '),/08:00/);
});
