import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { requireAdmin } from '../../../lib/admin-auth';
import { setContent } from '../../../lib/db/content';
import { contentKeySet } from '../../../lib/content/fields';

export const POST: APIRoute = async ({ request }) => {
  const auth = requireAdmin(request, env, import.meta.env.DEV);
  if ('response' in auth) return auth.response;
  const form = await request.formData();
  const page = String(form.get('_page') ?? '');
  const allow = contentKeySet();
  const entries: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (allow.has(key) && typeof value === 'string') entries[key] = value;
  }
  try {
    await setContent(env.DB, entries, auth.email);
  } catch {
    return new Response('Invalid submission', { status: 400 });
  }
  const dest = ['home', 'about', 'visit'].includes(page) ? `/admin/content/${page}` : '/admin/content';
  return new Response(null, { status: 303, headers: { Location: `${dest}?saved=1` } });
};
