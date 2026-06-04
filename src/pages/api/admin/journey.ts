import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { requireAdmin } from '../../../lib/admin-auth';
import { JourneyInputSchema } from '../../../lib/db/schemas';
import { createJourney, updateJourney, deleteJourney, setJourneyImage } from '../../../lib/db/journey';
import { uploadImage } from '../../../lib/media';

export const POST: APIRoute = async ({ request }) => {
  const auth = requireAdmin(request, env, import.meta.env.DEV);
  if ('response' in auth) return auth.response;
  const form = await request.formData();
  const action = String(form.get('_action') ?? '');
  const id = Number(form.get('id') ?? 0);
  try {
    if (action === 'delete') {
      await deleteJourney(env.DB, id);
    } else {
      const data = JourneyInputSchema.parse(Object.fromEntries(form));
      const targetId = action === 'update' ? id : await createJourney(env.DB, data, auth.email);
      if (action === 'update') await updateJourney(env.DB, id, data, auth.email);
      const image = form.get('image');
      if (image instanceof File && image.size > 0) {
        const key = await uploadImage(env.MEDIA, image, 'journey');
        await setJourneyImage(env.DB, targetId, key);
      }
    }
  } catch {
    return new Response('Invalid submission', { status: 400 });
  }
  return new Response(null, { status: 303, headers: { Location: '/admin/journey' } });
};
