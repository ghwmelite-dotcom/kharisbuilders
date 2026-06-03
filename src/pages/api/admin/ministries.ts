import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { requireAdmin } from '../../../lib/admin-auth';
import { MinistryInputSchema } from '../../../lib/db/schemas';
import { createMinistry, updateMinistry, deleteMinistry, setMinistryPublished } from '../../../lib/db/ministries';

export const POST: APIRoute = async ({ request }) => {
  const auth = requireAdmin(request, env, import.meta.env.DEV);
  if ('response' in auth) return auth.response;
  const form = await request.formData();
  const action = String(form.get('_action') ?? '');
  const id = Number(form.get('id') ?? 0);
  try {
    if (action === 'delete') {
      await deleteMinistry(env.DB, id);
    } else if (action === 'toggle') {
      await setMinistryPublished(env.DB, id, String(form.get('published')) === 'true');
    } else {
      const data = MinistryInputSchema.parse(Object.fromEntries(form));
      if (action === 'update') await updateMinistry(env.DB, id, data, auth.email);
      else await createMinistry(env.DB, data, auth.email);
    }
  } catch {
    return new Response('Invalid submission', { status: 400 });
  }
  return new Response(null, { status: 303, headers: { Location: '/admin/ministries' } });
};
