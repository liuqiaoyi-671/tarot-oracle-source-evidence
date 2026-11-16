import {readFile, readdir, mkdir, writeFile, cp} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {adSenseVerification,articleAdPlaceholder} from './adsense-site.js';
import {readLearningCatalog,validateLearningCoverage} from './learning-catalog.js';
import {spreadDiagram} from './learning-visuals.js';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const ORIGIN='https://www.tarot-oracle-from-joy.top';
const CATEGORIES=['getting-started','spreads','card-meanings'];
const LIBRARY_QUOTE={author:'Mary K. Greer',url:'https://marykgreer.com/',zh:'塔罗帮助你，以尽可能好的方式面对一切际遇。',en:'Tarot helps you meet whatever comes in the best possible way.'};
const RETURN_ICON='<svg class="return-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 4 4 9l5 5M4 9h10a6 6 0 0 1 0 12h-3"/></svg>';
const LABELS={zh:{brand:'塔罗神谕',learn:'学习',reading:'开始抽牌',back:'返回占卜',about:'关于',privacy:'隐私',contact:'联系',skip:'跳到正文',contents:'这一篇，我们读什么',related:'接着阅读',categories:['入门指南','牌阵指南','牌义笔记'],kicker:'THE TAROT LIBRARY',hero:'从一张牌，\n读懂此刻的自己。',intro:'认识牌面，理解牌阵。让每一次抽牌，多一份清晰。',first:'从第一次抽牌开始',all:'浏览书阁',footer:'学习内容由 AI 辅助整理；采用的书目与观点见各篇参考来源。',explore:'把理解带回自己的问题里。',cta:'回到占卜',index:'星夜书阁',references:'参考书与本文依据',open:'翻开笔记',deck:'当前牌面',cardHeading:'二十二张，二十二种看见。',cardDescription:'点击一张牌，从画面读起。',spreadHeading:'按你的问题，选择牌阵。',spreadDescription:'比较选择、理解关系，或梳理一件事的发展。',guideHeading:'从第一个问题，开始认识塔罗。',guideDescription:'八篇指南，走过提问、抽牌与解读。'},en:{brand:'TAROT ORACLE',learn:'Learn',reading:'Start a reading',back:'Your reading',about:'About',privacy:'Privacy',contact:'Contact',skip:'Skip to content',contents:'In these notes',related:'Keep exploring',categories:['Getting started','Spread guides','Card meanings'],kicker:'THE TAROT LIBRARY',hero:'A little curiosity.\nA deeper understanding.',intro:'Meet the cards. Explore the spreads. Bring a little more clarity to each reading.',first:'Begin with your first reading',all:'Explore the library',footer:'AI-assisted learning notes. Books and the ideas used are identified in each article’s references.',explore:'Bring that understanding to your own question.',cta:'Return to your reading',index:'The Celestial Library',references:'Books and ideas behind these notes',open:'Open notes',deck:'Your deck',cardHeading:'Twenty-two ways of seeing.',cardDescription:'Choose a card. Begin with what you see.',spreadHeading:'Choose a spread for your question.',spreadDescription:'Compare choices, explore a relationship or follow how a situation develops.',guideHeading:'Begin with your first question.',guideDescription:'Eight guides to asking, drawing and reading.'}};
const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function learningPath(language,slug='') {
 if(!['zh','en'].includes(language)) throw new Error('Unsupported learning language');
 if(slug&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('Invalid learning slug');
 return `/${language}/learn/${slug?slug+'/':''}`;
}

export function validateArticles(articles) {
 if(!Array.isArray(articles)||!articles.length) throw new Error('No learning articles');
 const ids=new Set(),slugs=new Set(),cardIds=new Set(),spreadKeys=new Set();
 for(const article of articles){
  if(!/^[GSC]\d{2}$/.test(article.id)||ids.has(article.id)) throw new Error('Invalid or duplicate article ID');
  ids.add(article.id);if(!article.slug) throw new Error('Missing article slug');learningPath('en',article.slug);
  if(slugs.has(article.slug)) throw new Error('Duplicate article slug');slugs.add(article.slug);
  if(!CATEGORIES.includes(article.category)) throw new Error('Invalid article category');
  if(article.category==='card-meanings'){
   if(!Number.isInteger(article.cardId)||article.cardId<0||article.cardId>21||cardIds.has(article.cardId)) throw new Error('Invalid or duplicate major card ID');
   cardIds.add(article.cardId);
  }
  if(article.category==='spreads'){
   if(typeof article.spreadKey!=='string'||!/^[a-z][a-z0-9]*$/.test(article.spreadKey)||spreadKeys.has(article.spreadKey)) throw new Error('Invalid or duplicate spread key');
   spreadKeys.add(article.spreadKey);
   if(article.overview)for(const language of ['zh','en'])for(const key of ['question','reading']){
    if(typeof article.overview[language]?.[key]!=='string'||!article.overview[language][key].trim())throw new Error(`Missing spread overview ${language} ${key}: ${article.id}`);
   }
  }
  if(!Array.isArray(article.related)) throw new Error('Missing related article IDs');
  if(article.references!==undefined){
   if(!Array.isArray(article.references)) throw new Error('Invalid article references');
   for(const reference of article.references){
    for(const key of ['id','author','title','chapter']) if(typeof reference?.[key]!=='string'||!reference[key].trim()) throw new Error(`Missing reference ${key}: ${article.id}`);
    if(!['string','number'].includes(typeof reference.year)) throw new Error(`Missing reference year: ${article.id}`);
    for(const lang of ['zh','en']) if(typeof reference.relation?.[lang]!=='string'||!reference.relation[lang].trim()) throw new Error(`Missing reference relation ${lang}: ${article.id}`);
    if(reference.url!==undefined&&typeof reference.url!=='string') throw new Error(`Invalid reference URL: ${article.id}`);
   }
  }
  for(const lang of ['zh','en']) for(const key of ['title','description','body']) {
   if(typeof article[lang]?.[key]!=='string'||!article[lang][key].trim()) throw new Error(`Missing ${lang} ${key}: ${article.id}`);
  }
 }
 for(const article of articles) for(const id of article.related) if(!ids.has(id)||id===article.id) throw new Error(`Invalid related ID: ${id}`);
 return [...articles].sort((a,b)=>CATEGORIES.indexOf(a.category)-CATEGORIES.indexOf(b.category)||(a.category==='card-meanings'?a.cardId-b.cardId:a.id.localeCompare(b.id)));
}

function safeURL(value) {
 if(value!==value.trim()||/[\u0000-\u0020\\]/.test(value)) return null;
 if(value.startsWith('#')) return value;
 if(value.startsWith('/')&&!value.startsWith('//')) return value;
 try{const u=new URL(value);if(['https:','mailto:'].includes(u.protocol)) return u.href;}catch{}
 return null;
}

function inline(text,language) {
 const tokens=[];
 const token=html=>{const id=tokens.length;tokens.push(html);return `\u0000${id}\u0000`;};
 let source=text.replace(/`([^`]+)`/g,(_,code)=>token(`<code>${escapeHTML(code)}</code>`));
 source=source.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,(_,label,url)=>{
  let href=safeURL(url);
  if(!href) return token(escapeHTML(label));
  if(language){
   const destination=new URL(href,ORIGIN);
   if(destination.origin===ORIGIN&&destination.pathname==='/'&&!destination.hash&&(!destination.search||destination.searchParams.get('start')==='1')) {
    href=`/?start=1&lang=${language}`;
    return token(`<a data-return-reading href="${escapeHTML(href)}">${escapeHTML(label)}</a>`);
   }
  }
  const external=href.startsWith('https:');
  return token(`<a href="${escapeHTML(href)}"${external?' target="_blank" rel="noopener noreferrer"':''}>${escapeHTML(label)}</a>`);
 });
 source=escapeHTML(source).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>');
 return source.replace(/\u0000(\d+)\u0000/g,(_,i)=>tokens[Number(i)]);
}

// Deliberately small Markdown subset: text is escaped before inline formatting.
export function renderMarkdown(markdown,{language}={}) {
 const lines=markdown.replace(/\r/g,'').split('\n'),blocks=[],headings=[];
 let i=0;
 const isHeading=s=>/^#{1,3}\s+/.test(s);
 const isList=s=>/^\s*(?:[-*]|\d+\.)\s+/.test(s);
 const isTableRule=s=>/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(s);
 const cells=s=>s.trim().replace(/^\||\|$/g,'').split('|').map(c=>c.trim());
 while(i<lines.length){
  const line=lines[i].trim();if(!line){i++;continue;}
  if(line.startsWith('```')){
   const code=[];i++;while(i<lines.length&&!lines[i].trim().startsWith('```')) code.push(lines[i++]);i++;
   blocks.push(`<pre><code>${escapeHTML(code.join('\n'))}</code></pre>`);continue;
  }
  if(isHeading(line)){
   const match=line.match(/^(#{1,3})\s+(.+)$/),level=Math.max(2,match[1].length),id=`section-${headings.length+1}`;
   headings.push({id,title:match[2].replace(/[*`]/g,''),level});
   blocks.push(`<h${level} id="${id}">${inline(match[2],language)}</h${level}>`);i++;continue;
  }
  if(i+1<lines.length&&line.includes('|')&&isTableRule(lines[i+1])){
   const header=cells(line);i+=2;const rows=[];
   while(i<lines.length&&lines[i].trim().includes('|')&&lines[i].trim()) rows.push(cells(lines[i++]));
   blocks.push(`<div class="table-scroll" tabindex="0"><table><thead><tr>${header.map(c=>`<th scope="col">${inline(c,language)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${header.map((_,n)=>`<td>${inline(row[n]||'',language)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);continue;
  }
  if(isList(line)){
   const ordered=/^\d+\./.test(line),tag=ordered?'ol':'ul',items=[];
   while(i<lines.length&&isList(lines[i].trim())&&/^\d+\./.test(lines[i].trim())===ordered){items.push(lines[i++].trim().replace(/^(?:[-*]|\d+\.)\s+/,''));}
   blocks.push(`<${tag}>${items.map(item=>`<li>${inline(item,language)}</li>`).join('')}</${tag}>`);continue;
  }
  if(line.startsWith('>')){
   const quote=[];while(i<lines.length&&lines[i].trim().startsWith('>')) quote.push(lines[i++].trim().replace(/^>\s?/,''));
   blocks.push(`<blockquote><p>${inline(quote.join(' '),language)}</p></blockquote>`);continue;
  }
  if(/^(?:---+|\*\*\*+)$/.test(line)){blocks.push('<hr>');i++;continue;}
  const paragraph=[line];i++;
  while(i<lines.length&&lines[i].trim()&&!isHeading(lines[i].trim())&&!isList(lines[i].trim())&&!lines[i].trim().startsWith('>')&&!lines[i].trim().startsWith('```')&&!(i+1<lines.length&&isTableRule(lines[i+1]))) paragraph.push(lines[i++].trim());
  blocks.push(`<p>${inline(paragraph.join(' '),language)}</p>`);
 }
 return {html:blocks.join('\n'),headings};
}

function head(language,title,description,pathname,alternate,verification) {
 return `<!doctype html>\n<html lang="${language==='zh'?'zh-Hans':'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(title)} · ${LABELS[language].brand}</title><meta name="description" content="${escapeHTML(description)}"><link rel="canonical" href="${ORIGIN}${pathname}"><link rel="alternate" hreflang="zh-Hans" href="${ORIGIN}${alternate.zh}"><link rel="alternate" hreflang="en" href="${ORIGIN}${alternate.en}"><meta property="og:type" content="article"><meta property="og:title" content="${escapeHTML(title)}"><meta property="og:description" content="${escapeHTML(description)}"><meta property="og:url" content="${ORIGIN}${pathname}"><link rel="icon" href="/icon-192.png"><link rel="stylesheet" href="/typography.css?v=20261008a"><link rel="stylesheet" href="/learning.css?v=20261101a"><script src="/select-fit.js?v=20261101a" defer></script><script src="/learning.js?v=20261020a" defer></script>${verification?.meta||''}</head>`;
}

function header(language,slug='') {
 const text=LABELS[language],other=language==='zh'?'en':'zh';
 return `<body><a class="skip" href="#content">${text.skip}</a><header class="learn-header"><a class="learn-brand" href="${learningPath(language)}"><span class="brand-moon" aria-hidden="true">☽</span><span>TAROT ORACLE<small>${language==='zh'?'塔 罗 神 谕':'A MOMENT OF REFLECTION'}</small></span></a><nav aria-label="${language==='zh'?'主导航':'Main navigation'}"><a class="back-reading" data-return-reading href="/?start=1&amp;lang=${language}">${RETURN_ICON}${text.back}</a><a class="language-link" href="${learningPath(other,slug)}" lang="${other==='zh'?'zh-Hans':'en'}" hreflang="${other==='zh'?'zh-Hans':'en'}">${other==='zh'?'中文':'EN'}</a></nav></header>`;
}

function footer(language) {
 const text=LABELS[language];
 return `<footer class="learn-footer"><div><a class="footer-brand" href="${learningPath(language)}">☽ TAROT ORACLE</a><p>${text.footer}</p></div><nav aria-label="${language==='zh'?'网站信息':'Site information'}"><a href="/about.html?lang=${language}">${text.about}</a><a href="/privacy.html?lang=${language}">${text.privacy}</a><a href="/contact.html?lang=${language}">${text.contact}</a></nav></footer></body></html>`;
}

function articleRow(article,language,number) {
 const data=article[language];
 return `<a class="article-row" href="${learningPath(language,article.slug)}"><span class="article-number" aria-hidden="true">${String(number).padStart(2,'0')}</span><span class="article-row-text"><h3>${escapeHTML(data.title)}</h3><p>${escapeHTML(data.description)}</p></span></a>`;
}

function deckImage(cardId,catalog,{alt='',loading='lazy'}={}) {
 const deck=catalog.decks.find(item=>item.key==='rws');
 return `<img data-deck-card="${cardId}" src="${escapeHTML(deck.images[cardId])}" alt="${escapeHTML(alt)}" loading="${loading}" decoding="async" width="300" height="500">`;
}

function heroArt(catalog) {
 return `<div class="hero-art" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><span class="art-star star-one">✦</span><span class="art-star star-two">✧</span><span class="art-moon">☾</span><div class="hero-card card-left">${deckImage(2,catalog,{loading:'eager'})}</div><div class="hero-card card-right">${deckImage(19,catalog,{loading:'eager'})}</div><div class="hero-card card-center">${deckImage(17,catalog,{loading:'eager'})}</div><span class="art-caption">THE STAR</span></div>`;
}

function majorGrid(articles,language,catalog) {
 const text=LABELS[language],rws=catalog.decks.find(deck=>deck.key==='rws');
 const note=language==='zh'?'牌面沿用你选择的牌组，牌义正文以韦特体系为主。':'The artwork follows your chosen deck. The notes primarily discuss Rider–Waite–Smith meanings.';
 return `<div class="major-catalog"><strong class="visually-hidden" data-active-deck-label>${escapeHTML(rws.name[language])}</strong><div class="major-grid" data-major-grid>${articles.map(article=>{
  const card=catalog.majors.find(c=>c.cardId===article.cardId);
  return `<a class="major-card" data-card-id="${card.cardId}" href="${learningPath(language,article.slug)}"><span class="major-card-face"><span class="card-corners" aria-hidden="true"></span>${deckImage(card.cardId,catalog)}<span class="card-open" aria-hidden="true">${text.open}</span></span><span class="major-card-name">${escapeHTML(card.name[language])}</span>${language==='zh'?`<span class="major-card-english" lang="en">${escapeHTML(card.name.en)}</span>`:''}</a>`;
 }).join('')}</div><p class="catalog-note">☾ ${note}</p></div>`;
}

function deckPicker(language,catalog){
 return `<label class="deck-control"><span>${LABELS[language].deck}</span><select class="modal-select" data-deck-picker aria-label="${language==='zh'?'选择牌组':'Choose your deck'}">${catalog.decks.map(deck=>`<option value="${escapeHTML(deck.key)}"${deck.key==='rws'?' selected':''}>${escapeHTML(deck.name[language])}</option>`).join('')}</select></label>`;
}

function spreadGrid(articles,language,catalog) {
 return `<div class="spread-grid">${articles.map(article=>{
  const spread=catalog.spreads[article.spreadKey],data=article[language],overview=article.overview?.[language];
  return `<a class="article-row spread-tile" href="${learningPath(language,article.slug)}"><div class="spread-art">${spreadDiagram(article.spreadKey)}</div><div class="spread-copy"><div class="spread-title"><h3>${escapeHTML(language==='zh'?spread.nameCN:spread.name)}</h3><span class="spread-count">${spread.positions.length} ${language==='zh'?'张牌':spread.positions.length===1?'card':'cards'}</span></div>${overview?`<p class="spread-question">${escapeHTML(overview.question)}</p><p class="spread-reading"><span>${language==='zh'?'怎么看':'How to read'}</span>${escapeHTML(overview.reading)}</p>`:`<p>${escapeHTML(data.description)}</p>`}</div></a>`;
 }).join('')}</div>`;
}

function indexPage(articles,language,verification,catalog) {
 const text=LABELS[language],pathname=learningPath(language);
 const headings=[text.guideHeading,text.spreadHeading,text.cardHeading],descriptions=[text.guideDescription,text.spreadDescription,text.cardDescription],eyebrows=['START WITH CURIOSITY','A PLACE FOR EVERY QUESTION','THE MAJOR ARCANA'];
 return head(language,text.index,language==='zh'?'八篇入门指南、十一种牌阵、二十二张大阿尔卡那。认识牌义，为你的问题选择合适的牌阵。':'Eight beginner guides, eleven spreads and twenty-two Major Arcana notes. Understand the cards and choose a spread for your question.',pathname,{zh:learningPath('zh'),en:learningPath('en')},verification)+header(language)+`<main id="content" class="collection-main"><section class="collection-hero"><div><p class="eyebrow">${text.kicker}</p><h1>${text.hero.split('\n').map(escapeHTML).join('<br>')}</h1><figure class="hero-quote"><blockquote><p>“${escapeHTML(LIBRARY_QUOTE[language])}”</p></blockquote><figcaption><a href="${LIBRARY_QUOTE.url}" target="_blank" rel="noopener noreferrer">— ${LIBRARY_QUOTE.author}</a>${language==='zh'?'<small>译文</small>':''}</figcaption></figure></div>${heroArt(catalog)}</section><nav class="category-nav" aria-label="${language==='zh'?'学习分类':'Library chapters'}">${CATEGORIES.map((category,n)=>`<a href="#${category}" data-chapter-link="${category}"><span class="chapter-no">0${n+1}</span><span>${text.categories[n]}</span><small>${String(articles.filter(a=>a.category===category).length).padStart(2,'0')}</small></a>`).join('')}</nav><div id="collection">${CATEGORIES.map((category,n)=>{
  const group=articles.filter(a=>a.category===category),isCards=category==='card-meanings';return `<section class="collection-section${isCards?' card-section':''}" id="${category}" data-chapter><div class="section-heading"><div><p class="eyebrow">${eyebrows[n]}</p><h2>${headings[n]}</h2>${!isCards?`<p class="section-description">${descriptions[n]}</p>`:''}</div>${isCards?deckPicker(language,catalog):!isCards?`<span class="quiet-count">${String(group.length).padStart(2,'0')} ${language==='zh'?(category==='spreads'?'种牌阵':'篇指南'):(category==='spreads'?'SPREADS':'GUIDES')}</span>`:''}</div>${isCards?majorGrid(group,language,catalog):category==='spreads'?spreadGrid(group,language,catalog):`<div class="guide-grid">${group.map((a,i)=>articleRow(a,language,i+1)).join('')}</div>`}</section>`;
 }).join('')}</div></main>`+footer(language);
}

function referencesSection(article,language) {
 if(!article.references?.length) return '';
 return `<section class="article-references" id="references" aria-labelledby="references-title"><p class="eyebrow">SOURCES &amp; READING</p><h2 id="references-title">${LABELS[language].references}</h2><ol>${article.references.map(reference=>{
  // Only public bibliographic fields are selected; editorial paths never enter HTML.
  const url=reference.url&&safeURL(reference.url),link=url?.startsWith('https:')?url:null;
  const title=`<cite>${escapeHTML(reference.title)}</cite>`;
  return `<li><p class="reference-book"><span>${escapeHTML(reference.author)}</span> · ${link?`<a href="${escapeHTML(link)}" target="_blank" rel="noopener noreferrer">${title} ↗</a>`:title} <span>(${escapeHTML(reference.year)})</span></p><p class="reference-chapter">${escapeHTML(reference.chapter)}</p><p class="reference-relation">${escapeHTML(reference.relation[language])}</p></li>`;
 }).join('')}</ol></section>`;
}

function articlePage(article,articles,language,verification,catalog,advertising) {
 const text=LABELS[language],data=article[language],rendered=renderMarkdown(data.body,{language}),pathname=learningPath(language,article.slug),categoryIndex=CATEGORIES.indexOf(article.category),isCard=article.category==='card-meanings';
 const related=article.related.map(id=>articles.find(a=>a.id===id)),card=isCard?catalog.majors.find(item=>item.cardId===article.cardId):null;
 const illustration=isCard?`${deckImage(article.cardId,catalog,{alt:card.name[language],loading:'eager'})}<small>${escapeHTML(card.name.en)}</small>`:`${spreadDiagram(article.spreadKey)}<small>TAROT ORACLE</small>`;
 const schema={"@context":"https://schema.org","@type":"Article",headline:data.title,description:data.description,inLanguage:language==='zh'?'zh-Hans':'en',mainEntityOfPage:ORIGIN+pathname,publisher:{'@type':'Organization',name:'Tarot Oracle'}};
 return head(language,data.title,data.description,pathname,{zh:learningPath('zh',article.slug),en:learningPath('en',article.slug)},verification)+header(language,article.slug)+`<main id="content" class="article-main"><div class="article-breadcrumbs"><a class="breadcrumb" href="${learningPath(language)}">${text.index}</a><span aria-hidden="true"> / </span><a class="breadcrumb" href="${learningPath(language)}#${article.category}">${text.categories[categoryIndex]}</a></div><div class="article-heading"><div><p class="eyebrow">${isCard?'THE MAJOR ARCANA':article.category==='spreads'?'THE ART OF THE SPREAD':'THE FIRST CHAPTER'}</p><h1>${escapeHTML(data.title)}</h1><p class="article-description">${escapeHTML(data.description)}</p><span class="article-meta">${language==='zh'?'塔罗神谕 · 学习手记':'TAROT ORACLE · FIELD NOTES'}</span></div><aside class="article-illustration">${illustration}</aside></div><div class="reading-layout"><aside class="article-aside"><details class="toc" open><summary>${text.contents}</summary><nav aria-label="${text.contents}">${rendered.headings.filter(h=>h.level===2).map((h,i)=>`<a href="#${h.id}"><small>${String(i+1).padStart(2,'0')}</small><span>${escapeHTML(h.title)}</span></a>`).join('')}${article.references?.length?`<a href="#references"><small>✦</small><span>${text.references}</span></a>`:''}</nav></details></aside><div class="reading-content"><article class="article-body">${rendered.html}</article>${referencesSection(article,language)}</div></div>${articleAdPlaceholder(advertising.publisherId,advertising.articleSlot,language)}${related.length?`<section class="related-section"><p class="eyebrow">${text.related}</p>${related.map((a,i)=>articleRow(a,language,i+1)).join('')}</section>`:''}<section class="reading-invitation"><span aria-hidden="true">✦</span><p>${text.explore}</p><a class="reading-cta" data-return-reading href="/?start=1&amp;lang=${language}">${RETURN_ICON}${text.cta}</a></section></main><script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script>`+footer(language);
}

export async function readArticles(root=ROOT) {
 const dir=path.join(root,'content/learning');
 const files=(await readdir(dir)).filter(name=>name.endsWith('.json')).sort();
 const articles=validateArticles(await Promise.all(files.map(async name=>JSON.parse(await readFile(path.join(dir,name),'utf8')))));
 validateLearningCoverage(articles,await readLearningCatalog(root));
 return articles;
}

export async function buildLearningSite({root=ROOT,outputDir,articles,publisherId='',articleSlot='',baseSitemap}={}) {
 if(!outputDir) throw new Error('Learning output directory required');
 const collection=validateArticles(articles||await readArticles(root));
 const verification=adSenseVerification(publisherId),pages=[],catalog=await readLearningCatalog(root);
 await mkdir(outputDir,{recursive:true});
 for(const asset of ['select-fit.js','learning.css','learning.js','typography.css','icon-192.png']) await cp(path.join(root,asset),path.join(outputDir,asset));
 await cp(path.join(root,'fonts'),path.join(outputDir,'fonts'),{recursive:true});
 await writeFile(path.join(outputDir,'learning-decks.json'),JSON.stringify({majors:catalog.majors,decks:catalog.decks}));
 const usedCardIds=[...new Set([2,17,19,...collection.filter(article=>article.category==='card-meanings').map(article=>article.cardId)])];
 for(const deck of catalog.decks) for(const cardId of usedCardIds){
  const src=deck.images[cardId],target=path.resolve(outputDir,'.'+src);
  if(!target.startsWith(path.resolve(outputDir)+path.sep)) throw new Error('Image output escaped its directory');
  await mkdir(path.dirname(target),{recursive:true});await cp(path.resolve(root,'.'+src),target);
 }
 for(const language of ['zh','en']) {
  const write=async(slug,html)=>{
   const url=learningPath(language,slug),target=path.resolve(outputDir,'.'+url,'index.html');
   if(!target.startsWith(path.resolve(outputDir)+path.sep)) throw new Error('Learning output escaped its directory');
   await mkdir(path.dirname(target),{recursive:true});await writeFile(target,html);pages.push(url);
  };
  await write('',indexPage(collection,language,verification,catalog));
  for(const a of collection) await write(a.slug,articlePage(a,collection,language,verification,catalog,{publisherId,articleSlot}));
 }
 const previous=baseSitemap??await readFile(path.join(root,'sitemap.xml'),'utf8');
 const existing=[...previous.matchAll(/<loc>(.*?)<\/loc>/g)].map(match=>match[1]).filter(url=>!/^https:\/\/www\.tarot-oracle-from-joy\.top\/(zh|en)\/learn\//.test(url));
 const old=[...new Set(existing)].map(url=>`<url><loc>${escapeHTML(url)}</loc></url>`);
 const pairs=['',...collection.map(a=>a.slug)].flatMap(slug=>['zh','en'].map(lang=>`<url><loc>${ORIGIN}${learningPath(lang,slug)}</loc><xhtml:link rel="alternate" hreflang="zh-Hans" href="${ORIGIN}${learningPath('zh',slug)}"/><xhtml:link rel="alternate" hreflang="en" href="${ORIGIN}${learningPath('en',slug)}"/></url>`));
 const sitemap=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${[...old,...pairs].join('\n')}\n</urlset>\n`;
 await writeFile(path.join(outputDir,'sitemap.xml'),sitemap);
 return {pages,articles:collection.length};
}
