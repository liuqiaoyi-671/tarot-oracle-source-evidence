// analytics.js — 轻量行为埋点（前端）
// 目标：记录每位访客的旅程（到哪一步、停留多久），匿名可用，绝不影响主站。
// 用法：其它脚本调用  window.track('stage', {可选meta})  即可。
// 关键事件在 app.js 各流程节点埋入；landing/exit 由本文件自动处理。
(function () {
  // 微信内置浏览器会被 index.html 直接改写为提示页，不做埋点，避免噪声
  if (/MicroMessenger/i.test(navigator.userAgent)) { window.track = function () {}; return; }

  var ANON_KEY = 'tarot-anon';
  var SES_KEY = 'tarot-ses';

  function uuid() {
    try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function ls(key, gen) {
    try {
      var v = localStorage.getItem(key);
      if (!v) { v = gen(); localStorage.setItem(key, v); }
      return v;
    } catch (e) { return gen(); }
  }
  function ss(key, gen) {
    try {
      var v = sessionStorage.getItem(key);
      if (!v) { v = gen(); sessionStorage.setItem(key, v); }
      return v;
    } catch (e) { return gen(); }
  }

  var anon = ls(ANON_KEY, uuid);          // 跨会话持久 → 识别回访
  var session = ss(SES_KEY, uuid);        // 一次访问（标签页会话）
  var device = (window.innerWidth <= 600) ? 'mobile' : 'desktop';
  function curLang() {
    try { if (typeof lang !== 'undefined' && lang) return lang; } catch (e) {}
    return (navigator.language || '').toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en';
  }
  function refHost() {
    try { return document.referrer ? new URL(document.referrer).host : ''; } catch (e) { return ''; }
  }
  var ref = refHost();

  var queue = [];
  var flushTimer = null;

  function send(useBeacon) {
    if (!queue.length) return;
    var batch = queue.splice(0, queue.length);
    var payload = JSON.stringify({
      anon_id: anon, session_id: session, ref: ref, device: device, lang: curLang(), events: batch
    });
    try {
      if (useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon('/api/track', new Blob([payload], { type: 'application/json' }));
        return;
      }
    } catch (e) {}
    try {
      fetch('/api/track', {
        method: 'POST', credentials: 'same-origin', keepalive: true,
        headers: { 'content-type': 'application/json' }, body: payload
      }).catch(function () {});
    } catch (e) {}
  }

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(function () { flushTimer = null; send(false); }, 2000);
  }

  // 对外主 API
  window.track = function (stage, meta) {
    if (!stage) return;
    queue.push({ ts: Date.now(), stage: String(stage), meta: meta || undefined });
    if (queue.length >= 10) { if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; } send(false); }
    else scheduleFlush();
  };

  // 离开/切后台：用 sendBeacon 补发一条 exit（用于收尾最后一个阶段的停留时长），并刷掉队列
  var exited = false;
  function onLeave() {
    if (exited) return;
    exited = true;
    queue.push({ ts: Date.now(), stage: 'exit' });
    send(true);
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') onLeave();
    else exited = false; // 回到前台，允许下次再记一次 exit
  });
  window.addEventListener('pagehide', onLeave);

  // 落地：一次访问首个事件（同一会话内刷新不重复记 landing）
  var landed = ss('tarot-landed', function () { return ''; });
  if (!landed) {
    try { sessionStorage.setItem('tarot-landed', '1'); } catch (e) {}
    window.track('landing', {
      deck: (window.__deckStyle || ''),
      w: window.innerWidth, h: window.innerHeight
    });
  }
})();
