import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
function setup(){
 const c=vm.createContext({window:{__deckStyle:'rws'},document:{getElementById:()=>({value:''})}});
 for(const file of ['waite.js','waite_cn.js','cards.js','xyj_lore.js','modern-card-notes.js']) vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),c);
 vm.runInContext(`let lang='zh',aiSettings={persona:'philosopher'},drawnEntries=[];const t=(en,zh)=>lang==='zh'?zh:en;`+
  app.slice(app.indexOf('const PERSONAS ='),app.indexOf('// ─── Spread definitions'))+
  app.slice(app.indexOf('// 只补充已核对条目'),app.indexOf('// ─── AI streaming')),c);
 return {c,run:s=>vm.runInContext(s,c)};
}
test('四个角色、证据规则、已核对资料和问题应用进入实际提示词；重绘不虚构画面',()=>{
 const f=setup();
 f.run("drawnEntries=[{card:DECK[51],position:{en:'Situation',cn:'现状'},reversed:false}]");
 const prompt=f.run("buildSummaryPrompt('他会联系我吗？',{name:'Single',nameCN:'单牌'})");
 assert.match(prompt,/你是策士/);assert.match(prompt,/期待、情绪/);assert.match(prompt,/Waite原书/);assert.match(prompt,/Tina Gong/);
 f.run("window.__deckStyle='marseille'");
 const alternate=f.run("buildSummaryPrompt('他会联系我吗？',{name:'Single',nameCN:'单牌'})");
 assert.match(alternate,/不是当前重绘/);assert.doesNotMatch(alternate,/已核对补充/);assert.doesNotMatch(alternate,/\n  画面：/);
 assert.equal(f.run('Object.keys(PERSONAS).length'),4);
 for(const key of ['mirror','astrologer','healer','philosopher']) assert.ok(f.run(`PERSONAS.${key}.descEN`));
});
test('追问带首次回答且明确禁止迎合、重复牌义和虚构新抽牌',()=>{
 const f=setup();const messages=f.run("initialReadingMessages('规则','首次解读原文')");
 assert.equal(messages[1].role,'assistant');assert.equal(messages[1].content,'首次解读原文');
 assert.match(f.run('followupReadingRules(true)'),/不得虚构新抽牌/);
 assert.match(f.run('followupReadingRules(true)'),/期待或反驳/);
});
test('大牌只按问题领域加入参考；十张大牌提示词仍符合接口长度限制',()=>{
 const f=setup();
 const notes=f.run("contextualCardNotes(WAITE_LORE[0],'up',true,'工作方向')");
 assert.match(notes,/工作应用/);assert.doesNotMatch(notes,/感情应用/);
 for(const lang of ['zh','en']){
  f.run(`lang='${lang}';drawnEntries=DECK.slice(0,10).map(card=>({card,position:{en:'Situation',cn:'现状'},reversed:false}));`);
  const prompt=f.run("buildSummaryPrompt('career 工作方向',{name:'Celtic',nameCN:'凯尔特'})");
  assert.ok(JSON.stringify([{role:'user',content:prompt}]).length<=12000,lang+': '+prompt.length);
 }
});

 test('追问容纳首次完整解读，同时保留摘要与追问长度上限',async()=>{
 const {onRequestPost}=await import('../functions/api/reading.js');
 const call=async(kind,length)=>{const r=await onRequestPost({env:{DEEPSEEK_API_KEY:'mock'},request:new Request('https://local/api/reading',{method:'POST',body:JSON.stringify({kind,messages:[{role:'user',content:'x'.repeat(length)}]})})});return r.json();};
 assert.equal((await call('chat',15000)).code,'REQUEST_ID_REQUIRED');
 assert.equal((await call('summary',24000)).error,'内容过长');
 assert.equal((await call('chat',36000)).error,'内容过长');
});

test('78张现代参考对应实际牌号，正逆位与领域准确选取，所有牌组长度符合限制',()=>{
 const f=setup();
 assert.equal(f.run('Object.keys(MODERN_CARD_NOTES).length'),78);
 for(let id=0;id<78;id++){
  assert.equal(f.run(`MODERN_CARD_NOTES[${id}].name`),f.run(`DECK[${id}].nameCN`));
  assert.match(f.run(`MODERN_CARD_NOTES[${id}].source`),/^https:\/\/labyrinthos.co\/blogs\/tarot-card-meanings-list\//);
  for(const domain of ['love','work','finance']){
   assert.ok(f.run(`MODERN_CARD_NOTES[${id}].up.${domain}.length > 0`));
   assert.ok(f.run(`MODERN_CARD_NOTES[${id}].rev.${domain} !== MODERN_CARD_NOTES[${id}].up.${domain}`));
  }
 }
 assert.match(f.run("modernCardNotes(51,'rev',true,'预算投资')"),/面对账目实际情况/);
 assert.doesNotMatch(f.run("modernCardNotes(51,'rev',true,'预算投资')"),/两难暂缓|路径或立场/);
 assert.match(f.run("modernCardNotes(43,'up',true,'')"),/关系：.*工作\/学习：.*金钱：/);
 assert.match(f.run("modernCardNotes(62,'up',true,'工作')"),/建设性反馈/);
 for(const style of ['rws','marseille','xiyouji'])for(const language of ['zh','en'])for(const reversed of [true,false]){
  f.run(`window.__deckStyle='${style}';lang='${language}';drawnEntries=DECK.map(card=>({card,position:{en:'Situation',cn:'现状'},reversed:${reversed}}));`);
  const lengths=[];
  for(let id=0;id<78;id++){
   const prompt=f.run(`(()=>{const all=drawnEntries;drawnEntries=[all[${id}]];const p=buildSummaryPrompt('关系 工作 金钱',{name:'Celtic',nameCN:'凯尔特'});drawnEntries=all;return p;})()`);
   assert.match(prompt,/Modern RWS applications|现代情景参考/);lengths.push([id,prompt.length]);
  }
  const largest=lengths.sort((a,b)=>b[1]-a[1]).slice(0,10).map(x=>x[0]);
  f.run(`drawnEntries=${JSON.stringify(largest)}.map(id=>({card:DECK[id],position:{en:'Situation',cn:'现状'},reversed:${reversed}}));`);
  const prompt=f.run("buildSummaryPrompt('关系 工作 金钱',{name:'Celtic',nameCN:'凯尔特'})");
  assert.ok(JSON.stringify([{role:'user',content:prompt}]).length<=12000,style+language+prompt.length);
 }
});

test('十二牌年运加入书籍参考后不超过官方首读上限',async()=>{
 const {selectBookReferences}=await import('../lib/book-references.js');
 const f=setup();
 for(const language of ['zh','en'])for(const style of ['rws','marseille','xiyouji'])for(const reversed of [true,false]){
  f.run(`lang='${language}';window.__deckStyle='${style}';`);
  const lengths=[];
  for(let id=0;id<78;id++){
   f.run(`drawnEntries=[{card:DECK[${id}],position:{en:'Month 1 (this month)',cn:'第1个月（本月）'},reversed:${reversed}}];`);
   const base=f.run("buildSummaryPrompt('关系 工作 学业 财务',{name:'Year Ahead',nameCN:'岁月十二章'})");
   lengths.push([id,base.length+JSON.stringify(selectBookReferences([{id,reversed}],'工作')).length]);
  }
  const ids=lengths.sort((a,b)=>b[1]-a[1]).slice(0,12).map(x=>x[0]);
  f.run(`drawnEntries=${JSON.stringify(ids)}.map(id=>({card:DECK[id],position:{en:'Month 1 (this month)',cn:'第1个月（本月）'},reversed:${reversed}}));`);
  const base=f.run("buildSummaryPrompt('关系 工作 学业 财务',{name:'Year Ahead',nameCN:'岁月十二章'})");
  const refs=JSON.stringify(selectBookReferences(ids.map(id=>({id,reversed})),'工作'));
  assert.ok(JSON.stringify([{role:'user',content:base+refs+'x'.repeat(700)}]).length<24000,style+language+' budget');
 }
});
