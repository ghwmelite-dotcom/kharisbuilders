/**
 * Returns the Cloudflare runtime bindings (D1, R2, ...) attached to Astro `locals`
 * by the Cloudflare adapter. Throws if the runtime is unavailable (e.g. called
 * outside a request, or before the adapter middleware ran).
 */
export function getBindings(locals: App.Locals): CloudflareBindings {
  if (!locals?.runtime?.env) {
    throw new Error('Cloudflare runtime bindings are not available on locals.');
  }
  return locals.runtime.env;
}
