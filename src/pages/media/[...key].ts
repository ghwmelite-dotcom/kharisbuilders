import type { APIRoute } from 'astro';
import { env } from '../../lib/runtime';

// Only image objects under these prefixes are ever publicly served, so the
// "images-only" guarantee is enforced here rather than left incidental.
const PUBLIC_PREFIXES = ['sermons/', 'events/', 'ministries/', 'leaders/', 'journey/', 'home-cards/'];

export const GET: APIRoute = async ({ params }) => {
  const key = params.key;
  if (!key || !PUBLIC_PREFIXES.some((p) => key.startsWith(p))) {
    return new Response('Not found', { status: 404 });
  }
  const obj = await env.MEDIA.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  const type = obj.httpMetadata?.contentType ?? '';
  if (!type.startsWith('image/')) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(obj.body, { headers });
};
