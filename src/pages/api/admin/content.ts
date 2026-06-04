import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { requireAdmin } from '../../../lib/admin-auth';
import { setContent } from '../../../lib/db/content';
import { contentKeySet, CONTENT_PAGES } from '../../../lib/content/fields';
import { uploadImage } from '../../../lib/media';

const IMAGE_KEYS = new Set(
  CONTENT_PAGES.flatMap((p) => p.groups.flatMap((g) => g.fields))
    .filter((f) => f.type === 'image')
    .map((f) => f.key),
);

export const POST: APIRoute = async ({ request }) => {
  const auth = requireAdmin(request, env, import.meta.env.DEV);
  if ('response' in auth) return auth.response;
  const form = await request.formData();
  const page = String(form.get('_page') ?? '');
  const allow = contentKeySet();
  const entries: Record<string, string> = {};
  try {
    for (const [key, value] of form.entries()) {
      if (!allow.has(key)) continue;
      if (IMAGE_KEYS.has(key)) {
        // Image field: upload only when a new file was chosen; otherwise keep the existing image.
        if (value instanceof File && value.size > 0) {
          entries[key] = await uploadImage(env.MEDIA, value, 'page');
        }
      } else if (typeof value === 'string') {
        entries[key] = value;
      }
    }
    await setContent(env.DB, entries, auth.email);
  } catch {
    return new Response('Invalid submission', { status: 400 });
  }
  const dest = ['home', 'about', 'visit', 'pages'].includes(page) ? `/admin/content/${page}` : '/admin/content';
  return new Response(null, { status: 303, headers: { Location: `${dest}?saved=1` } });
};
