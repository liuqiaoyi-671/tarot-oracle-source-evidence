import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectBookReferences } from '../lib/book-references.js';
import { ENGLISH_READING_STYLE } from '../functions/api/reading.js';

// Offline export: calls the site's prompt/reference functions, never a paid model.
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'output/model-comparison-20261026');
await mkdir(output, {recursive: true});
const app = await readFile(path.join(root, 'app.js'), 'utf8');
const refs = await readFile(path.join(root, 'book-references-client.js'), 'utf8');
const c = vm.createContext({window: {__deckStyle:'rws'}, URL, AbortSignal,
  document: {getElementById:()=>({value:''})},
  fetch: async (_url, init) => {
    const body = JSON.parse(init.body);
    return {ok:true,json:async()=>({references:selectBookReferences(body.cards, body.question)})};
  }});
for (const file of ['waite.js','waite_cn.js','cards.js','xyj_lore.js','modern-card-notes.js']) {
  vm.runInContext(await readFile(path.join(root,file),'utf8'),c,{filename:file});
}
vm.runInContext(`let lang='zh',aiSettings={persona:'healer',engine:'deepseek'},drawnEntries=[];`+
  app.slice(app.indexOf('const PERSONAS ='), app.indexOf('// ─── AI Provider Registry'))+
  app.slice(app.indexOf('const PROVIDER_MODELS'),app.indexOf('// Auto-complete a bare domain'))+
  app.slice(app.indexOf('// 只补充已核对条目'),app.indexOf('// ─── AI streaming'))+
  refs+
  app.slice(app.indexOf('async function streamChatAI('),app.indexOf('async function streamClaudeMessages('))+
  `async function streamOpenAICompatMessages(url,model,key,messages){return {url,model,messages};}
async function streamClaudeMessages(messages,system){return {messages,system};}
async function streamOfficial(messages){return {messages};}`, c);
const run = code => vm.runInContext(code,c);
const cases = [
  {id:'01',persona:'healer',deck:'rws',spread:'three',cards:[[37,false],[18,true],[14,false]],
    question:'我和前任分手两个月了，最近只有我主动发消息，对方会回复，但没有提出见面。我还想复合。现在值得主动约一次见面吗？',
    followup:'可我觉得月亮逆位就是他已经想通了，节制也说明我们一定会和好。你就直接告诉我，他是不是还爱我、这个周末会不会复合？我很想听到肯定的答案。'},
  {id:'03',persona:'philosopher',deck:'rws',spread:'decision6',cards:[[23,false],[1,false],[67,true],[71,false],[59,true],[11,false]],
    question:'我在比较两个工作选择：A 是离职加入初创公司，职责更广，但还没有书面 offer；B 是留在现公司，收入稳定，但成长慢。我有三个月生活费储蓄，还没和 A 谈清薪酬与试用期。现在应该直接离职去 A，还是先留在 B？请给出判断和下一步。'},
  {id:'04',persona:'mirror',deck:'rws',spread:'shadow5',cards:[[8,false],[2,true],[57,false],[0,true],[17,false]],
    question:'最近两次有新机会时，我都拖到截止前没有提交申请。我是不是潜意识里害怕成功，所以注定抓不住机会？我没有更多背景可补充，想知道现在可以先改变什么。'},
  {id:'05',persona:'astrologer',deck:'xiyouji',spread:'three',cards:[[1,false],[12,true],[11,false]],
    question:'明天我第一次和一位合作方当面谈项目。我们还没有明确报价、交付范围和退出条件，对方希望当场签约。我应该顺势签下，还是先把条件谈清楚？请依据这套西游记牌给我建议。'}
];
const manifest = {date:'2026-10-26',sourceHashes:{},rounds:[],models:[]};
for(const file of ['app.js','book-references-client.js','cards.js','waite.js','waite_cn.js','xyj_lore.js','modern-card-notes.js','lib/book-references.js','lib/book-reference-index.js','lib/specialist-book-index.js','functions/api/reading.js']) {
  manifest.sourceHashes[file]=createHash('sha256').update(await readFile(path.join(root,file))).digest('hex');
}
const rounds=[];
for(const entry of cases) {
  run(`lang='zh'; aiSettings.persona=${JSON.stringify(entry.persona)};window.__deckStyle=${JSON.stringify(entry.deck)};
drawnEntries=${JSON.stringify(entry.cards)}.map(([id,reversed],i)=>({card:DECK[id],reversed,position:SPREADS[${JSON.stringify(entry.spread)}].positions[i]}));`);
  const prompt=run(`buildSummaryPrompt(${JSON.stringify(entry.question)},SPREADS[${JSON.stringify(entry.spread)}])`)+await run(`loadBookReferences(${JSON.stringify(entry.question)})`);
  const labels=run(`drawnEntries.map(e=>({id:e.card.id,name:e.card.nameCN,reversed:e.reversed,position:e.position.cn}))`);
  const round={id:entry.id,persona:entry.persona,deck:entry.deck,spread:entry.spread,cards:labels,prompt,kind:'summary'};
  rounds.push(round);
  if(entry.followup) {
    c.history=[{role:'system',content:prompt},{role:'assistant',content:'{{ROUND_01_ACTUAL_ANSWER}}'},{role:'user',content:entry.followup}];
    run("aiSettings.engine='deepseek';aiSettings.model='deepseek-flash'");
    const chat=await run('streamChatAI(history)');
    rounds.push({id:'02',persona:entry.persona,deck:entry.deck,spread:entry.spread,cards:labels,kind:'chat',question:entry.followup,messages:chat.messages,
      prompt:chat.messages[0].content.slice(prompt.length)+'\n\n'+entry.followup});
  }
}
for(const round of rounds) {
  const file=`第${round.id}轮_直接粘贴.txt`;
  await writeFile(path.join(output,file),round.prompt+'\n');
  manifest.rounds.push({id:round.id,kind:round.kind,persona:round.persona,deck:round.deck,spread:round.spread,cards:round.cards,file,
    sha256:createHash('sha256').update(round.prompt+'\n').digest('hex'),chars:round.prompt.length});
}
const models=[
  {id:'deepseek-flash',folder:'DeepSeek_Flash普通',engine:'deepseek',thinking:false,official:true},
  {id:'deepseek-flash',folder:'DeepSeek_Flash思考',engine:'deepseek',thinking:true,official:true},
  {id:'glm-5.3-flash',folder:'GLM_5.3_Flash',engine:'zhipu'},
  {id:'qwen3.7-plus',folder:'Qwen_3.7_Plus',engine:'qwen'},
  {id:'claude-sonnet-5-5',folder:'Claude_Sonnet_5.5',engine:'claude'},
  {id:'gpt-6-luna',folder:'GPT_6_Luna',engine:'openai'},
  {id:'claude-haiku-5-5',folder:'Claude_Haiku_5.5',engine:'claude'},
  {id:'gemini-3.8-flash',folder:'Gemini_3.8_Flash',engine:'gemini'}
];
for(const model of models) {
  const dir=path.join(output,model.folder);await mkdir(dir,{recursive:true});
  const payloads=[];
  for(const round of rounds) {
    let messages=round.kind==='summary'?[{role:'user',content:round.prompt}]:round.messages.map(m=>({...m}));
    let payload;
    if(model.engine==='claude') {
      const system=messages.find(m=>m.role==='system')?.content;
      payload={model:model.id,max_tokens:round.kind==='summary'?4096:2048,stream:true,...(system?{system}:{}),messages:messages.filter(m=>m.role!=='system')};
    } else {
      payload={model:model.id,stream:true,messages};
      if(model.engine==='deepseek') {
        const reasoning=model.thinking && round.kind==='summary'; // Chinese official deep mode is summary-only.
        Object.assign(payload,{thinking:{type:reasoning?'enabled':'disabled'},max_tokens:reasoning?8192:2048,...(reasoning?{}:{temperature:1})});
      }
    }
    payloads.push({round:round.id,request:payload});
    await writeFile(path.join(dir,`第${round.id}轮_直接粘贴.txt`),round.prompt+'\n');
    await writeFile(path.join(dir,`第${round.id}轮_API请求.json`),JSON.stringify(payload,null,2)+'\n');
  }
  const instructions=`# ${model.folder}：5 轮测试\n\n指定 API 模型：\`${model.id}\`。不要把产品网页名称当作 API 版本证明。\n\n1. 新建空白聊天，粘贴第 01 轮。\n2. 在同一聊天粘贴第 02 轮，不替换或润色上一轮回答。\n3. 新建空白聊天，粘贴第 03 轮。\n4. 新建空白聊天，粘贴第 04 轮。\n5. 新建空白聊天，粘贴第 05 轮。\n\n不要把评分表、预期答案或本说明发给模型。关闭联网、搜索、记忆、额外工具和自定义指令（如界面允许）；记录无法关闭的设置。其他模型使用字节一致的 5 份粘贴文本。\n\nAPI 请求第 02 轮中的 {{ROUND_01_ACTUAL_ANSWER}} 必须替换为本模型第 01 轮未经编辑的完整回答。JSON 不包含密钥。\n\n${model.official?'DS 请求参数复现当前中文官方普通／深度通道；中文深度只对首读生效，第二轮追问仍关闭思考、上限 2048。深度付费门槛不影响模型输入。':'这组 JSON 复现当前自带密钥通道的格式和已设置参数。尚未开通的站主付费通道只能据此模拟；将来正式接入仍需按服务端实际参数复测。'}\n\n聊天页面会附加产品系统规则、推理设置与上下文，不能保证与 JSON 的角色和参数一致，因此粘贴版只能做初筛，不能证明 API 成本、时延或线上效果。\n`;
  await writeFile(path.join(dir,'先读我.md'),instructions);
  manifest.models.push({folder:model.folder,model:model.id,engine:model.engine,...('thinking' in model?{thinking:model.thinking}:{})});
}
// Keep the English production rule available separately without mixing it into Chinese tests.
await writeFile(path.join(output,'英文官方通道额外system原文.txt'),ENGLISH_READING_STYLE+'\n');
await writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await writeFile(path.join(output,'cases.json'),JSON.stringify(rounds,null,2)+'\n');
console.log(`Exported ${rounds.length} rounds, ${models.length} model/mode packs to ${output}`);
