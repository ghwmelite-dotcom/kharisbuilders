# D4 — Volunteer Signups (Opportunity Board) Design

**Date:** 2026-06-06
**Roadmap:** D (Community & Care), sub-project D4. Follows D1 (prayer wall), D2 (connect/next-steps), D3 (small-group finder).
**Status:** Approved — ready for implementation plan.

## Purpose

The connect card already captures a soft, unstructured "I want to serve / volunteer" signal (a checkbox). D4 provides the **structured** path: a public opportunity board where people browse specific volunteer roles, filter by area and commitment, and sign up for a named role. Staff manage roles and triage signups from admin. This mirrors the D3 group-finder architecture almost exactly.

## Scope

**In scope:** a published list of volunteer roles, a public `/serve` board with two client-side filters + per-role signup, the signup capture pipeline, admin CRUD for roles, and admin signup triage. Gated behind the existing `community` feature flag.

**Out of scope (YAGNI):** shift scheduling, calendars, slot/capacity counting, background-check workflows, volunteer accounts/portals, recurring rosters. Requirements (e.g. "background check required") are a free-text note on a role, not a workflow.

## Data Model

Two migrations, mirroring D3's `groups` / `group_interests` shape.

### `migrations/0024_volunteer_roles.sql`
```sql
CREATE TABLE IF NOT EXISTS volunteer_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  area TEXT NOT NULL DEFAULT 'general',
  commitment TEXT NOT NULL DEFAULT 'as_needed',
  schedule TEXT,            -- free-text "when", e.g. "Sundays, 8-10am"
  requirements TEXT,        -- free-text, optional, e.g. "Background check required"
  leader TEXT,
  image_key TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);
```

### `migrations/0025_volunteer_signups.sql`
```sql
CREATE TABLE IF NOT EXISTS volunteer_signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_id INTEGER,
  role_name TEXT,           -- SNAPSHOT of the role name at signup time; no FK
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

The `role_name` snapshot (no foreign key) means a signup remains meaningful even if its role is later deleted — identical decision to D3's `group_name`.

## Options Registry

`src/lib/community/volunteer-options.ts` — same `Option { key, label }` shape and `optionLabel(list, key)` helper as `group-options.ts`.

- `AREAS`: `general` (General / wherever needed), `kids` (Kids ministry), `worship` (Worship & music), `hospitality` (Hospitality & welcome), `media` (Media & tech), `parking` (Parking & safety), `outreach` (Outreach & missions), `facilities` (Facilities & setup), `prayer` (Prayer team), `admin` (Admin & office).
- `COMMITMENTS`: `one_time` (One-time), `weekly` (Weekly), `monthly` (Monthly), `as_needed` (As needed / on-call).
- Exports `AREA_KEYS`, `COMMITMENT_KEYS` for validation use.

## Schemas

Appended to `src/lib/db/schemas.ts`:

- `VolunteerRoleInputSchema`: `name` (1–120), `description` (≤2000, optional/''), `area` (≤30, default 'general'), `commitment` (≤20, default 'as_needed'), `schedule` (≤120, optional/''), `requirements` (≤500, optional/''), `leader` (≤120, optional/''), `sort_order` (coerce int ≥0, default 0), `published` (coerce boolean, default false).
- `VolunteerSignupInputSchema`: `role_id` (coerce positive int), `name` (1–120), `email` (email, ≤200), `phone` (≤40, optional/''), `message` (≤2000, optional/'').

## Data Access

- `src/lib/db/volunteer-roles.ts` — mirrors `groups.ts` (no slug): `VolunteerRole` / `VolunteerRoleFull` interfaces; `listPublishedRoles`, `listAllRoles`, `getRoleById`, `createRole`, `updateRole`, `setRolePublished`, `deleteRole`, `setRoleImage`. Ordered by `sort_order ASC, name ASC`.
- `src/lib/db/volunteer-signups.ts` — mirrors `group-interests.ts`: `VolunteerSignup` interface + `VolunteerSignupStatus` ('new' | 'contacted' | 'done'); `createVolunteerSignup` (takes the `role_name` snapshot + `phone`), `listVolunteerSignups` (newest first), `setVolunteerSignupStatus`, `deleteVolunteerSignup`.

## Capture Pipeline

`src/lib/community/volunteer-handler.ts` — `handleVolunteerSignup(env, form, ip)` following the established `handleX` pattern:

1. `VolunteerSignupInputSchema.safeParse({ role_id, name, email, phone, message })` → on failure, `{ status: 303, redirect: '/serve?signup=err' }`.
2. `getRoleById` → if missing or not published, `/serve?signup=err`.
3. `verifyTurnstile` → on failure, `/serve?signup=err`.
4. `createVolunteerSignup` with the role's name snapshot.
5. `notifyStaff(env, 'New volunteer signup', '<name> (<email>) wants to serve in <role>')`.
6. `{ status: 303, redirect: '/serve?signup=ok' }`.

Endpoint: `src/pages/api/forms/volunteer-signup.ts` (thin POST → handler → redirect), same as `group-interest.ts`.

## Public Board — `src/pages/groups.astro` analogue at `src/pages/serve.astro`

- Redirects to `/` when `feature('community')` is off.
- `PageHero` "Serve" (uses `cimg('pages.ministries_hero')` as the backdrop, same as `/groups`).
- `?signup=ok|err` banner.
- Two filter `<select>`s — **Area** and **Commitment** — built from the registry, plus an "Any" default option each.
- Cards: image (`mediaUrl(role.image_key) ?? PLACEHOLDER.card`), name, `data-area` / `data-commitment` for client-side filtering, badges via `optionLabel`, free-text `schedule` line, optional `requirements` note, optional leader, and an "I want to serve →" button carrying `data-id` / `data-name`.
- One shared signup form (hidden `role_id`, a label span the buttons update, name/email/phone/message + Turnstile) that card buttons populate and scroll to.
- Inline `<script>`: filter show/hide (with an empty-state message) + button-to-form wiring. Identical mechanics to `/groups`.

## Discovery

- Footer: add a "Serve" link (`/serve`), gated `community`, alongside the existing "Groups" and "Next Steps" links.
- A CTA band on the **About** page ("Find your place — serve with us → /serve"), gated `community`. Placed on About (not Ministries) because Ministries already carries the Groups CTA and serving fits the About / get-involved narrative.
- No top-nav item (keeps the public nav lean — same decision as D3).

## Admin

Mirrors D3's admin surface:

- `src/components/admin/VolunteerRoleForm.astro` — `Field` for text inputs; raw `<select>` for **area** and **commitment** (registry-driven); `schedule`, `requirements`, `leader`, `sort_order`, `description`, image upload, `published` checkbox.
- `src/pages/admin/volunteer-roles.astro` (list) + `volunteer-roles/new.astro` + `volunteer-roles/[id].astro` + `src/pages/api/admin/volunteer-roles.ts` (create/update/delete/toggle + image upload to the `volunteer/` R2 prefix). Uses `listAllRoles` from `volunteer-roles.ts`.
- `src/pages/admin/volunteer-signups.astro` (triage: status new/contacted/done + delete, inline-hex status badges) + `src/pages/api/admin/volunteer-signups.ts`.
- `src/pages/media/[...key].ts`: add `'volunteer/'` to `PUBLIC_PREFIXES`.
- `src/layouts/AdminLayout.astro`: add nav entries "Serve Roles" (`/admin/volunteer-roles`, key `volunteer-roles`) and "Serve Signups" (`/admin/volunteer-signups`, key `volunteer-signups`), both `gate: 'community'`.

## Error Handling

- All public DB reads wrapped in `try/catch` with empty-list fallbacks, so the page renders even when bindings are unavailable (matches `/groups`).
- Invalid or unpublished-role signups redirect to `/serve?signup=err` without writing.
- `notifyStaff` is best-effort (its own failure does not block the success redirect), consistent with existing handlers.
- Admin mutations return HTTP 400 on schema-parse failure (mirrors `api/admin/groups.ts`).

## Testing (TDD)

Unit tests (Vitest + Miniflare), mirroring D3:
1. `tests/community/volunteer-options.test.ts` — unique keys; `optionLabel` label/fallback.
2. `tests/db/volunteer-roles.test.ts` — published-only + ordering; list-all includes drafts; toggle + delete.
3. `tests/db/volunteer-signups.test.ts` — `role_name` snapshot + `phone` stored; newest first; status + delete.
4. `tests/community/volunteer-handler.test.ts` — captures a published-role signup with snapshot name; rejects missing/unpublished role without storing.

Pages are verified by `astro build`. Target ≈ 258 tests total (249 + ~9).

## Definition of Done

- `/serve` renders when `community` is on (redirects when off), lists published roles, both filters narrow the cards, and "I want to serve" captures a signup with the role-name snapshot + notifies staff; missing/unpublished roles are rejected.
- Admin CRUD for roles (incl. image + publish) and signup triage (status + delete) work.
- Footer "Serve" link + About-page CTA appear only when `community` is on.
- Migrations `0024` + `0025` applied locally; `npx vitest run` green; `npx astro build` passes.
- Merges to `main`; ships to Kharis (apply `0024`/`0025` remote, deploy, verify `/serve` 200).

## Next

D5 — event RSVP + `.ics` calendar download.
