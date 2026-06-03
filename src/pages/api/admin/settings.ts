import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { requireAdmin } from '../../../lib/admin-auth';
import { setSettings } from '../../../lib/db/settings';

// Only these keys may be written through the settings form.
const ALLOWED = [
  'address',
  'contact_email',
  'phone',
  'service_times',
  'socials',
  'default_theme',
  'turnstile_site_key',
];

export const POST: APIRoute = async ({ request }) => {
  const auth = requireAdmin(request, env, import.meta.env.DEV);
  if ('response' in auth) return auth.response;
  const form = await request.formData();
  const entries: Record<string, string> = {};
  for (const key of ALLOWED) {
    const v = form.get(key);
    if (v != null) entries[key] = String(v);
  }
  await setSettings(env.DB, entries);
  return new Response(null, { status: 303, headers: { Location: '/admin/settings?saved=1' } });
};
