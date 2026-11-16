import { getUser, json } from '../../../lib/auth.js';
import { publicConfig, sandboxUserAllowed } from '../../../lib/paypal.js';
export async function onRequestGet({ request, env }) {
  const config = publicConfig(env,request);
  if (config.enabled && config.sandbox) {
    try { config.enabled = sandboxUserAllowed(env,await getUser(request,env)); }
    catch { config.enabled = false; }
  }
  return json(config);
}
