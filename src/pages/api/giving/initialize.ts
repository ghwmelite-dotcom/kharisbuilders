import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { SITE } from '../../../lib/seo';
import { handleInitialize } from '../../../lib/giving/initialize-handler';

export const POST: APIRoute = async ({ request, site }) => {
  const form = await request.formData();
  const origin = (site ?? new URL(SITE.url)).origin;
  const ip = request.headers.get('cf-connecting-ip') ?? undefined;
  const result = await handleInitialize(env, form, ip, { origin });
  return new Response(null, { status: result.status, headers: { Location: result.redirect } });
};
