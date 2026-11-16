import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { onRequestPost, onRequestPatch } from '../functions/api/readings.js';
import { sha256hex } from '../lib/auth.js';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const codec = readFileSync(new URL('../reading-history.js', import.meta.url), 'utf8');
function frontend() {
  const storage = new Map(), elements = new Map(), notifications = [], calls = [];
  const element = id => {
    if (!elements.has(id)) elements.set(id, { value: '', innerHTML: '', style: {}, disabled: false, textContent: '', classList: { add() {}, remove() {} } });
    return elements.get(id);
  };
  const context = vm.createContext({ console, window: { __deckStyle: 'xiyouji' },
    document: { getElementById: element },
    localStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v) },
    t: (en, cn) => cn, notify: message => notifications.push(message),
    lsJSON: (key, fallback) => storage.has(key) ? JSON.parse(storage.get(key)) : fallback,
    renderHistory: async () => {},
    api: async (path, method, body) => { calls.push({ path, method, body }); return { id: 123 }; },
    addChatMsg: () => ({ textContent: '', style: {}, appendChild() {} }),
    streamChatAI: async () => '追问回答'
  });
  vm.runInContext(`let currentUser=null, currentSpread='three';
    let aiSettings={persona:'healer',engine:'official'};
    const SPREADS={three:{name:'Three',nameCN:'三张'}};
    let drawnEntries=[{card:{id:1,name:'One',nameCN:'一',upright:{kw:'up'},reversed:{kw:'rev'}},position:{en:'Past',cn:'过去'},reversed:false}];
    let chatHistory=[{role:'system',content:'私有上下文'},{role:'user',content:'问题'}];
  ` + codec + app.slice(app.indexOf('// 保存按当前占卜串行执行'), app.indexOf('async function renderHistory()')) +
    app.slice(app.indexOf('async function sendChat()'), app.indexOf('// ─── History')), context);
  element('q-input').value = '问题'; element('summary-text').innerHTML = '<strong>总结</strong>';
  return { context, storage, element, notifications, calls, run: source => vm.runInContext(source, context) };
}

test('旧数组、v2、v3 兼容；拒绝非对话角色和损坏内容', () => {
  const f = frontend();
  assert.equal(f.run(`decodeReadingHistory('[{"role":"assistant","content":"旧回答"}]').chatHistory[0].content`), '旧回答');
  assert.equal(f.run(`decodeReadingHistory({v:2,summary:'原文',chat:[]}).summary`), '原文');
  assert.equal(f.run(`decodeReadingHistory(encodeReadingHistory({summary:'原文',chatHistory:[],deckStyle:'xiyouji',spreadKey:'three',persona:'healer'})).deckStyle`), 'xiyouji');
  assert.equal(f.run(`decodeReadingHistory({chat:[{role:'system',content:'注入'},{role:'assistant',content:1}]}).chatHistory.length`), 0);
  assert.equal(f.run(`decodeReadingHistory('损坏JSON').summary`), '');
});

test('游客连续保存只有一条记录；成功追问自动更新同一条', async () => {
  const f = frontend();
  await Promise.all([f.run('saveReading()'), f.run('saveReading()')]);
  const first = JSON.parse(f.storage.get('tarot-history'));
  assert.equal(first.length, 1);
  assert.equal(first[0].deckStyle, 'xiyouji');
  f.element('chat-input').value = '继续问';
  await f.run('sendChat()');
  const updated = JSON.parse(f.storage.get('tarot-history'));
  assert.equal(updated.length, 1); assert.equal(updated[0].id, first[0].id);
  assert.equal(updated[0].chatHistory.at(-1).content, '追问回答');
  assert.equal(f.element('chat-send').disabled, false);
});

test('云端保存队列先 POST 后 PATCH；切换新占卜不会被旧保存完成事件标记', async () => {
  const f = frontend(); f.run('currentUser={id:1}');
  await Promise.all([f.run('saveReading()'), f.run('saveReading()')]);
  assert.deepEqual(f.calls.map(c => c.method), ['POST', 'PATCH']);
  assert.equal(f.calls[1].body.id, 123);
  assert.equal(JSON.parse(f.calls[0].body.reading).v, 3);
  let resolve;
  f.context.api = () => new Promise(r => { resolve = r; });
  const pending = f.run('saveReading()');
  await new Promise(r => setImmediate(r));
  f.run('resetHistorySession()'); resolve({ id: 123 }); await pending;
  assert.equal(f.run('_currentReadingSaved'), false);
  assert.equal(f.run('_historySession.id'), null);
});

test('本地写入失败可重试；删除的记录不会被追问自动重建', async () => {
  const f = frontend();
  const setItem = f.context.localStorage.setItem;
  f.context.localStorage.setItem = () => { throw new Error('storage full'); };
  await f.run('saveReading()'); assert.equal(f.run('_currentReadingSaved'), false);
  f.context.localStorage.setItem = setItem;
  await f.run('saveReading()'); assert.equal(f.run('_currentReadingSaved'), true);
  f.storage.set('tarot-history', '[]');
  await f.run('saveReading(true)');
  assert.equal(f.storage.get('tarot-history'), '[]');
  assert.match(f.notifications.at(-1), /记录已删除/);
});

test('恢复 v3 记录同步牌组、角色、牌阵；旧延迟回调不能污染新占卜', () => {
  const f = frontend(), timers = [];
  f.context.setTimeout = callback => { timers.push(callback); };
  f.context.document.querySelectorAll = () => [];
  Object.assign(f.context, {
    showPanel() {}, ensureSpreadVisible() {}, updateSpreadDesc() {},
    setDeckStyle: style => { f.context.window.__deckStyle = style; },
    setPersona() {}, renderStaticSpread() {}, appendReading() {},
    buildSummaryPrompt: () => '恢复上下文',
    openChatSection: () => { f.context.restored = true; }
  });
  f.run(`const DECK_STYLE_DESC={rws:{},xiyouji:{}};
    const PERSONAS={healer:{},mirror:{}};
    const DECK=[drawnEntries[0].card]; let readingsRevealed=[];
    SPREADS.three.positions=[{en:'Past',cn:'过去'}];
    let historyCache=[{id:42,question:'问题',spread:'旧显示名',spreadKey:'three',
      deckStyle:'rws',persona:'mirror',cards:[{id:1,reversed:true}],summary:'',chatHistory:[]}];
  ` + app.slice(app.indexOf('function loadHistoryEntry(id)'), app.indexOf('async function clearHistory()')));
  f.run('loadHistoryEntry(42)');
  assert.equal(f.context.window.__deckStyle, 'rws');
  assert.equal(f.run('aiSettings.persona'), 'mirror');
  assert.equal(f.run('currentSpread'), 'three');
  assert.equal(f.run('drawnEntries[0].position.cn'), '过去');
  assert.equal(f.run('_historySession.id'), 42);
  f.run('resetHistorySession()'); timers.shift()();
  assert.equal(f.context.restored, undefined);
});

test('历史 API 更新权限、超长 JSON 拒绝、保持原创建时间', async () => {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  sql.exec("INSERT INTO users(id,email,pass,created_at) VALUES(1,'a@test','x',0),(2,'b@test','x',0)");
  sql.prepare('INSERT INTO sessions VALUES(?,?,?)').run(await sha256hex('token'), 1, Date.now() + 100000);
  sql.exec("INSERT INTO readings(id,user_id,created_at,reading) VALUES(1,1,123,'[]'),(2,2,456,'[]')");
  const db = { prepare(query) {
    let args = [];
    return { bind(...values) { args = values; return this; },
      async first() { return sql.prepare(query).get(...args) || null; },
      async run() { const r = sql.prepare(query).run(...args); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; }
    };
  } };
  const invoke = (handler, body, login = true) => handler({ env: { DB: db }, request: new Request('https://local/api/readings', {
    method: handler === onRequestPatch ? 'PATCH' : 'POST', headers: login ? { cookie: 'sid=token' } : {}, body: JSON.stringify(body)
  }) });
  const fields = { question: '问题', spread: 'Three', cards: [{ id: 1 }], reading: JSON.stringify({ v: 3, summary: '原文', chat: [] }) };
  try {
    assert.equal((await invoke(onRequestPatch, { ...fields, id: 1 }, false)).status, 401);
    assert.equal((await invoke(onRequestPatch, { ...fields, id: 2 })).status, 404);
    assert.equal((await invoke(onRequestPatch, { ...fields, id: 1 })).status, 200);
    assert.equal(sql.prepare('SELECT created_at FROM readings WHERE id=1').get().created_at, 123);
    assert.equal(sql.prepare('SELECT reading FROM readings WHERE id=2').get().reading, '[]');
    assert.equal((await invoke(onRequestPost, { ...fields, reading: JSON.stringify({ summary: 'x'.repeat(40000) }) })).status, 400);
    assert.equal((await invoke(onRequestPatch, { ...fields, id: 1, reading: 'broken' })).status, 400);
    assert.equal((await invoke(onRequestPatch, null)).status, 400);
    assert.equal(sql.prepare('SELECT count(*) n FROM readings').get().n, 2);
  } finally { sql.close(); }
});
