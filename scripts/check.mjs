import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const roots=['select-fit.js','tour.js','tour-copy.js','tour-steps.js','paypal-return.js','app.js','app-localization.js','app-navigation.js','site-language.js','learning.js','modern-card-notes.js','analytics.js','notices-data.js','notices.js','cards.js','waite.js','waite_cn.js','xyj_lore.js','reading-html.js','reading-history.js'];
for(const dir of ['functions','lib','scripts','tests']) {
  for(const entry of readdirSync(dir,{recursive:true,withFileTypes:true})) {
    if(entry.isFile() && /\.(?:js|mjs|cjs)$/.test(entry.name)) roots.push(`${entry.parentPath}/${entry.name}`);
  }
}
for(const file of roots) {
  const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(result.status!==0){process.stderr.write(result.stderr);process.exit(1);}
}
console.log(`${roots.length} 个自有 JS 文件语法检查通过。`);
