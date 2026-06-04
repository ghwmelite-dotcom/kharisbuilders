import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { requireAdmin } from '../../../lib/admin-auth';
import { setSettings } from '../../../lib/db/settings';

const LIVE_KEYS = [
  'live_stream_url',
  'live_state',
  'live_duration_min',
  'live_tz_offset_min',
  'live_chat_enabled',
  'live_connect_enabled',
  'live_bulletin_title',
  'live_bulletin_body',
];

export const POST: APIRoute = async ({ request }) => {
  const auth = requireAdmin(request, env, import.meta.env.DEV);
  if ('response' in auth) return auth.response;
  const form = await request.formData();
  const entries: Record<string, string> = {};
  for (const k of LIVE_KEYS) if (form.has(k)) entries[k] = String(form.get(k) ?? '');
  try {
    await setSettings(env.DB, entries);
  } catch {
    return new Response('Invalid', { status: 400 });
  }
  return new Response(null, { status: 303, headers: { Location: '/admin/live?saved=1' } });
};
