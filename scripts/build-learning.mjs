import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildLearningSite} from '../lib/learning-site.js';
const root=fileURLToPath(new URL('../',import.meta.url));
// Separate preview output never clears or overwrites the existing production dist.
const outputDir=path.join(root,'output/广告业务_20261018/preview');
const result=await buildLearningSite({root,outputDir});
console.log(`学习预览已生成：${result.articles} 个选题，${result.pages.length} 个页面。${outputDir}`);
