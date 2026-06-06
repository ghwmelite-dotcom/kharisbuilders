import type { APIRoute } from 'astro';
import { env } from '../../lib/runtime';
import { getEventBySlug } from '../../lib/db/events';
import { buildIcs } from '../../lib/events/calendar';
import { CHURCH, feature } from '../../config/church';
import { SITE } from '../../lib/seo';

export const GET: APIRoute = async ({ params, url, site }) => {
  if (!feature('events')) return new Response('Not found', { status: 404 });
  const slug = params.slug;
  if (!slug) return new Response('Not found', { status: 404 });

  const event = await getEventBySlug(env.DB, slug).catch(() => null);
  if (!event) return new Response('Not found', { status: 404 });

  const origin = (site ?? new URL(SITE.url)).origin || url.origin;
  const body = buildIcs(event, origin, CHURCH.timezoneOffsetMin);
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}.ics"`,
      'Cache-Control': 'public, max-age=300',
    },
  });
};
