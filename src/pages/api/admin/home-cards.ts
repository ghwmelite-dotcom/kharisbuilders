import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { requireAdmin } from '../../../lib/admin-auth';
import { HomeCardInputSchema } from '../../../lib/db/schemas';
import { createHomeCard, updateHomeCard, deleteHomeCard, setHomeCardImage } from '../../../lib/db/homeCards';
import { uploadImage } from '../../../lib/media';

export const POST: APIRoute = async ({ request }) => {
  const auth = requireAdmin(request, env, import.meta.env.DEV);
  if ('response' in auth) return auth.response;
  const form = await request.formData();
  const action = String(form.get('_action') ?? '');
  const id = Number(form.get('id') ?? 0);
  try {
    if (action === 'delete') {
      await deleteHomeCard(env.DB, id);
    } else {
      const data = HomeCardInputSchema.parse(Object.fromEntries(form));
      const targetId = action === 'update' ? id : await createHomeCard(env.DB, data, auth.email);
      if (action === 'update') await updateHomeCard(env.DB, id, data, auth.email);
      const image = form.get('image');
      if (image instanceof File && image.size > 0) {
        const key = await uploadImage(env.MEDIA, image, 'home-cards');
        await setHomeCardImage(env.DB, targetId, key);
      }
    }
  } catch {
    return new Response('Invalid submission', { status: 400 });
  }
  return new Response(null, { status: 303, headers: { Location: '/admin/home-cards' } });
};
