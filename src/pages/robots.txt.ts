import type { APIRoute } from 'astro';
import { SITE, absUrl } from '../lib/seo';

export const GET: APIRoute = ({ site }) => {
  const origin = (site ?? new URL(SITE.url)).origin;
  const body = ['User-agent: *', 'Allow: /', 'Disallow: /admin', '', `Sitemap: ${absUrl('/sitemap.xml', origin)}`, ''].join(
    '\n',
  );
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
};
