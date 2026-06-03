// Cloudflare Worker bindings access point.
// Astro 6 + @astrojs/cloudflare v13 removed `Astro.locals.runtime.env`; bindings
// are now read from the `cloudflare:workers` virtual module. Import `env` from here
// in any .astro page or API route that needs DB/MEDIA/secrets. Do NOT import this
// from unit tests — `cloudflare:workers` only resolves in the Worker runtime.
export { env } from 'cloudflare:workers';
