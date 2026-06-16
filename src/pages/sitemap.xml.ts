import type { APIRoute } from 'astro';
import { env } from '../lib/runtime';
import { SITE, absUrl, toIso } from '../lib/seo';
import { listPublishedSermons } from '../lib/db/sermons';
import { listUpcomingEvents } from '../lib/db/events';
import { listPublishedMinistries } from '../lib/db/ministries';
import { listPublishedPosts } from '../lib/db/blog';

export const GET: APIRoute = async ({ site }) => {
  const origin = (site ?? new URL(SITE.url)).origin;
  const urls: Array<{ loc: string; lastmod?: string }> = [
    { loc: absUrl('/', origin) },
    { loc: absUrl('/about', origin) },
    { loc: absUrl('/ministries', origin) },
    { loc: absUrl('/sermons', origin) },
    { loc: absUrl('/events', origin) },
    { loc: absUrl('/blog', origin) },
    { loc: absUrl('/visit', origin) },
  ];
  try {
    const [sermons, events, posts] = await Promise.all([listPublishedSermons(env.DB), listUpcomingEvents(env.DB), listPublishedPosts(env.DB)]);
    for (const s of sermons) urls.push({ loc: absUrl(`/sermons/${s.slug}`, origin), lastmod: toIso(s.sermon_date) });
    for (const e of events) urls.push({ loc: absUrl(`/events/${e.slug}`, origin), lastmod: toIso(e.start_at) });
    for (const p of posts) urls.push({ loc: absUrl(`/blog/${p.slug}`, origin), lastmod: toIso(p.published_at ?? p.created_at) });
    // ministries currently have no public detail route; surfaced only via /ministries
    await listPublishedMinistries(env.DB);
  } catch {
    /* fall back to static routes only */
  }
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`)
      .join('\n') +
    `\n</urlset>\n`;
  return new Response(body, {
    headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  });
};
