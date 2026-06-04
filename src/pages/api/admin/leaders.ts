import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { requireAdmin } from '../../../lib/admin-auth';
import { LeaderInputSchema } from '../../../lib/db/schemas';
import { createLeader, updateLeader, deleteLeader, setLeaderImage } from '../../../lib/db/leaders';
import { uploadImage } from '../../../lib/media';

export const POST: APIRoute = async ({ request }) => {
  const auth = requireAdmin(request, env, import.meta.env.DEV);
  if ('response' in auth) return auth.response;
  const form = await request.formData();
  const action = String(form.get('_action') ?? '');
  const id = Number(form.get('id') ?? 0);
  try {
    if (action === 'delete') {
      await deleteLeader(env.DB, id);
    } else {
      const data = LeaderInputSchema.parse(Object.fromEntries(form));
      const targetId = action === 'update' ? id : await createLeader(env.DB, data, auth.email);
      if (action === 'update') await updateLeader(env.DB, id, data, auth.email);
      const image = form.get('image');
      if (image instanceof File && image.size > 0) {
        const key = await uploadImage(env.MEDIA, image, 'leaders');
        await setLeaderImage(env.DB, targetId, key);
      }
    }
  } catch {
    return new Response('Invalid submission', { status: 400 });
  }
  return new Response(null, { status: 303, headers: { Location: '/admin/leaders' } });
};
