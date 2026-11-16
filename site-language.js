// Shared language preference for public guides and the payment return page.
(() => {
  let language = 'en';
  try { language = localStorage.getItem('tarot-language') === 'zh' ? 'zh' : 'en'; } catch {}
  const requested = new URLSearchParams(location.search).get('lang');
  if (['en','zh'].includes(requested)) { language = requested; try { localStorage.setItem('tarot-language',language); } catch {} }
  window.siteText = (en, zh) => language === 'zh' ? zh : en;
  function apply() {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    document.querySelectorAll('[data-en][data-zh]').forEach(el => { el.textContent = el.dataset[language]; });
    document.title = (document.querySelector('h1')?.textContent || 'Tarot Oracle') + ' · Tarot Oracle';
    document.querySelectorAll('[data-language-section]').forEach(el => { el.hidden = el.dataset.languageSection !== language; });
    document.querySelectorAll('[data-learning-link]').forEach(link => {
      link.href = `/${language}/learn/`;
      link.textContent = language === 'zh' ? '塔罗学习 ↗' : 'Learn ↗';
    });
  }
  apply();
  const nav = document.querySelector('header nav') || document.querySelector('header');
  if (nav) {
    const button = document.createElement('button');
    button.className = 'language-switch';
    button.textContent = language === 'zh' ? 'English' : '中文';
    button.setAttribute('aria-label', 'Change language');
    button.onclick = () => {
      language = language === 'zh' ? 'en' : 'zh';
      try { localStorage.setItem('tarot-language', language); } catch {}
      const url = new URL(location.href); if (url.searchParams.has('lang')) { url.searchParams.set('lang',language); history.replaceState(null,'',url); }
      apply(); button.textContent = language === 'zh' ? 'English' : '中文';
      window.dispatchEvent(new Event('site-language-change'));
    };
    nav.appendChild(button);
  }
})();
