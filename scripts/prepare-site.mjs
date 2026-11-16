import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { adSenseVerification, validateAdSenseConfig } from '../lib/adsense-site.js';
import { buildLearningSite, readArticles } from '../lib/learning-site.js';

// 显式发布清单，问卷、数据库、密钥、本地配置、测试和文档不会进入产物。
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist');
const files = ['select-fit.js','tour.js','tour-copy.js','tour-steps.js','tour.css','index.html','book-references-client.js','draw-methods.js','app.js','app-localization.js','app-navigation.js','site-language.js','modern-card-notes.js','reading-html.js','reading-history.js','cards.js','waite.js','waite_cn.js',
  'xyj_lore.js','analytics.js','notices-data.js','notices.js','notices.css','html2canvas.min.js','admin.html','stats.html','manifest.json','_headers',
  '牌背.jpg','icon-192.png','icon-512.png','og-cover.jpg','site.css','typography.css','experience.css','paypal-return.html','paypal-return.js','about.html','guides.html',
  'guide-questions.html','guide-evidence.html','guide-followups.html','privacy.html','contact.html','robots.txt','sitemap.xml'];
const directories = ['牌面-韦特','牌面-马赛','牌面-西游记','牌面-卡通手绘风','牌面-黑金手绘风','牌面-喵喵塔罗'];
// Validate the full collection before removing an existing local preview/build.
const learningArticles = await readArticles(root);
const configuredAds = validateAdSenseConfig(JSON.parse(await readFile(path.join(root,'adsense.config.json'),'utf8')));
const publisherId = process.env.ADSENSE_PUBLISHER_ID || configuredAds.publisherId;
const articleSlot = publisherId===configuredAds.publisherId ? configuredAds.articleSlot : '';
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of [...files,...directories]) await cp(path.join(root,file), path.join(output,file), { recursive: true });
await cp(path.join(root,'fonts'), path.join(output,'fonts'), {recursive:true});
const learning = await buildLearningSite({root,outputDir:output,articles:learningArticles,publisherId,articleSlot});
const index = await readFile(path.join(output,'index.html'),'utf8');
const verification = adSenseVerification(publisherId);
// 仅验证所有权；审核、广告位及 CMP 配置完成前，不加载 Google 广告脚本。
if (verification) {
  for (const file of files.filter(name => name.endsWith('.html') && !['admin.html','stats.html'].includes(name))) {
    const html = await readFile(path.join(output,file),'utf8');
    await writeFile(path.join(output,file),html.replace('</head>',`${verification.meta}\n</head>`));
  }
  await writeFile(path.join(output,'ads.txt'),verification.adsTxt);
}
for (const match of index.matchAll(/<script src="([^"?]+)/g)) {
  if (!files.includes(match[1])) throw new Error(`未纳入发布的脚本: ${match[1]}`);
}
await writeFile(path.join(output,'_routes.json'), JSON.stringify({ version:1, include:['/api/*','/schema.sql','/wrangler.jsonc','/反馈1.xlsx','/.dev.vars','/.claude/*','/.wrangler/*','/.git/*','/README.md','/RELEASE.md','/ACCEPTANCE.md','/chatgpt-export*'], exclude:[] },null,2));
console.log(`已生成 dist：${files.length} 个原站文件、${learning.pages.length} 个学习页面、${directories.length} 套牌面；仅 /api/* 调用 Functions。`);
