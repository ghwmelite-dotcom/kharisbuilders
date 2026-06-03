import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { handleVisit, type VisitHandlerEnv } from '../../../lib/visit-handler';

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const form = await request.formData();
  const result = await handleVisit(env as unknown as VisitHandlerEnv, form, clientAddress);
  if (result.redirect) {
    return new Response(null, { status: result.status, headers: { Location: result.redirect } });
  }
  return new Response('Please check your details and try again.', { status: result.status });
};
