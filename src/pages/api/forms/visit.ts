import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { handleVisit, type VisitHandlerEnv } from '../../../lib/visit-handler';

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  // `Astro.clientAddress` is unsupported on the Cloudflare adapter; use the CF header.
  const ip = request.headers.get('cf-connecting-ip') ?? undefined;
  const result = await handleVisit(env as unknown as VisitHandlerEnv, form, ip);
  if (result.redirect) {
    return new Response(null, { status: result.status, headers: { Location: result.redirect } });
  }
  return new Response('Please check your details and try again.', { status: result.status });
};
