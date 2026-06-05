import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { handlePrayer } from '../../../lib/live/prayer-handler';

const PAGES = new Set(['/live', '/prayer']);

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const ip = request.headers.get('cf-connecting-ip') ?? undefined;
  const rt = String(form.get('return_to') ?? '/live');
  const page = PAGES.has(rt) ? rt : '/live';
  const r = await handlePrayer(env, form, ip, { page });
  return new Response(null, { status: r.status, headers: { Location: r.redirect ?? page } });
};
