import { sendMail } from './mail.js';

const SITE = 'https://www.tarot-oracle-from-joy.top';

function body(message) {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:auto;padding:24px;line-height:1.8;color:#333"><h2 style="color:#b8860b">塔罗神谕 · Tarot Oracle</h2><p>你好，感谢你填写反馈问卷！</p>${message}<p>我正在根据大家的建议持续改进网站。如果有后续更新，也会通过邮件与你分享，欢迎持续关注。</p><p><a href="${SITE}">进入塔罗神谕</a></p></div>`;
}

export async function sendGrantedRewardNotice(env, email, rewardKey) {
  const claim = await env.DB.prepare("UPDATE feedback_rewards SET mail_status='sending' WHERE reward_key=? AND mail_status='pending'").bind(rewardKey).run();
  if (!claim.meta.changes) return;
  try {
    await sendMail(env, email, '【塔罗神谕】反馈问卷奖励已到账', body('<p>你的账号已获得 <strong>5 次解读额度</strong>，登录后即可查看和使用。</p>'));
    await env.DB.prepare("UPDATE feedback_rewards SET mail_status='sent',mailed_at=? WHERE reward_key=?").bind(Date.now(), rewardKey).run();
  } catch {
    // 发信超时可能已投递；保留人工核对状态，避免自动重发。
    await env.DB.prepare("UPDATE feedback_rewards SET mail_status='review' WHERE reward_key=? AND mail_status='sending'").bind(rewardKey).run();
  }
}

export async function sendReservedRewardNotice(env, email, rewardKey) {
  const claim = await env.DB.prepare("UPDATE pending_feedback_rewards SET mail_status='sending' WHERE reward_key=? AND mail_status='pending'").bind(rewardKey).run();
  if (!claim.meta.changes) return;
  try {
    await sendMail(env, email, '【塔罗神谕】你的反馈问卷奖励已预留', body('<p>我们已为这个邮箱预留 <strong>5 次解读额度</strong>。请用这个邮箱在网站注册并完成邮箱验证；验证成功后，奖励会自动到账。</p><p>如果你已有账号，请确认反馈问卷填写的邮箱与账号邮箱一致。</p>'));
    await env.DB.prepare("UPDATE pending_feedback_rewards SET mail_status='sent',mailed_at=? WHERE reward_key=?").bind(Date.now(), rewardKey).run();
  } catch {
    await env.DB.prepare("UPDATE pending_feedback_rewards SET mail_status='review' WHERE reward_key=? AND mail_status='sending'").bind(rewardKey).run();
  }
}
