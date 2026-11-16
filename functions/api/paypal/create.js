import { handle, createOrder } from '../../../lib/paypal.js';
export function onRequestPost({ request, env }) { return handle(createOrder,request,env); }
