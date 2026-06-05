import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { requireAdmin } from '../../../lib/admin-auth';
import { setPrayerStatus, deletePrayerRequest } from '../../../lib/db/prayer-requests';

export const POST: APIRoute = async ({ request }) => {
  const auth = requireAdmin(request, env, import.meta.env.DEV);
  if ('response' in auth) return auth.response;
  const form = await request.formData();
  const id = Number(form.get('id'));
  const action = String(form.get('action') ?? '');
  if (Number.isInteger(id) && id > 0) {
    if (action === 'approve') await setPrayerStatus(env.DB, id, 'approved');
    else if (action === 'hide') await setPrayerStatus(env.DB, id, 'hidden');
    else if (action === 'delete') await deletePrayerRequest(env.DB, id);
  }
  return new Response(null, { status: 303, headers: { Location: '/admin/prayer' } });
};
