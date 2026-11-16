import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {adSenseVerification,articleAdPlaceholder,validateAdSenseConfig} from '../lib/adsense-site.js';
import {readArticles,learningPath,buildLearningSite} from '../lib/learning-site.js';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
test('未注册时不发布虚假AdSense身份；真实ID只生成验证信息而不加载广告',()=>{
 assert.equal(adSenseVerification(),null);
 for(const input of ['pub-1234567890123456','ca-pub-123','ca-pub-1234567890123456\" onclick=\"x',' ca-pub-1234567890123456'])assert.throws(()=>adSenseVerification(input));
 const result=adSenseVerification('ca-pub-1234567890123456');
 assert.match(result.meta,/content="ca-pub-1234567890123456"/);
 assert.equal(result.adsTxt,'google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n');
 assert.doesNotMatch(JSON.stringify(result),/adsbygoogle|<script/);
});

test('待审核广告只准备隐藏位置，不加载脚本；无效身份和直接启用均被拒绝',()=>{
 const publisher='ca-pub-9375448877859951',slot='1192726302';
 const config=validateAdSenseConfig({publisherId:publisher,articleSlot:slot,servingState:'awaiting-review'});
 assert.equal(config.publisherId,publisher);
 assert.equal(articleAdPlaceholder(publisher,''),'');
 for(const value of ['123','1192726302" onerror="x'])assert.throws(()=>articleAdPlaceholder(publisher,value));
 assert.throws(()=>validateAdSenseConfig({publisherId:publisher,articleSlot:slot,servingState:'enabled'}));
 assert.throws(()=>validateAdSenseConfig({articleSlot:slot}));
 const html=articleAdPlaceholder(publisher,slot,'zh');
 assert.match(html,/data-ad-state="awaiting-review" hidden/);
 assert.match(html,/data-ad-slot="1192726302"/);
 assert.doesNotMatch(html,/<script|\.push\(|pagead2\.googlesyndication/);
});

test('广告位只进入文章页，位于书目之后和相关阅读之前，目录不放广告',async()=>{
 const outputDir=await mkdtemp(path.join(tmpdir(),'tarot-article-ad-'));
 try{
  const all=await readArticles(),tower=all.find(a=>a.slug==='tower');
  const related={...all.find(a=>a.id===tower.related[0]),related:[]};
  await buildLearningSite({outputDir,articles:[{...tower,related:[related.id]},related],publisherId:'ca-pub-9375448877859951',articleSlot:'1192726302'});
  for(const lang of ['zh','en']){
   const index=await readFile(path.join(outputDir,lang,'learn/index.html'),'utf8');
   assert.doesNotMatch(index,/data-article-ad|class="adsbygoogle"/);
   const html=await readFile(path.join(outputDir,lang,'learn/tower/index.html'),'utf8');
   assert.ok(html.indexOf('data-article-ad')>html.indexOf('id="references"'));
   assert.ok(html.indexOf('data-article-ad')<html.indexOf('class="related-section"'));
   assert.equal((html.match(/data-article-ad/g)||[]).length,1);
   assert.match(html,/data-ad-state="awaiting-review" hidden/);
   assert.doesNotMatch(html,/pagead2\.googlesyndication|adsbygoogle\s*=/);
  }
 }finally{await rm(outputDir,{recursive:true,force:true});}
});
test('公开指南和隐私联系页面可以直达，站内链接和站点地图指向实际文件',async()=>{
 const learningRoutes=new Set((await readArticles()).flatMap(article=>['zh','en'].map(lang=>learningPath(lang,article.slug))));
 learningRoutes.add('/zh/learn/');learningRoutes.add('/en/learn/');
 const pages=['index.html','about.html','guides.html','guide-questions.html','guide-evidence.html','guide-followups.html','privacy.html','contact.html'];
 for(const page of pages){
  const html=readFileSync(new URL('../'+page,import.meta.url),'utf8');
  for(const match of html.matchAll(/href="(\/[^"?#]*)/g)){
   if(learningRoutes.has(match[1])) continue;
   const file=match[1]==='/'?'index.html':match[1].slice(1);
   assert.ok(existsSync(new URL('../'+file,import.meta.url)),page+' → '+file);
  }
  assert.doesNotMatch(html,/pagead2\.googlesyndication|adsbygoogle/);
 }
 const sitemap=readFileSync(new URL('../sitemap.xml',import.meta.url),'utf8');
 for(const page of pages.slice(1))assert.ok(sitemap.includes('/'+page.replace('.html','')+'</loc>'));
 assert.match(readFileSync(new URL('../contact.html',import.meta.url),'utf8'),/mailto:liuqiaoyi671@gmail.com/);
});
