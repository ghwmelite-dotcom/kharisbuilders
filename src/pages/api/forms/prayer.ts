import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { handlePrayer } from '../../../lib/live/prayer-handler';

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const ip = request.headers.get('cf-connecting-ip') ?? undefined;
  const r = await handlePrayer(env, form, ip);
  return new Response(null, { status: r.status, headers: { Location: r.redirect ?? '/live' } });
};
