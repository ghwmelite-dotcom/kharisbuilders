import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { handleRegister, type RegisterHandlerEnv } from '../../../lib/register-handler';

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const ip = request.headers.get('cf-connecting-ip') ?? undefined;
  const result = await handleRegister(env as unknown as RegisterHandlerEnv, form, ip);
  if (result.redirect) {
    return new Response(null, { status: result.status, headers: { Location: result.redirect } });
  }
  return new Response('Please check your details and try again.', { status: result.status });
};
