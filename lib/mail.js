// lib/mail.js — 阿里云邮件推送 (DirectMail) SingleSendMail
// 在 Cloudflare Pages Functions 里用 Web Crypto 实现 RPC v1.0 的 HMAC-SHA1 签名。
// 所需环境变量（用 wrangler pages secret / vars 配置）：
//   ALIYUN_AK_ID      AccessKey ID        （secret）
//   ALIYUN_AK_SECRET  AccessKey Secret    （secret）
//   MAIL_ACCOUNT      发信地址，如 noreply@mail.tarot-oracle-from-joy.top（var）
//   MAIL_ALIAS        发信别名，如 塔罗神谕（var，可选）
//   MAIL_REGION       默认 cn-hangzhou（var，可选）
//   MAIL_ENDPOINT     默认 https://dm.aliyuncs.com/（var，可选）
const enc = new TextEncoder();

// 阿里云要求的百分号编码（对齐 Java URLEncoder：额外转义 ! ' ( ) *，encodeURIComponent 默认不转这几个）
function pe(s) {
  return encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}
function b64(buf) { return btoa(String.fromCharCode(...new Uint8Array(buf))); }

async function hmacSha1B64(secret, str) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(str));
  return b64(sig);
}

// 通用发信；成功返回 true，失败 throw（含阿里云错误信息）
export async function sendMail(env, toAddress, subject, htmlBody) {
  const akId = (env.ALIYUN_AK_ID || '').trim();
  const akSecret = (env.ALIYUN_AK_SECRET || '').trim();
  const account = (env.MAIL_ACCOUNT || '').trim();
  if (!akId || !akSecret || !account) throw new Error('邮件服务未配置');

  const params = {
    Format: 'JSON',
    Version: '2015-11-23',
    AccessKeyId: akId,
    SignatureMethod: 'HMAC-SHA1',
    Timestamp: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    SignatureVersion: '1.0',
    SignatureNonce: crypto.randomUUID(),
    Action: 'SingleSendMail',
    RegionId: env.MAIL_REGION || 'cn-hangzhou',
    AccountName: account,
    AddressType: '1',
    ReplyToAddress: 'false',
    ToAddress: toAddress,
    Subject: subject,
    HtmlBody: htmlBody,
  };
  if (env.MAIL_ALIAS) params.FromAlias = env.MAIL_ALIAS;

  const canonical = Object.keys(params).sort().map(k => pe(k) + '=' + pe(params[k])).join('&');
  const stringToSign = 'POST&' + pe('/') + '&' + pe(canonical);
  const signature = await hmacSha1B64(akSecret + '&', stringToSign);

  const endpoint = env.MAIL_ENDPOINT || 'https://dm.aliyuncs.com/';
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: canonical + '&Signature=' + pe(signature),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try { const j = JSON.parse(text); msg = j.Message || j.Code || text; } catch {}
    throw new Error('邮件发送失败: ' + msg);
  }
  return true;
}

// 验证码邮件模板
export function codeHtml(title, code, language = 'zh') {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#333">
    <h2 style="color:#b8860b;margin:0 0 16px">${language === 'en' ? 'Tarot Oracle' : '塔罗神谕 · Tarot Oracle'}</h2>
    <p style="font-size:15px">${title}</p>
    <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#b8860b;margin:16px 0">${code}</p>
    <p style="color:#999;font-size:13px;line-height:1.7">${language === 'en' ? 'This code expires in 10 minutes. Do not share it with anyone.<br>If you didn’t request this, you can ignore this email.' : '验证码 10 分钟内有效，请勿泄露给他人。<br>如非本人操作，请忽略本邮件。'}</p>
  </div>`;
}

// 发送 6 位注册验证码
export async function sendCodeMail(env, toAddress, code, language = 'zh') {
  if (language === 'en') return sendMail({...env, MAIL_ALIAS: 'Tarot Oracle'}, toAddress, 'Tarot Oracle — Your sign-up code', codeHtml('Use this code to create your Tarot Oracle account:', code, 'en'));
  return sendMail(env, toAddress, '【塔罗神谕】注册验证码：' + code, codeHtml('你正在注册塔罗神谕账号，验证码为：', code));
}

// 发送 6 位重置密码验证码
export async function sendResetMail(env, toAddress, code, language = 'zh') {
  if (language === 'en') return sendMail({...env, MAIL_ALIAS: 'Tarot Oracle'}, toAddress, 'Tarot Oracle — Your password reset code', codeHtml('Use this code to reset your Tarot Oracle password:', code, 'en'));
  return sendMail(env, toAddress, '【塔罗神谕】重置密码验证码：' + code, codeHtml('你正在重置塔罗神谕账号密码，验证码为：', code));
}

// 发送 6 位邮箱验证码（登录后验证邮箱，解锁更多免费额度）
export async function sendVerifyMail(env, toAddress, code, language = 'zh') {
  if (language === 'en') return sendMail({...env, MAIL_ALIAS: 'Tarot Oracle'}, toAddress, 'Tarot Oracle — Verify your email', codeHtml('Use this code to verify your Tarot Oracle email:', code, 'en'));
  return sendMail(env, toAddress, '【塔罗神谕】邮箱验证码：' + code, codeHtml('你正在验证塔罗神谕账号邮箱，验证码为：', code));
}
