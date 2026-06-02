# KharisBuilders — Full-Stack Website & Admin: Design Spec

**Date:** 2026-06-02
**Status:** Approved (design phase)
**Owner:** OHWP Studios
**Source material:** Google Stitch mockups in `stitch_kharisbuilders_church_web_design/` (Home, About, Ministries, Visit, Admin Dashboard, Manage Events, Manage Sermons, People/Visitors) + two `DESIGN.md` token files (Sacred Structure midnight/gold, Purple variant).

---

## 1. Summary

Turn the existing static Stitch mockups into a production-grade, full-stack church website with a working, staff-maintainable admin. The site is maintained by **non-technical church staff**, so admin UX simplicity is a first-class requirement, not an afterthought.

**Decisions locked during brainstorming:**

| Decision | Choice |
|---|---|
| Product scope | Full-stack site with functional admin/CMS |
| Maintainers | Non-technical church staff |
| Hosting/stack | Custom on Cloudflare (Pages + Workers runtime, D1, R2) |
| Framework | Astro (public, SSR) + React islands (admin) |
| Theme | Both palettes, theme-switchable via CSS custom properties |
| Sermons | Embed YouTube/Vimeo links (no video hosting) |
| Giving | Built-in Paystack (Inline + webhook verification) |
| Admin auth | Cloudflare Access in front of `/admin/*` |

---

## 2. Goals & Non-Goals

### Goals
- Fast, SEO-strong public site (church discoverability matters).
- A branded admin that non-technical staff can use confidently.
- Real content pipeline: what staff publish in admin is what visitors see.
- On-site giving via Paystack supporting cards, bank transfer, mobile money, USSD.
- Theme-switchable design system derived from the two existing `DESIGN.md` files.

### Non-Goals (v1 — explicitly deferred)
- Livestream integration (sermons are embeds only).
- Public member accounts / member portal.
- Mass email / newsletter campaigns.
- Multi-language / i18n.
- Native mobile apps.

---

## 3. Architecture

### 3.1 Topology
- **Single Astro project** deployed to **Cloudflare Pages** in SSR mode (Cloudflare adapter). Public pages, admin routes, and API endpoints share one deployment.
- **D1** for all structured data (bindings via `wrangler`).
- **R2** for uploaded media (images). Public delivery through Cloudflare Image Resizing for responsive variants.
- **Cloudflare Access** gates `/admin/*` and `/api/admin/*`.
- **Cloudflare Turnstile** protects public form + giving endpoints.

### 3.2 Rendering strategy
- **Public content pages** (Home, About, Ministries, Visit, Sermons list/detail, Events list/detail, Give): **SSR with edge caching**. Detail pages emit real server-rendered HTML for SEO; cache invalidated on publish.
- **Admin**: Astro route shells that mount **React islands** for interactive tables/forms. Data via `/api/admin/*`.
- **No CDN Tailwind.** Tailwind compiled at build time (purged). Fonts self-hosted (Playfair Display, Manrope). Icons are **inline SVG** (Material Symbols removed).

### 3.3 Project structure (target)
```
/src
  /components        # shared Astro UI (Nav, Footer, Button, Card, ...)
  /components/admin  # React islands (tables, forms, uploaders)
  /layouts           # PublicLayout, AdminLayout
  /pages             # public routes (index, about, ministries, visit, sermons, events, give)
  /pages/admin       # admin routes (dashboard, sermons, events, people, ministries, settings)
  /pages/api         # API endpoints (admin CRUD, forms, paystack, turnstile)
  /lib               # db access, validation (zod), paystack, auth helpers, theme
  /styles            # tokens.css (both themes), tailwind entry
/db/migrations       # D1 SQL migrations
/tests               # vitest (unit) + playwright (e2e)
wrangler.toml
```

---

## 4. Design System

### 4.1 Tokens & theming
- Both palettes become **CSS custom properties** scoped under `[data-theme="sacred"]` and `[data-theme="purple"]` (e.g. `--color-primary`, `--color-on-primary`, `--color-surface`, `--color-heritage-gold`/equivalent accent).
- Tailwind config maps utility colors to the CSS variables — **never raw hex in components**. One component set renders correctly in both themes.
- Typography tokens: Playfair Display (display/headlines) + Manrope (body/labels/UI). 8px spacing base, 1280px container, documented scales from the `DESIGN.md` files.
- `prefers-reduced-motion` respected on all animation.

### 4.2 Theme selection
- Visitor theme persisted in cookie/localStorage (optional visitor toggle).
- **Default theme** for first-time visitors is a value in `site_settings`, editable by staff.

### 4.3 Components (shared)
`Nav` (transparent → vellum-glass on scroll), `Footer`, `Button` (primary/secondary/tertiary per spec), `Card`, `EventCard`, `SermonCard`, `MinistryCard`, `Input` (minimalist ledger / bottom-border float-label), `CTABanner` (cinematic overlay), `Section` wrappers with architectural spacing.

### 4.4 Accessibility (enforced)
- AA contrast minimum, 44px touch targets, visible focus states, keyboard nav, `aria-label`s, alt text on all imagery (mockups already carry descriptive `data-alt`).

---

## 5. Data Model (D1)

> All access via prepared statements. `id` = text UUID or integer autoincrement (decided in plan). Timestamps stored as ISO8601 / unix. `published` gates public visibility.

### sermons
`id, title, speaker, series, scripture_ref, video_url, video_provider (youtube|vimeo), thumbnail_key (R2, nullable), description, sermon_date, published (bool), created_at, updated_at, updated_by`

### events
`id, title, category, description, start_at, end_at, location, image_key (R2, nullable), registration_enabled (bool), capacity (nullable), published (bool), created_at, updated_at, updated_by`

### event_registrations
`id, event_id (FK), name, email, phone, guests (int), created_at`

### ministries
`id, name, slug (unique), description, image_key (R2, nullable), leader, meeting_time, sort_order (int), published (bool), created_at, updated_at, updated_by`

### visitors
`id, name, email, phone, type (visitor|member|other), status (new|contacted|joined), notes, source (visit_form|connect_card|event), created_at`

### donations
`id, paystack_reference (unique), amount (minor units), currency, fund (tithe|offering|building|missions), donor_name, donor_email, recurring (bool), plan_code (nullable), status (pending|success|failed), raw_payload (json), created_at, verified_at (nullable)`

### site_settings
`key (PK), value (text/json)` — service_times, address, contact_email, phone, social_links, default_theme, paystack_public_key (public), giving_funds list.

> Admin identity comes from Cloudflare Access headers; `updated_by` stores the authenticated email. No local password table.

---

## 6. Admin Application

Routes (all behind Cloudflare Access):

- **`/admin` Dashboard** — counts (sermons, upcoming events, new visitors, giving this month), recent visitors, upcoming events, recent donations.
- **`/admin/sermons`** — list + create/edit/delete; paste YouTube/Vimeo URL (provider auto-detected, thumbnail auto-pulled or uploaded), publish toggle.
- **`/admin/events`** — list + CRUD; image upload; toggle registration; **view registrations** per event (export CSV).
- **`/admin/people`** — visitor/member list, status workflow (new → contacted → joined), notes, CSV export.
- **`/admin/ministries`** — CRUD, drag-to-reorder (`sort_order`), publish toggle.
- **`/admin/settings`** — service times, address, socials, contact, default theme, giving funds.

**Non-technical UX requirements:** large targets, inline validation with plain-language errors, image upload with live preview, confirm-before-delete, optimistic but reversible publish toggles, no jargon. "Last edited by / at" shown on records.

---

## 7. API Surface

### Admin (behind Access) — `/api/admin/*`
- `sermons` / `events` / `ministries` / `visitors` — REST-ish CRUD.
- `events/:id/registrations` — list + CSV.
- `uploads` — signed/direct R2 upload for images (validated type/size).
- `settings` — read/update key/values.

### Public — `/api/*`
- `forms/visit` — validate (zod) + Turnstile → insert `visitors` → notify staff email.
- `forms/register` — validate + Turnstile → insert `event_registrations` (capacity check) → notify.
- `paystack/initialize` — create transaction (server-side), return reference/access for Inline.
- `paystack/webhook` — **signature-verified** (HMAC SHA512 with secret); the only source of truth for marking a donation `success`. Idempotent on `paystack_reference`.
- `paystack/verify` — post-payment callback verification (defensive; webhook remains authoritative).

---

## 8. Giving Flow (Paystack)

1. Donor on `/give` chooses fund + amount + one-time/recurring, enters email.
2. Frontend calls `paystack/initialize` → opens **Paystack Inline** (cards, bank transfer, mobile money, USSD).
3. On completion, Paystack redirects/callbacks; `paystack/verify` does a defensive check.
4. **`paystack/webhook`** receives the event, verifies the signature, and upserts `donations` to `success` (idempotent). Recurring uses Paystack plans/subscriptions → `plan_code`.
5. Admin views donations **read-only** (amount, fund, status, donor, date).

Secrets (`PAYSTACK_SECRET_KEY`, webhook secret) live in Cloudflare env/secrets; only the **public** key is exposed to the browser.

---

## 9. Forms & Notifications
- Visit / "New Here?" and Event registration forms: zod validation server-side, Turnstile token required, then D1 insert.
- Staff notification email via Cloudflare Email Routing / MailChannels (from address on the church domain). Failures are logged but don't block the user-facing success.

---

## 10. Security
- Cloudflare Access on all admin surfaces; Turnstile on all public POST endpoints.
- Prepared statements only; input validated (zod) at every boundary.
- CORS allowlist; CSP, X-Content-Type-Options, Referrer-Policy, HSTS headers.
- Paystack webhook signature verification; idempotency on references.
- No PII in logs; secrets in Cloudflare secrets, never in the repo.
- Upload validation: MIME/type/size allowlist; images only.

---

## 11. Performance
- Astro zero-JS public pages where possible; React only in admin islands.
- Edge caching for public reads, purged on publish.
- Responsive images via Cloudflare Image Resizing; lazy-load below the fold.
- Self-hosted fonts with `font-display: swap` + preload.
- Core Web Vitals targets: LCP < 2.5s, INP < 200ms, CLS < 0.1.

---

## 12. Testing
- **Vitest (unit):** data-access helpers, zod schemas, Paystack signature verification + idempotency, theme token resolution.
- **Playwright (e2e):** give flow (mock Paystack), event registration (incl. capacity), visitor form, admin create/publish sermon, Access-gated route redirect.

---

## 13. Deployment & Ops
- **Wrangler** for D1 migrations, R2, secrets; `wrangler.toml` defines bindings.
- **GitHub Actions** CI: typecheck, lint, unit tests, build; Playwright on PR.
- **Cloudflare Pages** preview deploy per branch; production on main.
- D1 migrations versioned in `/db/migrations`, applied via CI step.
- Seed script to import existing mockup content (sample sermons/events/ministries) so staff start with real-looking data.

---

## 14. Build Phasing (for the implementation plan)
1. **Foundation:** Astro + Cloudflare adapter, Tailwind build, tokens/theming (both palettes), shared components, wrangler/D1/R2 bindings, base layouts.
2. **Public site:** Home, About, Ministries, Visit — reading from D1/settings; forms (visit) + Turnstile + notifications.
3. **Sermons & Events:** public list/detail (SSR + cache) + their admin CRUD; event registration flow.
4. **Admin core:** Access gating, Dashboard, People/Visitors, Ministries, Settings, image uploads to R2.
5. **Giving:** `/give`, Paystack initialize/webhook/verify, donations admin view.
6. **Hardening:** security headers, tests (Vitest + Playwright), CI, seed data, perf pass, launch checklist.

---

## 15. Open Questions (resolve during planning, non-blocking)
- Exact giving fund list (default: Tithe, Offering, Building, Missions — staff-editable).
- Church domain + email-from address for notifications.
- Whether sermon thumbnails auto-pull from YouTube/Vimeo oEmbed or are always uploaded (default: auto-pull, allow override).
- ID strategy (UUID vs autoincrement) — decided in plan.
