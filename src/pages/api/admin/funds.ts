import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { requireAdmin } from '../../../lib/admin-auth';
import { FundInputSchema } from '../../../lib/db/schemas';
import { createFund, updateFund, deleteFund, setFundActive } from '../../../lib/db/funds';

export const POST: APIRoute = async ({ request }) => {
  const auth = requireAdmin(request, env, import.meta.env.DEV);
  if ('response' in auth) return auth.response;
  const form = await request.formData();
  const action = String(form.get('_action') ?? '');
  const id = Number(form.get('id') ?? 0);
  try {
    if (action === 'delete') {
      await deleteFund(env.DB, id);
    } else if (action === 'toggle') {
      await setFundActive(env.DB, id, String(form.get('active')) === 'true');
    } else {
      const data = FundInputSchema.parse(Object.fromEntries(form));
      if (action === 'update') await updateFund(env.DB, id, data, auth.email);
      else await createFund(env.DB, data, auth.email);
    }
  } catch {
    return new Response('Invalid submission', { status: 400 });
  }
  return new Response(null, { status: 303, headers: { Location: '/admin/funds' } });
};
