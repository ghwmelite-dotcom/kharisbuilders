# Kharisbuilders Church Website

Full-stack church website — fast public site plus a staff-maintainable admin — built on
Astro + Cloudflare. Design and phased implementation plans live in `docs/superpowers/`.

## Stack

Astro 6 (SSR, Cloudflare adapter) · React islands (admin, later phases) · Tailwind CSS v4 ·
Cloudflare **D1** (database) · **R2** (media) · Cloudflare Access (admin auth) · Paystack (giving).

Two theme-switchable palettes — `sacred` (midnight/gold) and `purple` — driven by the
`theme` cookie and the `data-theme` attribute. Runtime tokens use a `--kb-*` prefix and are
mapped into Tailwind via `@theme inline` in `src/styles/global.css`.

## Develop

| Command | Action |
| :------ | :----- |
| `npm install` | Install dependencies |
| `npm run dev` | Local dev server at `localhost:4321` (Cloudflare platform proxy enabled) |
| `npm test` | Unit tests (Vitest) |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run build` | Production build to `./dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run generate-types` | Regenerate `worker-configuration.d.ts` from `wrangler.jsonc` |
| `npm run deploy` | Build and deploy the Worker (`wrangler deploy`) |

## Cloudflare setup

Bindings are declared in `wrangler.jsonc`: `DB` (D1) and `MEDIA` (R2). One-time provisioning
(requires `wrangler login`):

```sh
wrangler d1 create kharisbuilders      # paste the printed database_id into wrangler.jsonc
wrangler r2 bucket create kharisbuilders-media
```

Local secrets go in `.dev.vars` (see `.dev.vars.example`); production secrets via
`wrangler secret put <NAME>` or the dashboard.

Deployment connects to GitHub (`ghwmelite-dotcom/kharisbuilders`) via Cloudflare's
Workers & Pages → Connect to Git: build command `npm run build`, output `dist`.

## Project layout

```text
src/
  components/   shared UI (Nav, Footer, Button, Card, Icon)
  layouts/      PublicLayout (sets data-theme, wraps Nav + Footer)
  lib/          theme.ts, env.ts (Cloudflare bindings accessor), cn.ts
  pages/        public routes (admin + API added in later phases)
  styles/       tokens.css (both palettes), global.css (Tailwind entry)
tests/          Vitest unit tests
db/migrations/  D1 migrations (later phases)
docs/superpowers/  design spec + phased implementation plans
```
