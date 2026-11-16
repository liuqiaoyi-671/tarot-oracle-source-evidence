import { handle, webhook } from '../../../lib/paypal.js';
export function onRequestPost({ request, env }) { return handle(webhook,request,env); }
