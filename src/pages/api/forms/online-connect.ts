import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { handleOnlineConnect } from '../../../lib/live/online-connect-handler';

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const ip = request.headers.get('cf-connecting-ip') ?? undefined;
  const r = await handleOnlineConnect(env, form, ip);
  return new Response(null, { status: r.status, headers: { Location: r.redirect ?? '/live' } });
};
