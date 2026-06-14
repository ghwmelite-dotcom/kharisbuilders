import { defineMiddleware } from 'astro:middleware';

// Canonical host: the apex (kharisbuilders.com) is primary.
// 301-redirect any "www.*" host to the bare domain, preserving path + query.
export const onRequest = defineMiddleware((context, next) => {
  const url = new URL(context.request.url);
  if (url.hostname.startsWith('www.')) {
    url.hostname = url.hostname.slice(4);
    return context.redirect(url.toString(), 301);
  }
  return next();
});
