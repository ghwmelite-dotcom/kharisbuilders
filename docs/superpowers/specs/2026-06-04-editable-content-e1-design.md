# Phase E1: Editable Page Text (Content CMS) — Design Spec

**Date:** 2026-06-04
**Status:** Approved (design), pending spec review
**Project:** KharisBuilders church website (Astro 6 SSR + Cloudflare D1, gated admin via Cloudflare Access). Goal: non-technical staff maintain the whole site.

---

## 1. Purpose & Goals

Turn the **hardcoded singleton copy** across the public pages into content staff can edit from the admin, without touching code — and without risking a broken site.

**Success criteria**
- Staff can edit every meaningful text block on Home, About, and Visit from a clean, labeled admin editor organized by page.
- The site looks **identical** until something is edited (defaults preserved); clearing a field restores the default.
- A missing or blank content key never breaks a page.
- Editing is reversible and safe (allowlisted keys; gated admin).

**Decisions locked in (brainstorming):** all meaningful content editable; images = E3; lists (leadership, journey, quick-link cards) = E2; phased rollout (this is E1).

---

## 2. Scope

**In scope (E1):** singleton text content on Home / About / Visit + the home giving banner, pastor section, scripture band, and the hero gathering-countdown schedule. A `page_content` store, a field registry, a content helper, per-page admin editors, a gated save route, and tests.

**Out of scope:** repeating lists (leadership team, journey timeline, home quick-link cards) → **E2**; replaceable page images → **E3**; sermons/events/ministries/funds/settings (already editable). Nav item names and form field labels stay code-defined (UI chrome, per the "all meaningful content, not chrome" decision).

---

## 3. Architecture — defaults-with-fallback

The core safety property: **every field has a default (the current copy)**, and the page renders `stored value ?? default`. The field registry is the single source of truth for both the admin editor and the defaults, so they cannot drift.

```
Field registry (content-fields.ts)
  └─ per page: groups → fields { key, label, type, default, help? }
        ├─ derives CONTENT_DEFAULTS (key → default)   ← used by the content helper
        ├─ derives the key allowlist                  ← used by the save route
        └─ drives the admin editor UI                 ← labeled, grouped fields

page render: stored = getAllContent(db); c = makeContent(stored)
             c('home.hero_line1')  →  stored['home.hero_line1'] ?? default ?? ''

admin save:  POST /api/admin/content (gated)
             → validate keys ∈ allowlist → setContent(db, entries) (upsert)
```

---

## 4. Data Model

### New table `page_content`
| column | type | notes |
|--------|------|-------|
| key | TEXT PRIMARY KEY | namespaced, e.g. `home.hero_line1` |
| value | TEXT NOT NULL | the staff-entered content |
| updated_at | TEXT NOT NULL DEFAULT (datetime('now')) | |
| updated_by | TEXT | admin email |

Only **non-default** values are stored; defaults live in code. A row exists only after staff save that field.

---

## 5. Components & Boundaries

**Field registry (`src/lib/content/fields.ts`)** — pure data:
```ts
export type FieldType = 'text' | 'textarea' | 'url';
export interface ContentField { key: string; label: string; type: FieldType; default: string; help?: string }
export interface ContentGroup { title: string; fields: ContentField[] }
export interface ContentPage { slug: 'home' | 'about' | 'visit'; title: string; groups: ContentGroup[] }
export const CONTENT_PAGES: ContentPage[];
// derived helpers:
export function contentDefaults(): Record<string, string>;   // key -> default (all pages)
export function contentKeySet(): Set<string>;                // allowlist
export function getContentPage(slug: string): ContentPage | undefined;
```
Keys (representative, full list in the plan):
- `home.*`: hero_kicker, hero_line1, hero_line2, cta1_label, cta1_href, cta2_label, cta2_href, gathering_schedule (JSON), pastor_eyebrow, pastor_heading, pastor_body1, pastor_body2, pastor_name, scripture_verse, scripture_ref, giving_eyebrow, giving_heading, giving_body, giving_cta1_label, giving_cta2_label
- `about.*`: hero_kicker, hero_title, vision_heading, vision_body, mission_heading, mission_body
- `visit.*`: hero_kicker, hero_title, hero_subtitle, expect_heading, expect_q1_title, expect_q1_body, expect_kids_title, expect_kids_body, expect_service_title, expect_service_body, expect_afterward_title, expect_afterward_body, parking_body

**Content helper (`src/lib/content/content.ts`)**:
```ts
import { contentDefaults } from './fields';
export type ContentFn = (key: string) => string;
export function makeContent(stored: Record<string, string>): ContentFn; // stored[key] ?? default ?? ''
```

**Data access (`src/lib/db/content.ts`)** — mirrors `settings.ts`:
- `getAllContent(db)` → `Record<string,string>`; `setContent(db, entries, email)` (upsert, sets updated_by). (No need for getContent single.)

**Save route (`src/pages/api/admin/content.ts`)** — gated `POST`:
- `requireAdmin`; read form; keep only keys ∈ `contentKeySet()`; `setContent`; 303 → back to `/admin/content/<page>`. Unknown keys ignored (defensive).

**Admin editors (`src/pages/admin/content/[page].astro`)** — gated page:
- `getAdminEmail`; load `getContentPage(params.page)` (404→redirect if unknown) + `getAllContent`; render each group as a labeled fieldset; each field pre-filled with `stored[key] ?? default`; textarea via `set:text` (whitespace gotcha); a hidden `_page` for the redirect. One save button.
- A small index `src/pages/admin/content/index.astro` linking the three pages (or fold into nav).

**Admin nav (`src/layouts/AdminLayout.astro`)** — add a "Content" group: Home / About / Visit (3 entries or one "Content" → index).

**Public pages** — replace hardcoded singletons with `c(key)`:
- `index.astro`, `about.astro`, `visit.astro` each: `const c = makeContent(await getAllContent(env.DB).catch(()=>({})))` in frontmatter, then `{c('home.hero_line1')}` etc. The hero countdown reads `c('home.gathering_schedule')` (JSON) instead of the hardcoded `sched`.

---

## 6. Error Handling / Safety

- **Missing/blank value** → helper returns the registry default → page always renders sensible copy.
- **DB unavailable** on a public page → `getAllContent` catch → `{}` → all defaults render (page never 500s). Mirrors existing settings try/catch.
- **Unknown keys on save** → filtered out by the allowlist; never written.
- **Bad JSON** in `gathering_schedule` → the hero countdown JS try/catches parse and falls back to the default schedule; admin shows the raw JSON with help text (same UX as the existing `service_times` field).
- **Reversibility** → clearing a field saves an empty string; the helper treats empty as "use default" (so blank = restore default). (Implementation note: `makeContent` returns default when stored value is empty/whitespace, not just missing.)

---

## 7. Security

- Save route gated by `requireAdmin` + Cloudflare Access on `/api/admin/*`; editor pages gated by `getAdminEmail`.
- Key allowlist prevents arbitrary writes.
- Content is staff-authored and rendered as **text** (Astro auto-escapes `{...}` expressions); no `set:html` for content values → no stored-XSS surface. Where multi-paragraph is needed, render with `white-space: pre-line` (newlines become line breaks) rather than HTML.
- No new secrets.

---

## 8. Testing Strategy

**Pure unit tests:**
- `fields.ts`: `contentDefaults()` has an entry for every field; `contentKeySet()` has no duplicates; every field key is namespaced `page.field`.
- `content.ts`: `makeContent` returns stored value when present, default when missing **and when stored value is empty/whitespace**.

**D1 (Miniflare) tests:**
- `content.ts` data access: `setContent` upsert (insert then update same key); `getAllContent` returns the map; `updated_by` recorded.

**Manual/dev:** edit a field in `/admin/content/home`, confirm the home page reflects it; clear it, confirm the default returns; verify a non-allowlisted key is ignored.

Migrations auto-applied by the harness.

---

## 9. Rollout
1. Build + unit/D1 tests green; build green.
2. Apply the `page_content` migration local + remote.
3. Deploy. No seeding needed (defaults are in code; the table starts empty and fills as staff edit).
4. Verify an edit round-trips on the live admin (behind Access).

---

## 10. Open Questions (resolved defaults)
- Store name `page_content` (distinct from `site_settings`). Singleton text only in E1.
- `gathering_schedule` stays a JSON field (consistent with `service_times`); a friendlier editor can come later.
- Editor grouping mirrors the visual sections (Hero / Pastor / Scripture / Giving …) for intuitiveness.
- "Restore default = clear the field" — blank/whitespace stored values resolve to the default in `makeContent`.
