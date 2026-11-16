import { handle, captureOrder } from '../../../lib/paypal.js';
export function onRequestPost({ request, env }) { return handle(captureOrder,request,env); }
