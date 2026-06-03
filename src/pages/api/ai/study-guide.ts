import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { getSermonBySlug } from '../../../lib/db/sermons';
import { workersAi } from '../../../lib/ai/clients';
import { getOrGenerateGuide } from '../../../lib/ai/guide-service';

export const GET: APIRoute = async ({ url }) => {
  const slug = url.searchParams.get('sermon');
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), {
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' },
    });
  if (!slug) return json({ available: false });
  const sermon = await getSermonBySlug(env.DB, slug).catch(() => null);
  if (!sermon) return json({ available: false });
  const guide = await getOrGenerateGuide(env.DB, workersAi(env.AI), sermon).catch(() => null);
  return json(guide ? { available: true, guide } : { available: false });
};
