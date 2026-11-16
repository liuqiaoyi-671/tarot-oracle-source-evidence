import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
function settingsContext(settings) {
  const context = vm.createContext({ URL, t: (_, zh) => zh });
  vm.runInContext(`let aiSettings = ${JSON.stringify(settings)};` +
    app.slice(app.indexOf('const PROVIDER_MODELS'), app.indexOf('// Resolve the Claude')), context);
  return context;
}
test('Gemini 旧设置在请求前迁移到可用模型；自定义中转不受影响', () => {
  for (const model of ['gemini-2.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp', '']) {
    const ctx = settingsContext({ engine: 'gemini', model });
    assert.equal(vm.runInContext('resolveEndpoint().model', ctx), 'gemini-3.8-flash');
  }
  const ctx = settingsContext({engine: 'custom', customModel: 'gemini-2.5-flash', apiUrl: 'https://relay.example/v1/chat/completions'});
  assert.equal(vm.runInContext('resolveEndpoint().model', ctx), 'gemini-2.5-flash');
});
test('智谱初次解读和追问使用同源转发地址', () => {
  const ctx = settingsContext({engine: 'zhipu', model: 'glm-4-flash'});
  assert.equal(vm.runInContext('resolveEndpoint().url', ctx), '/api/zhipu');
});
test('当前模型清单含新版本，移除已退役 Claude 和 DeepSeek 名称', () => {
  const ctx = settingsContext({engine:'deepseek',model:'deepseek-reasoner'});
  assert.equal(vm.runInContext('resolveEndpoint().model', ctx), 'deepseek-flash');
  assert.equal(vm.runInContext("openAICompatOptions('deepseek-flash').thinking.type", ctx), 'enabled');
  vm.runInContext("aiSettings.model='deepseek-chat'", ctx);
  assert.equal(vm.runInContext("openAICompatOptions(resolveEndpoint().model).thinking.type", ctx), 'disabled');
  for (const [engine, model] of Object.entries({claude:'claude-sonnet-5-5',openai:'gpt-6-luna',qwen:'qwen3.7-plus',zhipu:'glm-5.3-flash',doubao:'doubao-seed-2-1-pro-260915'})) {
    assert.ok(vm.runInContext(`PROVIDER_MODELS.${engine}.some(m=>m.id===${JSON.stringify(model)})`,ctx));
  }
  assert.equal(vm.runInContext("PROVIDER_MODELS.claude.some(m=>m.id==='claude-3-5-haiku-20241022')",ctx),false);
});
const origin = 'https://www.tarot-oracle-from-joy.top';
function request(body, headers = {}) {
  return new Request(origin + '/api/zhipu', {method: 'POST', headers: {
    Origin: origin, 'Content-Type': 'application/json', Authorization: 'Bearer test-user-key', ...headers
  }, body: JSON.stringify(body)});
}
const body = {model: 'glm-4-flash', stream: true, messages: [{role: 'user', content: 'test'}]};
test('智谱转发只访问固定官方地址，不转发 Cookie，保留流和上游状态', async () => {
  const {onRequestPost} = await import('../functions/api/zhipu.js');
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(url, 'https://open.bigmodel.cn/api/paas/v4/chat/completions');
      const headers = new Headers(init.headers);
      assert.equal(headers.get('Authorization'), 'Bearer test-user-key');
      assert.equal(headers.get('Cookie'), null);
      assert.equal(init.redirect, 'error');
      assert.equal(JSON.parse(init.body).stream, true);
      assert.equal(JSON.parse(init.body).url, undefined);
      return new Response('data: test\n\n', {status: 200, headers: {'Content-Type': 'text/event-stream', 'Set-Cookie': 'secret'}});
    };
    const res = await onRequestPost({request: request({...body, url:'https://untrusted.example'}, {Cookie:'sid=test'})});
    assert.equal(res.status, 200);
    assert.equal(await res.text(), 'data: test\n\n');
    assert.equal(res.headers.get('Set-Cookie'), null);
    assert.equal(res.headers.get('Cache-Control'), 'no-store');
    globalThis.fetch = async () => new Response('{"error":"invalid key"}', {status: 401});
    assert.equal((await onRequestPost({request: request(body)})).status, 401);
    globalThis.fetch = async () => {throw new Error('secret upstream detail');};
    const failed = await onRequestPost({request: request(body)});
    assert.equal(failed.status, 502);
    assert.doesNotMatch(await failed.text(), /secret upstream detail|test-user-key/);
  } finally {globalThis.fetch = original;}
});
test('智谱转发拒绝跨域、缺少密钥、非法模型和超大请求', async () => {
  const {onRequestPost} = await import('../functions/api/zhipu.js');
  assert.equal((await onRequestPost({request: request(body, {Origin:'https://other.example'})})).status, 403);
  assert.equal((await onRequestPost({request: request(body, {Authorization:''})})).status, 401);
  assert.equal((await onRequestPost({request: request({...body, model:'other-model'})})).status, 400);
  assert.equal((await onRequestPost({request: request({...body, messages:[{role:'user',content:'x'.repeat(200001)}]})})).status, 413);
});
