import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {renderMarkdown, validateArticles, buildLearningSite, learningPath, readArticles} from '../lib/learning-site.js';
import {readLearningCatalog,validateLearningCoverage} from '../lib/learning-catalog.js';
import {fileURLToPath} from 'node:url';
import {existsSync} from 'node:fs';

const article = (id='G01', slug='ask-useful-questions') => ({id,slug,category:'getting-started',related:[],
 zh:{title:'怎样提问',description:'具体的问题与行动。',body:'## 从事实开始\n\n这是一段完整可读的中文正文。\n\n| 事实 | 解释 |\n|---|---|\n| 没有回复 | 可能忙碌 |'},
 en:{title:'Ask a useful question',description:'Start with context and find an action.',body:'## Start with facts\n\nA complete readable English paragraph.'},
 editorial:{status:'draft',notes:['INTERNAL_ONLY_PRIVATE_MARKER']}});

test('学习文章校验拒绝危险slug、重复ID或slug、缺语言和悬空相关阅读',()=>{
 for(const slug of ['../outside','a/b','a\\b','a?x=1','a#b','a..b','/abs','a--b']) assert.throws(()=>learningPath('zh',slug));
 assert.throws(()=>learningPath('fr','safe'));
 assert.throws(()=>validateArticles([article(),article()]));
 assert.throws(()=>validateArticles([{...article(),en:null}]));
 assert.throws(()=>validateArticles([{...article(),slug:''}]));
 assert.throws(()=>validateArticles([{...article(),related:['MISSING']}]));
 assert.throws(()=>validateArticles([{...article(),category:'unknown'}]));
 assert.equal(learningPath('zh','safe-slug'),'/zh/learn/safe-slug/');
});

test('Markdown转义原始HTML、属性引号并拒绝可执行和跨域伪装协议',()=>{
 const {html}=renderMarkdown('## 标题\n\n<script>alert(1)</script>\n\n[bad](javascript:alert%281%29) [bad](data:text/html,test) [bad](//evil.test) [bad](/\\evil.test)\n\n[good](https://example.com/?q=%22) **强调** `a < b`\n\n| 甲 | 乙 |\n|---|---|\n| 1 | 2 |');
 assert.doesNotMatch(html,/<script|href="(?:javascript:|data:|\/\/|\/\\)/);
 assert.match(html,/&lt;script&gt;/);
 assert.match(html,/<strong>强调<\/strong>/);
 assert.match(html,/<code>a &lt; b<\/code>/);
 assert.match(html,/<table>/);
 assert.match(html,/rel="noopener noreferrer"/);
 assert.doesNotMatch(renderMarkdown('[escape](https://example.com/\"onmouseover=\"x)').html,/href="[^"]*"onmouseover/);
});

test('正文里的旧正式域名和相对抽牌链接均保留语言并使用受控返回，外部参考仍隔离',()=>{
 const {html}=renderMarkdown('[开始](https://www.tarot-oracle-from-joy.top/?start=1) [再次开始](/?start=1) [回到抽牌](/) [资料](https://example.com/)',{language:'zh'});
 assert.equal((html.match(/data-return-reading href="\/\?start=1&amp;lang=zh"/g)||[]).length,3);
 assert.equal((html.match(/target="_blank"/g)||[]).length,1);
 assert.match(html,/https:\/\/example.com\//);
});

test('静态生成双语完整HTML、自指canonical、互相hreflang和真实身份验证，内部字段不外泄',async()=>{
 const outputDir=await mkdtemp(path.join(tmpdir(),'tarot-learning-test-'));
 try{
  const result=await buildLearningSite({outputDir,articles:[article()],publisherId:'ca-pub-1234567890123456'});
  assert.equal(result.pages.length,4);
  const zh=await readFile(path.join(outputDir,'zh/learn/ask-useful-questions/index.html'),'utf8');
  const en=await readFile(path.join(outputDir,'en/learn/ask-useful-questions/index.html'),'utf8');
  assert.match(zh,/<html lang="zh-Hans"/);assert.match(en,/<html lang="en"/);
  assert.match(zh,/<link rel="canonical" href="https:\/\/www.tarot-oracle-from-joy.top\/zh\/learn\/ask-useful-questions\/"/);
  assert.match(zh,/hreflang="en" href="https:\/\/www.tarot-oracle-from-joy.top\/en\/learn\/ask-useful-questions\/"/);
  assert.match(zh,/这是一段完整可读的中文正文/);assert.doesNotMatch(en,/这是一段完整可读的中文正文/);
  assert.match(zh,/google-adsense-account/);assert.doesNotMatch(zh,/adsbygoogle|pagead2\.googlesyndication|INTERNAL_ONLY_PRIVATE_MARKER|human_editor_approval/);
  const sitemap=await readFile(path.join(outputDir,'sitemap.xml'),'utf8');
  assert.match(sitemap,/\/zh\/learn\/ask-useful-questions\//);assert.match(sitemap,/xhtml:link/);
  assert.doesNotMatch(sitemap,/lastmod/);
 }finally{await rm(outputDir,{recursive:true,force:true});}
});

test('没有发布商ID时学习页不生成虚假身份；元数据中的HTML不能成为标签',async()=>{
 const outputDir=await mkdtemp(path.join(tmpdir(),'tarot-learning-test-'));
 try{
  const a=article();a.zh.title='标题 </script><script>alert(1)</script>';
  await buildLearningSite({outputDir,articles:[a]});
  const html=await readFile(path.join(outputDir,'zh/learn/ask-useful-questions/index.html'),'utf8');
  assert.doesNotMatch(html,/google-adsense-account|<script>alert/);
  assert.match(html,/&lt;\/script&gt;/);
 }finally{await rm(outputDir,{recursive:true,force:true});}
});

test('图鉴跟随当前11种牌阵与6套牌组，马赛力量/正义按牌义身份对应',async()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));
 const catalog=await readLearningCatalog(root);
 assert.equal(Object.keys(catalog.spreads).length,11);assert.equal(catalog.majors.length,22);assert.equal(catalog.decks.length,6);
 const marseille=catalog.decks.find(deck=>deck.key==='marseille');
 assert.match(marseille.images[8],/major11\.webp$/);assert.match(marseille.images[11],/major08\.webp$/);
 for(const deck of catalog.decks)for(const src of deck.images)assert.ok(existsSync(path.join(root,src)),deck.key+' '+src);
 assert.throws(()=>validateLearningCoverage([article()],catalog));
});

test('卡牌文章编号与牌阵键不可重复，卡牌入口按0至21语义排序且保留静态图像',async()=>{
 const makeCard=(id,cardId)=>({...article(id,`card-${cardId}`),category:'card-meanings',cardId});
 assert.throws(()=>validateArticles([makeCard('C01',0),makeCard('C02',0)]));
 assert.throws(()=>validateArticles([{...makeCard('C01',0),cardId:22}]));
 const makeSpread=(id,key)=>({...article(id,`spread-${key}`),category:'spreads',spreadKey:key});
 assert.throws(()=>validateArticles([makeSpread('S01','single'),makeSpread('S02','single')]));
 const outputDir=await mkdtemp(path.join(tmpdir(),'tarot-card-grid-'));
 try{
  await buildLearningSite({outputDir,articles:[makeCard('C02',1),makeCard('C01',0)]});
  const html=await readFile(path.join(outputDir,'zh/learn/index.html'),'utf8');
  assert.equal((html.match(/class="major-card"/g)||[]).length,2);
  assert.ok(html.indexOf('data-card-id="0"')<html.indexOf('data-card-id="1"'));
  assert.match(html,/src="\/牌面-韦特\/00\.webp"/);
  assert.match(html,/href="\/zh\/learn\/card-0\/"/);
  assert.doesNotMatch(html,/data-card-id="22"/);
  const mapping=JSON.parse(await readFile(path.join(outputDir,'learning-decks.json'),'utf8'));
  assert.equal(mapping.decks.length,6);
 }finally{await rm(outputDir,{recursive:true,force:true});}
});

test('全部牌阵双语正文包含当前产品的每个实际牌位，22张大牌无缺项',async()=>{
 const root=fileURLToPath(new URL('../',import.meta.url)),catalog=await readLearningCatalog(root),articles=await readArticles(root);
 assert.equal(articles.length,41);
 assert.equal(articles.filter(a=>a.category==='card-meanings').length,22);
 const normalize=value=>value.toLowerCase().replace(/[’']/g,"'").replace(/[—–]/g,'-').replace(/\s+/g,' ');
 for(const article of articles.filter(a=>a.category==='spreads')){
  for(const language of ['zh','en'])for(const key of ['question','reading'])assert.ok(article.overview?.[language]?.[key]?.trim(),article.id+' complete preview '+language+' '+key);
  for(const position of catalog.spreads[article.spreadKey].positions){
   assert.ok(normalize(article.zh.body).includes(normalize(position.cn)),article.id+' missing ZH position '+position.cn);
   assert.ok(normalize(article.en.body).includes(normalize(position.en)),article.id+' missing EN position '+position.en);
  }
 }
});

test('参考书目只发布明确字段，双语采用说明完整且危险链接及私人定位不能注入',async()=>{
 const outputDir=await mkdtemp(path.join(tmpdir(),'tarot-sourced-cards-'));
 try{
  const a={...article('C01','fool'),category:'card-meanings',cardId:0,references:[{
   id:'waite',author:'A. E. Waite <script>',title:'The Pictorial Key to the Tarot',year:1910,
   chapter:'Part III, §3 — The Fool',url:'https://example.com/book?chapter=fool',
   relation:{zh:'采用悬崖、白犬与旅装的图像解读。',en:'Used for the cliff, white dog and travelling clothes.'},
   sourcePath:'PRIVATE_REFERENCE_PATH',internalNote:'PRIVATE_REFERENCE_NOTE'
  },{id:'safe',author:'Author',title:'<img src=x onerror=alert(1)>',year:'2008',chapter:'Fool',url:'javascript:alert(1)',relation:{zh:'现代应用。',en:'Modern applications.'}}]};
  await buildLearningSite({outputDir,articles:[a]});
  const zh=await readFile(path.join(outputDir,'zh/learn/fool/index.html'),'utf8'),en=await readFile(path.join(outputDir,'en/learn/fool/index.html'),'utf8');
  for(const html of [zh,en]){
   assert.match(html,/id="references"/);assert.match(html,/href="#references"/);
   assert.match(html,/Part III, §3 — The Fool/);assert.match(html,/\(1910\)/);
   assert.match(html,/https:\/\/example.com\/book\?chapter=fool/);assert.match(html,/noopener noreferrer/);
   assert.doesNotMatch(html,/PRIVATE_REFERENCE_PATH|PRIVATE_REFERENCE_NOTE|INTERNAL_ONLY_PRIVATE_MARKER|href="javascript:|<img src=x|<script>/);
   assert.match(html,/&lt;script&gt;/);assert.match(html,/data-deck-card="0"/);
  }
  assert.match(zh,/采用悬崖、白犬与旅装/);assert.doesNotMatch(zh,/Used for the cliff/);
  assert.match(en,/Used for the cliff/);assert.doesNotMatch(en,/采用悬崖/);
  assert.throws(()=>validateArticles([{...a,references:[{...a.references[0],relation:{zh:'只有中文'}}]}]));
 }finally{await rm(outputDir,{recursive:true,force:true});}
});

test('星夜书阁保留完整静态章节、三张牌开篇、牌阵缩略图和可同步文章题图',async()=>{
 const outputDir=await mkdtemp(path.join(tmpdir(),'tarot-celestial-ui-'));
 try{
  const guide=article(),card={...article('C01','fool'),category:'card-meanings',cardId:0},spread={...article('S01','one-card-spread'),category:'spreads',spreadKey:'single',overview:{zh:{question:'今天最需要留意什么？',reading:'抓住一个重点。'},en:{question:'What needs my attention today?',reading:'Find one focus.'}}};
  await buildLearningSite({outputDir,articles:[guide,card,spread]});
  const html=await readFile(path.join(outputDir,'zh/learn/index.html'),'utf8');
  assert.equal((html.match(/data-chapter-link=/g)||[]).length,3);
  assert.equal((html.match(/ data-chapter>/g)||[]).length,3);
  assert.doesNotMatch(html,/ hidden|scheme-switch|scheme-bar|data-variant/);
  for(const id of [2,17,19])assert.match(html,new RegExp(`data-deck-card="${id}"`));
  assert.match(html,/class="article-row spread-tile"/);assert.match(html,/<svg class="spread-diagram"/);
  assert.match(html,/data-deck-picker/);assert.match(html,/从一张牌/);
  assert.match(html,/塔罗帮助你，以尽可能好的方式面对一切际遇。/);
  assert.match(html,/href="https:\/\/marykgreer.com\/"[^>]*>— Mary K. Greer/);
  assert.match(html,/class="return-icon"/);
  assert.doesNotMatch(html,/从第一次抽牌开始|点击一张牌，从画面读起|认识牌面，理解牌阵|↗/);
  assert.match(html,/class="spread-question">今天最需要留意什么？/);
  assert.match(html,/class="spread-reading"/);
  assert.match(html,/class="modal-select" data-deck-picker/);
  const englishIndex=await readFile(path.join(outputDir,'en/learn/index.html'),'utf8');
  assert.match(englishIndex,/Tarot helps you meet whatever comes in the best possible way\./);
  assert.doesNotMatch(englishIndex,/Begin with your first reading|Choose a card. Begin with what you see./);
  assert.match(englishIndex,/What needs my attention today\?/);
  assert.throws(()=>validateArticles([{...spread,overview:{zh:{question:'完整',reading:'完整'},en:{question:'Question'}}}]));
  const articleHTML=await readFile(path.join(outputDir,'zh/learn/fool/index.html'),'utf8');
  assert.match(articleHTML,/class="article-illustration"><img data-deck-card="0"/);
  assert.doesNotMatch(articleHTML,/data-major-grid/);
 }finally{await rm(outputDir,{recursive:true,force:true});}
});
