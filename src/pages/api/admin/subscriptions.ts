import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { requireAdmin } from '../../../lib/admin-auth';
import { getSubscriptionByCode, setSubscriptionStatus } from '../../../lib/db/subscriptions';
import { disableSubscription } from '../../../lib/paystack/client';

export const POST: APIRoute = async ({ request }) => {
  const auth = requireAdmin(request, env, import.meta.env.DEV);
  if ('response' in auth) return auth.response;
  const form = await request.formData();
  const code = String(form.get('code') ?? '');
  if (String(form.get('_action')) === 'cancel' && code) {
    const sub = await getSubscriptionByCode(env.DB, code).catch(() => null);
    if (sub?.subscription_code && sub.email_token) {
      const res = await disableSubscription(
        { code: sub.subscription_code, token: sub.email_token },
        { secret: env.PAYSTACK_SECRET_KEY ?? '' },
      );
      if (res.ok) await setSubscriptionStatus(env.DB, code, 'cancelled');
    }
  }
  return new Response(null, { status: 303, headers: { Location: '/admin/subscriptions' } });
};
