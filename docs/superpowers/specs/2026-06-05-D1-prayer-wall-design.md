# D1: Prayer Wall — Design Spec

**Date:** 2026-06-05
**Status:** Approved (brainstorming)
**Roadmap:** Phase D (Community & Care), sub-project 1 of 5.
**Working dir:** `stitch_kharisbuilders_church_web_design`

## 1. Goal

A public `/prayer` page where people share prayer requests and pray for one another, with staff
moderation — building on the existing `prayer_requests` infrastructure. Public, denomination-neutral,
template-ready; gated behind a new `community` feature flag (default on).

## 2. What already exists (reused)

- Table `prayer_requests` (migration 0019): `id, name, email, request, is_private (default 1),
  status (default 'new'), created_at`.
- `src/lib/db/prayer-requests.ts`: `PrayerRequest` type, `createPrayerRequest`, `listPrayerRequests`.
- `src/lib/live/prayer-handler.ts`: `handlePrayer(env, form, ip)` = zod (`PrayerInputSchema`) →
  `verifyTurnstile` → `createPrayerRequest` → best-effort `notifyStaff`; redirects to `/live?prayer=…`.
- Route `src/pages/api/forms/prayer.ts`.
- `PrayerInputSchema` in `src/lib/db/schemas.ts` (`name, email, request, is_private`).

## 3. Data model

- **Migration `0020_prayer_pray_count.sql`:** `ALTER TABLE prayer_requests ADD COLUMN pray_count
  INTEGER NOT NULL DEFAULT 0;`
- **Status flow:** a public submission is inserted as `status='new'`. Staff **approve** → `'approved'`
  (appears on the wall) or **hide** → `'hidden'`. Private requests (`is_private=1`) **never** appear on
  the wall regardless of status — they exist only for the prayer team.
- **Wall visibility:** `is_private = 0 AND status = 'approved'`.
- **Email is never returned to or rendered on any public surface.**

## 4. Components

### 4.1 Data access — `src/lib/db/prayer-requests.ts` (extend)

- Add `pray_count: number` to `PrayerRequest`; include it in `listPrayerRequests` SELECT.
- `PublicPrayer` type = `{ id, name, request, created_at, pray_count }` (no email, no status).
- `listPublicPrayers(db, limit = 60): PublicPrayer[]` — `WHERE is_private = 0 AND status = 'approved'
  ORDER BY created_at DESC LIMIT ?` selecting only the public-safe columns.
- `incrementPrayCount(db, id): number` — `UPDATE prayer_requests SET pray_count = pray_count + 1
  WHERE id = ? AND is_private = 0 AND status = 'approved'`; then read back and return the new count
  (0 if the row wasn't eligible).
- `setPrayerStatus(db, id, status: 'new'|'approved'|'hidden'): void`.
- `deletePrayerRequest(db, id): void`.

### 4.2 Submit pipeline — reuse `handlePrayer`

Parameterize: `handlePrayer(env, form, ip, opts: { page?: string } = {})`. The redirect target becomes
`` `${opts.page ?? '/live'}?prayer=ok|err` ``. The shared route `src/pages/api/forms/prayer.ts` reads a
`return_to` form field and **allowlists** it to `/live` or `/prayer` (default `/live`) before passing as
`opts.page` — no open-redirect. The wall form includes `<input type="hidden" name="return_to"
value="/prayer">`. Public submissions keep the existing default behaviour: inserted with
`is_private` from the form's public/private choice, `status='new'` (awaiting moderation).

### 4.3 Public page — `src/pages/prayer.astro`

- `if (!feature('community')) return Astro.redirect('/')`.
- `PageHero` "Prayer Wall" + short intro.
- **Submit form** (posts to `/api/forms/prayer`): name (optional), email (optional, "kept private"),
  request (textarea, required), a **public/private radio** ("Share on the wall" vs "Keep private — just
  for the prayer team"), Turnstile widget, submit. A success/er banner from `?prayer=ok|err`.
- **The wall:** approved public requests as cards — request text, "— {name}" or "Anonymous", relative
  date, and the **pray counter + "I prayed" button**. Empty state: "No requests on the wall yet — be the
  first to share, or check back soon." A small note: "Requests are reviewed before they appear here."
- **Client script:** the "I prayed" button POSTs `{ id }` to `/api/prayer/pray`, optimistically bumps
  the shown count, and records the id in `localStorage` so the button disables (per device) — preventing
  trivial repeat presses. Escapes nothing into HTML via innerHTML (server-rendered text; the count is a
  number set via textContent).

### 4.4 Pray endpoint — `src/pages/api/prayer/pray.ts`

`POST` JSON `{ id: number }`. `feature('community')` off → 404. Validates `id` is a positive integer.
Calls `incrementPrayCount`; returns `{ count }` (200). Only approved-public rows increment (enforced in
SQL). No Turnstile — low stakes; the soft per-device guard is the only throttle (accepted limitation:
a determined actor could inflate a vanity counter).

### 4.5 Admin moderation — `src/pages/admin/prayer.astro` + `src/pages/api/admin/prayer.ts`

- Page (gated like every admin page via `getAdminEmail`): lists ALL requests (`listPrayerRequests`) with
  the request, name/email, a **public/private** badge, a **status** badge, the pray count, and actions.
  - Public + new/hidden → **Approve** button (`status='approved'`).
  - Approved → **Hide** button (`status='hidden'`).
  - Any → **Delete**.
  - Private requests show for the prayer team (read + Delete) but have no Approve (they never go public).
- Route `src/pages/api/admin/prayer.ts` (`requireAdmin` → 403): `action ∈ {approve, hide, delete}` + `id`
  → `setPrayerStatus`/`deletePrayerRequest`; 303 back to `/admin/prayer`.
- Admin nav gains "Prayer", gated by `feature('community')`. (The existing `/admin/live` page's prayer
  list is left as-is; `/admin/prayer` is the moderation hub.)

### 4.6 The `community` feature flag

Add `community: boolean` to `ChurchFeatures` and `CHURCH.features.community = true`. Touch points:
- `src/config/church.ts` — interface field + value (generic template value `true`).
- `scripts/lib/provision.mjs` — `FEATURE_KEYS` gains `community`; `renderChurchConfigTs` features line.
- `scripts/new-church.config.example.json` and `kharis.config.json` — add `"community": true`.
- Public nav (`src/components/Nav.astro`) — add `{ label: 'Prayer', href: '/prayer' }` with
  `featureOf['/prayer'] = 'community'`.
- Admin nav (`src/layouts/AdminLayout.astro`) — Prayer item gated by `community`.
- `/prayer`, `/api/prayer/pray`, `/api/admin/prayer` all gate on `feature('community')`.

> **Cross-branch note (Kharis):** adding a flag changes the config *structure*. When D1 ships to the
> `kharis` branch, also add `community` to Kharis's own `src/config/church.ts` (`ChurchFeatures` +
> `CHURCH.features`) and `kharis.config.json` — those files are kept by `.gitattributes merge=ours`, so
> the merge from `main` won't carry the change automatically.

## 5. Testing

Offline unit tests (Vitest + Miniflare `createTestDb`):
- `prayer-requests.test.ts`: `listPublicPrayers` returns only approved-public rows and **omits email**;
  `incrementPrayCount` bumps an approved-public row and is a **no-op** for private/unapproved rows
  (returns 0); `setPrayerStatus` + `deletePrayerRequest` behave; `listPrayerRequests` includes
  `pray_count`.
- `prayer-handler.test.ts`: `handlePrayer(..., { page: '/prayer' })` redirects to `/prayer?prayer=ok`
  on success and `/prayer?prayer=err` on bad Turnstile / invalid input; default page stays `/live`.
- Config/provision: update the integrity tests that assert the feature count (6 → 7) and that
  `renderChurchConfigTs` emits `community`.

Binding-dependent routes (the `.astro` pages + API routes) are verified by `astro build` + post-deploy
smoke, per project convention.

## 6. Definition of Done

- Migration `0020` applied (local + remote on deploy).
- `/prayer` renders when `feature('community')` (redirects when off); submit works (public → moderated,
  private → team-only); the wall shows approved public requests with a working "I prayed" counter.
- Admin can approve/hide/delete; only approved-public requests reach the wall; email never exposed.
- `community` flag wired through config, nav, provisioner, and tests.
- `npx vitest run` green (current 219 + new); `npx astro build` passes.
- Merges to `main`; ships to Kharis via `merge main` + the one-time `community` add to Kharis's config.

## 7. Open questions (resolved)

- Moderation = approve-before-publish. ✔
- "I prayed" counter included, soft per-device guard, no Turnstile/login. ✔
- Gated behind a new `community` feature flag, default on. ✔
- Private requests never appear on the wall (only public + approved). ✔
