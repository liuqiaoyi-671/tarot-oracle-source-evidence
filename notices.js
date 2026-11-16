(function () {
  'use strict';

  const storageKey = 'tarot-notices-read';
  const feedbackURL = 'https://v.wjx.cn/vm/PuL6T9j.aspx';
  const copy = {
    zh: {
      heading: '公告', close: '关闭公告', unread: '有未读公告',
      feedback: '提交反馈',
      invitation: '遇到问题，或有希望改进的地方，欢迎告诉我们。优质反馈经审核后，可获赠 5 次免费解读。'
    },
    en: {
      heading: 'Announcements', close: 'Close announcements', unread: 'Unread announcements',
      feedback: 'Share feedback',
      invitation: 'Found a problem or have an idea for improvement? Let us know. Helpful feedback may receive 5 free readings after review.'
    }
  };
  const boundTriggers = new WeakSet();
  let dialog;
  let body;
  let closeButton;
  let heading;
  let returnFocus;
  let read = Object.create(null);
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) Object.assign(read, saved);
  } catch (_) { /* Private browsing or corrupt storage must not prevent opening notices. */ }

  function language() {
    return document.documentElement.lang.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  }

  function notices() {
    return (Array.isArray(window.TAROT_NOTICES) ? window.TAROT_NOTICES : [])
      .slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  function node(tag, className, value) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value !== undefined) element.textContent = value;
    return element;
  }

  function addText(element, text, emphasis) {
    const position = text.indexOf(emphasis);
    if (position < 0) { element.textContent = text; return; }
    element.append(document.createTextNode(text.slice(0, position)),
      node('strong', '', emphasis), document.createTextNode(text.slice(position + emphasis.length)));
  }

  function dateLabel(date, locale) {
    const parts = date.split('-');
    return locale === 'zh' ? `${Number(parts[1])} 月 ${Number(parts[2])} 日` :
      new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
  }

  function restoreFocus() {
    let target = returnFocus;
    if (target && target.closest('details') && !target.closest('details').open) {
      target = target.closest('details').querySelector('summary');
    }
    if (!target || !target.isConnected || !target.getClientRects().length) target = document.getElementById('notice-summary');
    if (target) target.focus({ preventScroll: true });
    returnFocus = null;
  }

  function ensureDialog() {
    if (dialog) return;
    dialog = node('dialog', 'notice-dialog');
    dialog.id = 'notice-dialog';
    dialog.setAttribute('aria-labelledby', 'notice-heading');
    const toolbar = node('div', 'notice-toolbar');
    heading = node('h2');
    heading.id = 'notice-heading';
    closeButton = node('button', 'notice-close', '×');
    closeButton.id = 'notice-close';
    closeButton.type = 'button';
    closeButton.addEventListener('click', () => dialog.close());
    toolbar.append(heading, closeButton);
    body = node('div', 'notice-body');
    body.id = 'notice-body';
    dialog.append(toolbar, body);
    dialog.addEventListener('close', restoreFocus);
    document.body.append(dialog);
  }

  function renderNotices() {
    const locale = language();
    const words = copy[locale];
    const entries = notices();
    const summary = document.getElementById('notice-summary');
    const menu = document.getElementById('btn-notices');
    const title = document.getElementById('notice-summary-title');
    const unread = entries.some(entry => String(read[entry.id]) !== String(entry.revision));
    for (const trigger of [summary, menu]) {
      if (!trigger) continue;
      trigger.hidden = entries.length === 0;
      trigger.setAttribute('aria-haspopup', 'dialog');
      trigger.setAttribute('aria-controls', 'notice-dialog');
      if (!boundTriggers.has(trigger)) {
        trigger.addEventListener('click', openNotices);
        boundTriggers.add(trigger);
      }
    }
    if (menu) menu.textContent = `✦ ${words.heading}`;
    const label = document.getElementById('notice-summary-label');
    if (label) label.textContent = words.heading;
    if (title && entries.length) title.textContent = `${dateLabel(entries[0].date, locale)}｜${entries[0].title[locale]}`;
    if (summary) summary.setAttribute('aria-label', `${words.heading}${unread ? ` · ${words.unread}` : ''}${entries.length ? ` · ${entries[0].title[locale]}` : ''}`);
    const dot = document.getElementById('notice-unread');
    if (dot) { dot.hidden = !unread; dot.setAttribute('aria-hidden', 'true'); }
    ensureDialog();
    const focusedId = dialog.contains(document.activeElement) ? document.activeElement.id : '';
    const scrollTop = body.scrollTop;
    heading.textContent = `☽ ${words.heading} ☾`;
    closeButton.setAttribute('aria-label', words.close);
    dialog.lang = locale === 'zh' ? 'zh-CN' : 'en';
    const content = document.createDocumentFragment();
    entries.forEach(entry => {
      const article = node('article', 'notice-article');
      article.dataset.noticeId = entry.id;
      const time = node('time', 'notice-date', dateLabel(entry.date, locale));
      time.dateTime = entry.date;
      article.append(time, node('h3', 'notice-title', entry.title[locale]));
      entry.paragraphs[locale].forEach(text => {
        const paragraph = node('p');
        addText(paragraph, text, locale === 'zh' ? '3 次解读额度' : '3 reading credits');
        article.append(paragraph);
      });
      content.append(article);
    });
    const footer = node('footer', 'notice-feedback');
    const link = node('a', '', `✦ ${words.feedback}`);
    link.id = 'notice-feedback';
    link.href = feedbackURL;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    const invitation = node('p');
    addText(invitation, words.invitation, locale === 'zh' ? '5 次免费解读' : '5 free readings');
    footer.append(link, invitation);
    content.append(footer);
    body.replaceChildren(content);
    if (focusedId) {
      const focus = document.getElementById(focusedId);
      if (focus && dialog.contains(focus)) focus.focus({ preventScroll: true });
    }
    body.scrollTop = scrollTop;
  }

  function openNotices(trigger) {
    renderNotices();
    if (!notices().length || dialog.open) return;
    returnFocus = trigger && trigger.currentTarget ? trigger.currentTarget :
      trigger && typeof trigger.focus === 'function' ? trigger : document.activeElement;
    dialog.showModal();
    closeButton.focus({ preventScroll: true });
    notices().forEach(entry => { read[entry.id] = String(entry.revision); });
    try { localStorage.setItem(storageKey, JSON.stringify(read)); } catch (_) { /* Keep the session's read state in memory. */ }
    renderNotices();
  }

  window.renderNotices = renderNotices;
  window.openNotices = openNotices;
  function init() {
    renderNotices();
    new MutationObserver(renderNotices).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
