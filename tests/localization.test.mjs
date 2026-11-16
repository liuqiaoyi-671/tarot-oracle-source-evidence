import test from 'node:test';
import assert from 'node:assert/strict';
import {codeHtml} from '../lib/mail.js';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
test('verification email supports English and preserves the Chinese default',()=>{
 const english=codeHtml('Verify your email:','123456','en');
 assert.match(english,/123456/);assert.match(english,/10 minutes/);assert.doesNotMatch(english,/[\u3400-\u9fff]/);
 assert.match(codeHtml('验证码','123456'),/10 分钟/);
});
test('localized server errors preserve useful recovery instructions',()=>{
 const source=readFileSync(new URL('../app-localization.js',import.meta.url),'utf8');
 const start=source.indexOf('function localizedError('),end=source.indexOf('// Run after');
 const context=vm.createContext({lang:'en'});vm.runInContext(source.slice(start,end),context);
 assert.match(vm.runInContext("localizedError('邮箱或密码不正确','',401)",context),/email or password/);
 assert.match(vm.runInContext("localizedError('今日注册过于频繁','REG_LIMIT',429)",context),/tomorrow/);
 assert.match(vm.runInContext("localizedError('未知错误','',500)",context),/HTTP 500/);
 vm.runInContext("lang='zh'",context);assert.equal(vm.runInContext("localizedError('邮箱或密码不正确','',401)",context),'邮箱或密码不正确');
});
