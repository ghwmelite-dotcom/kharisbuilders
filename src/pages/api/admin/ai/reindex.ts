import type { APIRoute } from 'astro';
import { env } from '../../../../lib/runtime';
import { requireAdmin } from '../../../../lib/admin-auth';
import { getSermonById, listAllSermonIds } from '../../../../lib/db/sermons';
import { workersAi, vectorize } from '../../../../lib/ai/clients';
import { indexSermon } from '../../../../lib/ai/index-sermon';

export const POST: APIRoute = async ({ request }) => {
  const auth = requireAdmin(request, env, import.meta.env.DEV);
  if ('response' in auth) return auth.response;
  const ids = await listAllSermonIds(env.DB);
  const deps = { ai: workersAi(env.AI), store: vectorize(env.SERMONS) };
  let indexed = 0;
  for (const id of ids) {
    const sermon = await getSermonById(env.DB, id);
    if (!sermon) continue;
    try {
      await indexSermon(deps, sermon);
      indexed++;
    } catch {
      /* skip a failing sermon, continue */
    }
  }
  return new Response(JSON.stringify({ indexed, total: ids.length }), {
    headers: { 'content-type': 'application/json' },
  });
};
