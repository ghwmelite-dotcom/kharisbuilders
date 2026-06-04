# Church Website Template

A complete, re-skinnable church website — a fast public site plus a staff-maintainable admin —
built on **Astro + Cloudflare**. Spin up a new church by editing one file and running one script.

- **Public site:** home, about, ministries, sermons (with AI search + study guides), events
  (with registration), visit (with a contact form), online giving, and a live/online-campus page.
- **Admin:** everything on the site is editable by non-technical staff at `/admin` (behind
  Cloudflare Access). See **[docs/ADMIN-GUIDE.md](docs/ADMIN-GUIDE.md)**.
- **Re-skinnable:** one config file (`src/config/church.ts`) plus a provisioning script turns this
  template into any church's site — name, colours, currency, timezone, and feature toggles.

---

## Stack

Astro 6 (SSR, Cloudflare adapter) · React islands (admin) · Tailwind CSS v4 ·
Cloudflare **D1** (database) · **R2** (media) · **Workers AI** + **Vectorize** (sermon search) ·
**Cloudflare Access** (admin auth) · **Paystack** (giving).

The theme is derived entirely from four brand colours in `src/config/church.ts` (injected as
`--brand-*` CSS variables and mixed into the `--kb-*` design tokens in `src/styles/tokens.css`).

---

## Spin up a new church

> One church = one clone of this template = one Cloudflare Worker.

1. **Clone** this repo for the new church and `npm install`.
2. **Configure** — copy the example config and fill it in:
   ```sh
   cp scripts/new-church.config.example.json scripts/new-church.config.json
   # edit scripts/new-church.config.json: name, slug, url, colours, currency, timezone, features
   ```
3. **Provision** — generate the per-church files:
   ```sh
   node scripts/new-church.mjs
   ```
   This writes `src/config/church.ts`, `wrangler.jsonc` (resource names derived from your `slug`),
   re-tinted placeholder images, the `package.json` name, the `astro.config.mjs` site URL, and a
   **`PROVISIONING.md`** checklist.
4. **Follow `PROVISIONING.md`** — it lists the exact, copy-pasteable commands to create the
   Cloudflare resources (D1, KV, R2, Vectorize), migrate + seed the database, set secrets,
   protect the admin with Cloudflare Access, and deploy. The checklist adapts to the features you
   enabled (e.g. it omits Paystack steps if giving is off).
5. **Review the diff, commit, deploy.**

### The config file

`scripts/new-church.config.json` (mirrors `src/config/church.ts`):

| Field | Meaning |
| :---- | :------ |
| `name`, `tagline`, `description` | Identity used in titles, SEO, nav/footer wordmark. |
| `slug` | Lowercase `a-z0-9-`. **Drives all Cloudflare resource names** (worker, D1, R2 `*-media`, Vectorize `*-sermons`). |
| `url` | Public origin (canonical URLs, sitemap, OG tags). |
| `currency` | 3-letter code (e.g. `USD`, `GHS`) — default giving currency (admin can override). |
| `timezoneOffsetMin` | Minutes from UTC for the church's local time (used by the live-status window). |
| `motifs` | `true` enables the Adinkra/kente ornaments (Ghanaian flourish); `false` for a neutral look. |
| `theme` | Four hex colours: `primary`, `accent`, `dark`, `surface` — the whole palette derives from these. |
| `features` | Per-area on/off: `sermons`, `events`, `ministries`, `giving`, `ai`, `live`. Off = route redirects + nav/section hidden. |

To change anything later, edit `scripts/new-church.config.json` and re-run `node scripts/new-church.mjs`,
or edit `src/config/church.ts` directly.

---

## Develop

| Command | Action |
| :------ | :----- |
| `npm install` | Install dependencies |
| `npm run dev` | Local dev server at `localhost:4321` (Cloudflare platform proxy) |
| `npm test` | Unit tests (Vitest) |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run build` | Production build to `./dist/` |
| `npm run generate-types` | Regenerate `worker-configuration.d.ts` from `wrangler.jsonc` |
| `npm run deploy` | Build and deploy the Worker (`wrangler deploy`) |

Local secrets go in `.dev.vars` (see `.dev.vars.example`); production secrets via
`wrangler secret put <NAME>` or the Cloudflare dashboard. Bindings that don't work in local dev
(Workers AI, Vectorize) only resolve on the deployed Worker — verify those features after deploy.

> **Note:** a freshly cloned template ships `wrangler.jsonc` with `church-template` resource names
> and `PASTE_FROM_*` id markers. Run the provisioning script (above) before `npm run dev`/deploy so
> it points at *your* resources.

---

## Editing the live site

Almost everything is editable from `/admin` without touching code — page copy, images, sermons,
events, ministries, leadership, the story timeline, home cards, funds, settings, and the live
stream. The full walkthrough for non-technical staff is in **[docs/ADMIN-GUIDE.md](docs/ADMIN-GUIDE.md)**.

To make *new* copy editable from admin: add a field to `src/lib/content/fields.ts` (with a default)
and reference `c('your.key')` / `cimg('your.key')` in the page — the registry auto-wires the editor,
allowlist, and default.

---

## Project layout

```text
src/
  components/        shared + admin UI components
  config/church.ts   THE per-church config (identity, theme, currency, feature flags)
  config/theme-vars.ts  brand colours -> --brand-* CSS variables
  layouts/           PublicLayout, AdminLayout
  lib/
    db/              D1 data access (prepared statements, one module per table)
    content/         editable-content registry + resolver (fields.ts, content.ts)
    giving/, paystack/   one-time + recurring giving (signed webhooks)
    ai/              Workers AI + Vectorize (sermon search, study guides)
    live/            live-status window + stream embed
    media.ts, seo.ts, notify.ts, ...
  pages/
    *.astro          public routes
    admin/           admin pages (behind Cloudflare Access)
    api/             form handlers, admin mutations, webhooks
  styles/            tokens.css (theme), global.css (Tailwind entry + polish layer)
db/                  seed SQL (generic starter content)
migrations/          D1 migrations (0001..)
scripts/
  new-church.mjs     provisioning runner
  lib/provision.mjs  pure provisioning core (validation + file renderers)
tests/               Vitest unit tests
docs/
  ADMIN-GUIDE.md     non-technical staff guide
  superpowers/       design specs + phased implementation plans
```

---

## Feature flags

Each area is gated by `CHURCH.features` in `src/config/church.ts`. When a feature is **off**:

- its public route redirects to `/`, its nav link and home section are hidden, and its admin section
  is hidden;
- `ai` off falls back from semantic sermon search to keyword search;
- `giving` off hides the Give CTA and the giving admin.

Turn a feature on/off by flipping the flag and redeploying.

---

## License / attribution

Placeholder images shipped with the template are authored SVGs (license-clean). Replace them with
your own photography in `/admin`. This template originated from the Kharisbuilders build; the generic
`main` branch carries no church-specific content or live resource identifiers.
