import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { feature } from '../../../config/church';
import { incrementPrayCount } from '../../../lib/db/prayer-requests';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  if (!feature('community')) return json({ error: 'Not found' }, 404);
  let data: { id?: unknown };
  try {
    data = (await request.json()) as typeof data;
  } catch {
    return json({ error: 'Invalid request' }, 400);
  }
  const id = Number(data.id);
  if (!Number.isInteger(id) || id <= 0) return json({ error: 'Invalid id' }, 400);
  const count = await incrementPrayCount(env.DB, id);
  return json({ count });
};
