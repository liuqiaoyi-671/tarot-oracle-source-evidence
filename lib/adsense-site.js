// Ownership verification only. Ad serving is a separate, explicit release step.
export function adSenseVerification(publisher = '') {
  if (!publisher) return null;
  if (!/^ca-pub-\d{16}$/.test(publisher)) throw new Error('AdSense 发布商 ID 格式不正确');
  return {
    meta: `<meta name="google-adsense-account" content="${publisher}">`,
    adsTxt: `google.com, ${publisher.replace('ca-','')}, DIRECT, f08c47fec0942fa0\n`
  };
}

// A prepared placement never loads or requests an ad while approval is pending.
export function articleAdPlaceholder(publisher, slot, language='en') {
  if (!slot) return '';
  if (!adSenseVerification(publisher) || !/^\d{10}$/.test(slot)) throw new Error('Invalid article ad identity');
  return `<aside class="article-ad" data-article-ad data-ad-state="awaiting-review" hidden aria-label="${language==='zh'?'广告':'Advertisement'}"><p class="ad-label">${language==='zh'?'广告':'Advertisement'}</p><ins class="adsbygoogle" style="display:block" data-ad-client="${publisher}" data-ad-slot="${slot}" data-ad-format="auto" data-full-width-responsive="true"></ins></aside>`;
}

export function validateAdSenseConfig(config={}) {
  const {publisherId='',articleSlot='',servingState='awaiting-review'}=config;
  adSenseVerification(publisherId);
  if (articleSlot && (!publisherId || !/^\d{10}$/.test(articleSlot))) throw new Error('Invalid article ad identity');
  // Enabling serving is a separate release after site approval and consent setup.
  if (servingState!=='awaiting-review') throw new Error('Ad serving requires a reviewed release');
  return {publisherId,articleSlot,servingState};
}
