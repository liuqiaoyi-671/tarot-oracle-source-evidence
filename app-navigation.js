// Public articles open over the existing reading. No draw, chat or stream is reset.
const INFO_PAGES = new Set(['/guides.html','/about.html','/privacy.html','/contact.html','/guide-questions.html','/guide-evidence.html','/guide-followups.html']);
function updateLearningLinks() {
  const language = document.documentElement.lang.startsWith('zh') ? 'zh' : 'en';
  document.querySelectorAll('[data-learning-link]').forEach(link => {
    link.href = `/${language}/learn/`;
    link.textContent = language === 'zh' ? '塔罗学习 ↗' : 'Learn ↗';
  });
}
updateLearningLinks();
new MutationObserver(updateLearningLinks).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
let infoDialog, infoLoad = 0, infoOpener;
function previewDecks() {
  closeSettings(); showPanel('gallery');
  const section = document.querySelector(`.gallery-deck-section[data-key="${window.__deckStyle}"]`);
  section?.scrollIntoView({behavior:'smooth',block:'start'});
}
function ensureInfoDialog() {
  if (infoDialog) return;
  infoDialog = document.createElement('dialog'); infoDialog.id = 'info-dialog';
  infoDialog.setAttribute('aria-label',t('Reading guides and information','指南与网站说明'));
  infoDialog.innerHTML = '<div class="info-toolbar"><button type="button" class="return-reading" id="info-return"></button><nav id="info-nav"></nav></div><div id="info-body" aria-live="polite"></div>';
  document.body.appendChild(infoDialog);
  document.getElementById('info-return').onclick = closeInfoPage;
  infoDialog.addEventListener('cancel',event=>{event.preventDefault();closeInfoPage();});
}
async function openInfoPage(path, push = true) {
  if (!INFO_PAGES.has(path)) return;
  ensureInfoDialog();
  const opening = !infoDialog.open;
  if (opening) { infoOpener = document.activeElement; infoDialog.showModal(); }
  if (push) {
    const state = {...history.state,tarotInfo:path};
    if (opening) history.pushState(state,'',location.href); else history.replaceState(state,'',location.href);
  }
  document.getElementById('info-return').textContent = t('← Back to your reading','← 返回抽牌');
  document.getElementById('info-nav').innerHTML = [['guides','Guides','指南'],['about','About','关于'],['privacy','Privacy','隐私'],['contact','Contact','联系']].map(([slug,en,zh])=>`<a href="/${slug}.html" ${path===`/${slug}.html`?'aria-current="page"':''}>${t(en,zh)}</a>`).join('');
  const body = document.getElementById('info-body'), load = ++infoLoad;
  body.textContent = t('Loading…','加载中…');
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error('Unavailable');
    const doc = new DOMParser().parseFromString(await response.text(),'text/html');
    if (load !== infoLoad || !infoDialog.open) return;
    const main = doc.querySelector('main'); if (!main) throw new Error('Missing article');
    main.querySelectorAll('script').forEach(el=>el.remove());
    main.querySelectorAll('[data-en][data-zh]').forEach(el=>{el.textContent=lang==='zh'?el.dataset.zh:el.dataset.en;});
    main.querySelectorAll('[data-language-section]').forEach(el=>{el.hidden=el.dataset.languageSection!==lang;});
    main.querySelectorAll('[data-learning-link]').forEach(link=>{
      link.href=`/${lang === 'zh' ? 'zh' : 'en'}/learn/`;
      link.textContent=lang === 'zh' ? '塔罗学习 ↗' : 'Learn ↗';
    });
    body.replaceChildren(...main.childNodes);
    infoDialog.scrollTop=0;
  } catch {
    if (load === infoLoad) body.textContent=t('This page could not be loaded. Try its link again, or return to your reading.','页面加载失败，请重新点击链接，或返回抽牌。');
  }
}
function closeInfoPage() {
  if (!infoDialog?.open) return;
  ++infoLoad; infoDialog.close(); infoOpener?.focus({preventScroll:true});
  if (document.getElementById('main').style.display !== 'flex') enterApp();
  if (history.state?.tarotInfo) history.back();
}
window.addEventListener('popstate',event=>{
  if (event.state?.tarotInfo) openInfoPage(event.state.tarotInfo,false);
  else if (infoDialog?.open) { ++infoLoad; infoDialog.close(); infoOpener?.focus({preventScroll:true}); }
});
document.addEventListener('click',event=>{
  const anchor=event.target.closest('a[href]');
  if (!anchor || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  if (anchor.id === 'btn-help' && document.getElementById('main').style.display === 'flex') { event.preventDefault(); openGuide(); return; }
  const url=new URL(anchor.href,location.href);
  if (url.origin===location.origin && INFO_PAGES.has(url.pathname)) {event.preventDefault();openInfoPage(url.pathname);}
});
if (new URLSearchParams(location.search).get('start')==='1') enterApp();
