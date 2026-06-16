import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { requireAdmin } from '../../../lib/admin-auth';
import { BlogPostInputSchema } from '../../../lib/db/schemas';
import { createPost, updatePost, deletePost, setPostPublished, setPostCover } from '../../../lib/db/blog';
import { uploadImage } from '../../../lib/media';

export const POST: APIRoute = async ({ request }) => {
  const auth = requireAdmin(request, env, import.meta.env.DEV);
  if ('response' in auth) return auth.response;
  const form = await request.formData();
  const action = String(form.get('_action') ?? '');
  const id = Number(form.get('id') ?? 0);
  try {
    if (action === 'delete') {
      await deletePost(env.DB, id);
    } else if (action === 'toggle') {
      await setPostPublished(env.DB, id, String(form.get('published')) === 'true');
    } else {
      const data = BlogPostInputSchema.parse(Object.fromEntries(form));
      const targetId = action === 'update' ? id : await createPost(env.DB, data, auth.email);
      if (action === 'update') await updatePost(env.DB, id, data, auth.email);
      const image = form.get('image');
      if (image instanceof File && image.size > 0) {
        const key = await uploadImage(env.MEDIA, image, 'blog');
        await setPostCover(env.DB, targetId, key);
      }
    }
  } catch {
    return new Response('Invalid submission', { status: 400 });
  }
  return new Response(null, { status: 303, headers: { Location: '/admin/blog' } });
};
