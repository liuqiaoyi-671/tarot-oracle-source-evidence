// Returning from approval is not proof of payment: only server capture can confirm it.
let lastPaymentText = null;
const paymentText = (en, zh) => { lastPaymentText = [en, zh]; return siteText(en, zh); };
window.addEventListener('site-language-change', () => {
  if (lastPaymentText) paymentStatus.textContent = paymentText(...lastPaymentText);
  if (orderId && /^[A-Z0-9]{6,40}$/.test(orderId)) document.getElementById('payment-reference').textContent = `${siteText('Order: ', '订单：')}${orderId}`;
});
const paymentStatus = document.getElementById('payment-status');
function paymentError(en, zh) { const error = new Error(siteText(en, zh)); error.translations = [en, zh]; return error; }
const paymentRetry = document.getElementById('payment-retry');
const params = new URLSearchParams(window.location.search);
const orderId = params.get('token');
let confirming = false;
async function confirmPayment() {
  if (confirming) return;
  confirming = true;
  paymentRetry.hidden = true;
  paymentStatus.textContent = paymentText('Confirming payment…', '正在确认付款…');
  try {
    if (!orderId || !/^[A-Z0-9]{6,40}$/.test(orderId)) throw paymentError('Missing order reference. Please contact support.', '缺少订单编号，请联系作者。');
    const response = await fetch('/api/paypal/capture', { method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order_id: orderId }) });
    const result = await response.json();
    if (response.status === 401) throw paymentError('Sign in to the account you used to purchase, then return to this page and retry.', '请返回网站登录购买时的账号，再回到本页重新确认。');
    if (!response.ok) throw new Error(result.error || 'Unable to confirm payment. Please retry.');
    if (result.status === 'completed') {
      paymentStatus.textContent = result.sandbox
        ? paymentText('Sandbox payment confirmed. No real charge or account credits.', '测试付款已确认，不产生真实扣款或次数。')
        : paymentText(`Payment confirmed. ${result.credits_added} credits added to your account.`, `付款成功，账号已获得 ${result.credits_added} 次解读。`);
      sessionStorage.removeItem('paypal-request-key');
      sessionStorage.removeItem('paypal-order-id');
    } else if (['refunded','reversed','review'].includes(result.status)) {
      paymentStatus.textContent = paymentText('This payment was refunded or needs review. Please contact support with the order reference.', '该付款已退款或待核查，请提供订单编号联系作者。');
      sessionStorage.removeItem('paypal-request-key');
    } else throw paymentError('Payment is not confirmed yet. Retry this order; do not pay again.', '付款尚未确认，请重试本订单，不要重复付款。');
  } catch (error) {
    lastPaymentText = error.translations || [error.message || 'Unable to confirm. Please retry.', '确认付款失败，请重试或提供订单编号联系作者。'];
    paymentStatus.textContent = paymentText(...lastPaymentText);
    paymentRetry.hidden = false;
  } finally { confirming = false; }
}
paymentRetry.addEventListener('click', confirmPayment);
if (params.get('cancelled') === '1') {
  paymentStatus.textContent = paymentText('Checkout cancelled. Return to your account to check your balance.', '已取消本次结账，可返回账号查看余额。');
  sessionStorage.removeItem('paypal-request-key');
  sessionStorage.removeItem('paypal-order-id');
} else {
  if (orderId && /^[A-Z0-9]{6,40}$/.test(orderId)) document.getElementById('payment-reference').textContent = `${siteText('Order: ', '订单：')}${orderId}`;
  confirmPayment();
}
