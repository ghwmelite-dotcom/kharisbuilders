import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { requireAdmin } from '../../../lib/admin-auth';
import { setGroupInterestStatus, deleteGroupInterest, type GroupInterestStatus } from '../../../lib/db/group-interests';

const STATUSES = new Set<GroupInterestStatus>(['new', 'contacted', 'done']);

export const POST: APIRoute = async ({ request }) => {
  const auth = requireAdmin(request, env, import.meta.env.DEV);
  if ('response' in auth) return auth.response;
  const form = await request.formData();
  const id = Number(form.get('id'));
  const action = String(form.get('action') ?? '');
  if (Number.isInteger(id) && id > 0) {
    if (action === 'delete') await deleteGroupInterest(env.DB, id);
    else if (action === 'status') {
      const value = String(form.get('value') ?? '') as GroupInterestStatus;
      if (STATUSES.has(value)) await setGroupInterestStatus(env.DB, id, value);
    }
  }
  return new Response(null, { status: 303, headers: { Location: '/admin/group-interests' } });
};
