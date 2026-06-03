import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { verifyWebhookSignature } from '../../../lib/paystack/signature';
import { handlePaystackEvent, type PaystackEvent } from '../../../lib/giving/webhook-handler';

export const POST: APIRoute = async ({ request }) => {
  const raw = await request.text();
  const signature = request.headers.get('x-paystack-signature') ?? '';
  const secret = env.PAYSTACK_SECRET_KEY ?? '';
  if (!(await verifyWebhookSignature(raw, signature, secret))) {
    return new Response('Invalid signature', { status: 401 });
  }
  let event: PaystackEvent;
  try {
    event = JSON.parse(raw) as PaystackEvent;
  } catch {
    return new Response('Bad payload', { status: 400 });
  }
  await handlePaystackEvent(env.DB, event);
  return new Response('ok', { status: 200 });
};
