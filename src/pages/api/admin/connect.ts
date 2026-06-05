import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { requireAdmin } from '../../../lib/admin-auth';
import { setConnectionStatus, deleteConnection, type ConnectionStatus } from '../../../lib/db/connections';

const STATUSES = new Set<ConnectionStatus>(['new', 'in_progress', 'done']);

export const POST: APIRoute = async ({ request }) => {
  const auth = requireAdmin(request, env, import.meta.env.DEV);
  if ('response' in auth) return auth.response;
  const form = await request.formData();
  const id = Number(form.get('id'));
  const action = String(form.get('action') ?? '');
  if (Number.isInteger(id) && id > 0) {
    if (action === 'delete') await deleteConnection(env.DB, id);
    else if (action === 'status') {
      const value = String(form.get('value') ?? '') as ConnectionStatus;
      if (STATUSES.has(value)) await setConnectionStatus(env.DB, id, value);
    }
  }
  return new Response(null, { status: 303, headers: { Location: '/admin/connect' } });
};
