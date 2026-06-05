import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { handleConnect } from '../../../lib/connect/connect-handler';

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const ip = request.headers.get('cf-connecting-ip') ?? undefined;
  const r = await handleConnect(env, form, ip);
  return new Response(null, { status: r.status, headers: { Location: r.redirect ?? '/connect' } });
};
