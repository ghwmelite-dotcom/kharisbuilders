# Phase E2: Editable Lists (Leadership · Journey · Home Cards) — Design Spec

**Date:** 2026-06-04
**Status:** Approved (design), pending spec review
**Builds on:** E1 (editable page text) and the existing CRUD + R2-upload patterns (sermons/events/ministries/funds).

---

## 1. Purpose & Goals

Turn the three remaining hardcoded **repeating lists** into admin-managed content so staff can add/edit/reorder/remove items — including their images — without code.

**Success criteria**
- Staff can fully manage the About **leadership team**, the About **journey timeline**, and the home **quick-link cards** from the admin (create, edit, delete, reorder, upload image).
- The site looks **identical** until edited (tables seeded with the current items).
- Emptying a list degrades gracefully (section hides or shows a friendly empty state), never breaks the page.

**Decisions locked in (brainstorming):** these three lists as CRUD; images handled here via the existing R2 upload; singleton page images remain E3; phased.

---

## 2. Scope

**In scope (E2):** `leaders`, `journey`, `home_cards` tables + data access; admin list + new/edit/delete editors with image upload and sort order; seed with current items; render the About leadership/timeline and home intro cards from D1; tests.

**Out of scope:** singleton page images (hero backgrounds, pastor portrait, Vision & Mission image, scripture/giving backgrounds) → **E3**; the ministries bento (already D1-driven). Text singletons → done in E1.

---

## 3. Data Model (new migrations)

All three mirror the `funds`/`ministries` shape: integer PK, `sort_order`, `image_key` (R2), `created_at/updated_at/updated_by`.

### `leaders`
| column | type | notes |
|--------|------|-------|
| id | INTEGER PK | |
| name | TEXT NOT NULL | |
| role | TEXT | |
| image_key | TEXT | R2 key (prefix `leaders/`) |
| sort_order | INTEGER NOT NULL DEFAULT 0 | |
| created_at/updated_at | TEXT DEFAULT datetime('now') | |
| updated_by | TEXT | |

### `journey`
| column | type | notes |
|--------|------|-------|
| id | INTEGER PK | |
| year | TEXT NOT NULL | e.g. "2012" |
| title | TEXT NOT NULL | |
| body | TEXT | |
| image_key | TEXT | R2 key (prefix `journey/`) |
| sort_order | INTEGER NOT NULL DEFAULT 0 | |
| created_at/updated_at/updated_by | | |

### `home_cards`
| column | type | notes |
|--------|------|-------|
| id | INTEGER PK | |
| eyebrow | TEXT | e.g. "New Here?" |
| title | TEXT NOT NULL | e.g. "Plan a Visit" |
| description | TEXT | |
| href | TEXT NOT NULL | e.g. "/visit" |
| image_key | TEXT | R2 key (prefix `home-cards/`) |
| sort_order | INTEGER NOT NULL DEFAULT 0 | |
| created_at/updated_at/updated_by | | |

**Seeds** (`db/seed_lists.sql`, applied local + remote, `INSERT OR IGNORE`): the current 3 leaders, 3 journey milestones, 3 home cards — with `image_key` NULL (pages fall back to the existing bundled images by sort position until staff upload).

---

## 4. Components & Boundaries

**Data access (`src/lib/db/{leaders,journey,homeCards}.ts`)** — each follows the funds pattern:
- `listX(db)` (ordered by `sort_order, id`), `getXById(db,id)`, `createX(db,input,email)`, `updateX(db,id,input,email)`, `deleteX(db,id)`, `setXImage(db,id,key)`.
- Zod input schemas in `schemas.ts`: `LeaderInput {name, role?, sort_order}`, `JourneyInput {year, title, body?, sort_order}`, `HomeCardInput {eyebrow?, title, description?, href, sort_order}`.

**Admin routes (`src/pages/api/admin/{leaders,journey,home-cards}.ts`)** — gated; same shape as `sermons.ts`: parse → create/update (capture id) → if an `image` File present, `uploadImage(env.MEDIA, image, '<prefix>')` + `setXImage`; `delete` removes the row (+ best-effort `removeSermon`-style R2 cleanup is out of scope — orphan sweep deferred, as in A1). 303 back to the list.

**Admin forms + pages:**
- `src/components/admin/{LeaderForm,JourneyForm,HomeCardForm}.astro` — like `MinistryForm` (fields + `enctype=multipart/form-data` + file input + current image_key note).
- `src/pages/admin/{leaders,journey,home-cards}.astro` (list, "+ New", edit links, delete) + `.../new.astro` + `.../[id].astro` (like the funds admin pages).
- AdminLayout nav: add **Leadership**, **Journey**, **Home Cards** (grouped after "Content").

**Public pages:**
- `about.astro`: replace the hardcoded `leaders`/`journey` arrays with `listLeaders(env.DB)` / `listJourney(env.DB)`; image src = `mediaUrl(image_key) ?? <bundled fallback by index>`. Empty list → hide that section (or a small "coming soon" line).
- `index.astro`: replace the hardcoded `introCards` array with `listHomeCards(env.DB)`; image = `mediaUrl(image_key) ?? <bundled fallback by index>`; if empty, fall back to the current 3 defaults (so the hero's signature device never disappears).

**Image serving:** the existing `/media/[...key]` route already serves `leaders/`, `journey/`, `home-cards/`? — NO: it allowlists `sermons/ events/ ministries/`. **Add the three new prefixes** to `PUBLIC_PREFIXES` in `src/pages/media/[...key].ts`.

---

## 5. Error Handling / Safety

- **DB failure / empty list** on a public page → caught; About leadership/journey sections hide gracefully; home cards fall back to the 3 bundled defaults (signature device preserved).
- **Image upload failure** (bad type/size) → the existing admin try/catch returns 400 (same as sermons).
- **Delete** is confirmed in the UI (like ministries) and is a hard delete (no children).
- Render is escaped text (Astro `{...}`); `href` is staff-entered — keep it a plain `href` (no JS); internal links expected.

## 6. Security
- Admin routes gated by `requireAdmin` + Cloudflare Access; image upload reuses the validated `uploadImage` (type allowlist + 6 MB cap).
- New media prefixes added to the public media route's allowlist so only images under those prefixes serve (consistent with A1 hardening).
- No new secrets.

## 7. Testing Strategy
**D1 (Miniflare) tests** per table: create→list ordered by sort_order→update→setImage→delete; seed-shaped inputs. Reuse `tests/helpers/d1`.
**Pure:** zod schemas accept valid input, reject missing required (name/title/href).
**Manual/dev:** add a leader with a photo → appears on About; reorder via sort_order; delete → section adjusts; empty home_cards → home falls back to defaults.

## 8. Rollout
1. Build + tests green.
2. Apply migrations + `seed_lists.sql` local + remote.
3. Deploy. Site unchanged (seeded). Staff manage lists from admin; uploaded images appear immediately.

## 9. Open Questions (resolved defaults)
- Image prefixes: `leaders/`, `journey/`, `home-cards/` (added to media allowlist).
- Home cards empty → render the 3 code defaults (keep the hero overlap device); About lists empty → hide section.
- Reorder via a numeric `sort_order` field (consistent with ministries/funds); drag-reorder deferred.
- Orphaned R2 objects on image replace/delete — deferred sweep (same stance as A1).
