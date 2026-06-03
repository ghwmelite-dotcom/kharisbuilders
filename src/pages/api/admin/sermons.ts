import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { requireAdmin } from '../../../lib/admin-auth';
import { SermonInputSchema } from '../../../lib/db/schemas';
import {
  createSermon,
  updateSermon,
  deleteSermon,
  setSermonPublished,
  setSermonImage,
  getSermonById,
} from '../../../lib/db/sermons';
import { uploadImage } from '../../../lib/media';
import { workersAi, vectorize } from '../../../lib/ai/clients';
import { indexSermon, removeSermon } from '../../../lib/ai/index-sermon';
import { deleteGuide } from '../../../lib/db/study-guides';

export const POST: APIRoute = async ({ request }) => {
  const auth = requireAdmin(request, env, import.meta.env.DEV);
  if ('response' in auth) return auth.response;
  const form = await request.formData();
  const action = String(form.get('_action') ?? '');
  const id = Number(form.get('id') ?? 0);
  try {
    if (action === 'delete') {
      await deleteSermon(env.DB, id);
      try {
        await removeSermon(vectorize(env.SERMONS), id);
      } catch {
        /* best-effort: drop the search vector */
      }
    } else if (action === 'toggle') {
      await setSermonPublished(env.DB, id, String(form.get('published')) === 'true');
    } else {
      const data = SermonInputSchema.parse(Object.fromEntries(form));
      const targetId = action === 'update' ? id : await createSermon(env.DB, data, auth.email);
      if (action === 'update') await updateSermon(env.DB, id, data, auth.email);
      const image = form.get('image');
      if (image instanceof File && image.size > 0) {
        const key = await uploadImage(env.MEDIA, image, 'sermons');
        await setSermonImage(env.DB, targetId, key);
      }
      // Best-effort: re-embed for search + invalidate the cached study guide. Never fail the save.
      try {
        const full = await getSermonById(env.DB, targetId);
        if (full) {
          await indexSermon({ ai: workersAi(env.AI), store: vectorize(env.SERMONS) }, full);
          await deleteGuide(env.DB, targetId);
        }
      } catch {
        /* indexing is best-effort */
      }
    }
  } catch {
    return new Response('Invalid submission', { status: 400 });
  }
  return new Response(null, { status: 303, headers: { Location: '/admin/sermons' } });
};
