import type { APIRoute } from 'astro';
import { env } from '../../../../lib/runtime';
import { requireAdmin } from '../../../../lib/admin-auth';
import { uploadImage, mediaUrl } from '../../../../lib/media';

export const POST: APIRoute = async ({ request }) => {
  const auth = requireAdmin(request, env, import.meta.env.DEV);
  if ('response' in auth) return auth.response;
  try {
    const form = await request.formData();
    const file = form.get('image');
    if (!(file instanceof File) || file.size === 0) {
      return new Response(JSON.stringify({ error: 'No image provided' }), { status: 400 });
    }
    const key = await uploadImage(env.MEDIA, file, 'blog');
    const url = mediaUrl(key)!;
    return new Response(JSON.stringify({ url, markdown: `![](${url})` }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Upload failed';
    return new Response(JSON.stringify({ error: message }), { status: 400 });
  }
};
