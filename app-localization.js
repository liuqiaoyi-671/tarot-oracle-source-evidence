// UI-only translations. Saved questions and AI answers remain in their original language.
const DECK_NAMES_EN = Object.fromEntries(Object.entries(DECK_TITLES).map(([key,value])=>[key,value.en]));
const localeOriginals = new WeakMap();
function localeText(selector, english, attribute) {
  document.querySelectorAll(selector).forEach(el => {
    let values = localeOriginals.get(el);
    if (!values) { values = {}; localeOriginals.set(el, values); }
    const key = attribute || 'html';
    if (!(key in values)) values[key] = attribute ? el.getAttribute(attribute) : el.innerHTML;
    const value = lang === 'zh' ? values[key] : english;
    if (attribute) el.setAttribute(attribute, value || ''); else el.innerHTML = value;
  });
}
window.applyAppLocale = function () {
  const currentURL = new URL(location.href);
  if (currentURL.searchParams.has('lang') && currentURL.searchParams.get('lang') !== lang) { currentURL.searchParams.set('lang',lang); history.replaceState(null,'',currentURL); }
  document.title = t('Tarot Oracle — Draw, reflect, explore', '塔罗神谕 · Tarot Oracle');
  localeText('meta[name=description]', 'Explore tarot with six decks, card references and AI-assisted readings. Draw cards, reflect on your choices and ask follow-up questions.', 'content');
  const labels = {
    '.header-title':'☽ TAROT ORACLE ☾',
    '#panel-gallery > div:first-child > div:first-child':'✦ Card gallery ✦',
    '#panel-gallery > div:first-child > div:last-child':'Explore six decks. Select a deck to preview its Major Arcana.',
    '#settings-modal .modal-label:not([id]):first-of-type':'Card artwork',
    '#modal-lbl-backup':'Back up your settings',
    '#deck-preview-link':'Explore the decks →',
    '#official-section > .modal-hint':'Use Tarot Oracle’s built-in reading service with no API setup. Start with free readings. In-depth English readings are included in your usual allowance. International purchases are coming soon.',
    '#official-login-btn':'Log in / Sign up',
    '#official-recharge-btn':'Credits & plans',
    '#official-verify-btn':'Verify email for free readings',
    '#model-section > .modal-hint':'Model quality, speed and cost vary. Check your provider’s pricing before using your own key.',
    '[onclick="exportSettings()"]':'⬆ Export settings',
    '[onclick="importSettings()"]':'⬇ Import settings',
    '#ai-engine-select option[value=official]':'Tarot Oracle · free readings included',
    '#ai-engine-select option[value=zhipu]':'GLM (Zhipu)',
    '#ai-engine-select option[value=qwen]':'Qwen',
    '#ai-engine-select option[value=doubao]':'Doubao',
    '#ai-engine-select option[value=custom]':'Custom provider (OpenAI-compatible)',
    '.qr-fallback':'QR code unavailable',
    '#auth-forgot-row a':'Forgot password?',
    '#verify-title':'Verify your email',
    '#verify-submit':'Verify email',
    '#verify-later':'Not now',
  };
  for (const [selector, value] of Object.entries(labels)) localeText(selector, value);
  const headings = document.querySelectorAll('#settings-modal .modal-label:not([id])');
  headings.forEach((el, index) => { if (!el.id) el.id = 'locale-setting-label-' + index; });
  localeText('#locale-setting-label-0','Card artwork');
  localeText('#locale-setting-label-1','Reading voice');
  for (const [key,names] of Object.entries(DECK_TITLES)) { const button = document.querySelector(`.deck-style-btn[data-style="${key}"]`); if (button) button.textContent = t(names.en,names.zh); }
  for (const [key,persona] of Object.entries(PERSONAS)) localeText(`.persona-btn[data-persona="${key}"]`, persona.labelEN);
  for (const [href,label] of Object.entries({'/guides.html':'Guides','/about.html':'About','/privacy.html':'Privacy','/contact.html':'Contact'})) localeText(`a[href="${href}"]`, label);
  localeText('#ai-engine-select optgroup','Advanced: use your own API key','label');
  localeText('#api-key-eye','Show or hide API key','title');
  localeText('#auth-pw-toggle','Show or hide password','aria-label');
  localeText('#auth-pw-toggle','Show or hide password','title');
  localeText('#verify-code','6-digit email code','placeholder');
  localeText('.modal-close,[onclick="closeAuth()"],[onclick="closeVerify()"],[onclick="closeRecharge()"]','Close','aria-label');
  localeText('#btn-help','Help','title');
  localeText('.settings-btn','Settings','aria-label');
  document.getElementById('language-switch').textContent = lang === 'zh' ? 'English' : '中文';
  document.getElementById('language-switch').setAttribute('aria-label', lang === 'zh' ? '切换语言' : 'Switch language');
  const footer = document.querySelector('body > footer');
  if (footer) {
    [...footer.childNodes].filter(n => n.nodeType === 3 && (n._original || n.textContent.includes('小红书'))).forEach(n => {
      if (!n._original) n._original = n.textContent;
      n.textContent = lang === 'zh' ? n._original : '';
    });
  }
};

function localizedError(message, code, status) {
  if (lang === 'zh' || !/[\u3400-\u9fff]/.test(message || '')) return message || `Request failed (${status || 'unknown'}). Please try again.`;
  const exact = {
    '邮箱或密码不正确':'The email or password is incorrect.',
    '邮箱格式不正确':'Enter a valid email address.',
    '密码至少 8 位':'Use a password with at least 8 characters.',
    '密码过长':'This password is too long. Use no more than 200 characters.',
    '该邮箱未注册':'No account was found for this email.',
    '该邮箱已注册，请直接登录':'This email is already registered. Please log in.',
    '请输入 6 位验证码':'Enter the 6-digit verification code.',
    '验证码无效、已使用或已过期，请重新获取':'This code is invalid, used or expired. Request a new code.',
    '请等待 60 秒后再获取验证码':'Wait 60 seconds before requesting another code.',
    '验证码发送失败，请稍后再试':'We couldn’t send the code. Please try again later.',
    '登录尝试过于频繁，请 10 分钟后再试':'Too many sign-in attempts. Try again in 10 minutes.',
    '请先登录':'Please log in to continue.',
  };
  if (exact[message]) return exact[message];
  const codes = {NEED_LOGIN:'Please log in to continue.',EXISTS:'This email is already registered. Please log in.',REG_LIMIT:'Today’s registration limit has been reached. Log in or try again tomorrow.',NO_CREDITS:'No reading credits left. View plans or use your own API key.',MEMBER_CAP:'Your daily reading allowance has been used. Please return tomorrow.',GUEST_LIMIT:'Your free guest allowance has been used. Sign in to continue.',UPSTREAM_FAILED:'The reading service is temporarily unavailable. Your allowance was restored; please retry.',STREAM_FAILED:'The reading was interrupted and your allowance was restored. Please retry.',REQUEST_FINISHED:'This request has ended. Please start a new attempt.'};
  if (codes[code]) return codes[code];
  if (status === 429) return 'Too many requests. Please wait and try again.';
  return 'We couldn’t complete this request. Please try again or contact support' + (status ? ` (HTTP ${status})` : '') + '.';
}
// Run after all app state and the initial English guide markup are available.
const requestedLanguage = new URLSearchParams(location.search).get('lang');
setLang(['en','zh'].includes(requestedLanguage) ? requestedLanguage : lang);

window.refreshReadingLocale = function () {
  // Translate reference UI without redrawing cards, regenerating answers or charging credits.
  drawnEntries.forEach((entry, index) => {
    const slot = document.getElementById('sel-slot-' + index);
    const pos = slot?.querySelector('.sel-pos-label');
    if (pos) pos.textContent = t(entry.position.en, entry.position.cn);
    const name = slot?.querySelector('.cf-name-label');
    if (name) name.textContent = t(entry.card.name, entry.card.nameCN) + (entry.reversed ? t(' (Reversed)','（逆位）') : '');
    const old = document.getElementById('rcb-' + index);
    if (old) {
      old.id = 'locale-old-card-' + index;
      appendReading(index);
      old.replaceWith(document.getElementById('rcb-' + index));
    }
  });
  const labels = [
    ['.reading-divider',t('· · ✦ YOUR INTERPRETATION ✦ · ·','· · ✦ 神谕开口 ✦ · ·')],
    ['#summary-block > h3',t('✦ Your interpretation','✦ 神谕解读')],
    ['.back-to-cards-btn:nth-of-type(1)',t('↑ Back to cards','↑ 回到牌面')],
  ];
  for (const [selector,text] of labels) document.querySelectorAll(selector).forEach(el=>{el.textContent=text;});
  document.querySelectorAll('#readings-output > .save-reading-btn').forEach(el=>{
    if (el.id === 'save-reading-btn-main') el.textContent = _currentReadingSaved ? t('✓ Saved · click to update','✓ 已保存 · 点击更新') : t('Save reading','保存此次占卜');
    else if (el.onclick === rereadCurrentCards) el.textContent = t('↻ Read again with current settings','↻ 用当前设置重新解读');
    else if (el.onclick === resetReading) el.textContent = t('↺ New reading','↺ 重新占卜');
  });
  document.querySelectorAll('.back-to-cards-btn').forEach(el=>{ if(el.onclick === shareReading) el.textContent=t('⎘ Copy reading','⎘ 复制占卜'); else if(el.onclick === exportImage) el.textContent=t('⬇ Save image','⬇ 保存图片'); });
  document.querySelectorAll('.official-quota-note').forEach(el=>{el.textContent='✨ '+quotaText(currentUser);});
  document.querySelectorAll('.feedback-line').forEach(el=>{el.outerHTML=feedbackLineHTML();});
};
