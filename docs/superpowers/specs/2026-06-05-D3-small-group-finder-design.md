# D3: Small-Group Finder — Design Spec

**Date:** 2026-06-05
**Status:** Approved (brainstorming)
**Roadmap:** Phase D (Community & Care), sub-project 3 of 5.
**Working dir:** `stitch_kharisbuilders_church_web_design`

## 1. Goal

A public `/groups` page where visitors **browse and filter** small groups (by day, format, audience)
and **express interest** in a specific group, plus admin CRUD for groups and an interest list for
follow-up. Reuses the existing `community` feature flag and the established CRUD-list + form-capture
patterns. No map (deferred).

## 2. What already exists (mirrored)

- CRUD-list pattern (`ministries`): table + `src/lib/db/ministries.ts` (list/get/create/update/delete/
  setPublished/setImage) + admin `list`/`new`/`[id]` pages + `api/admin/ministries.ts` + a `*Form.astro`
  component + image upload to an R2 prefix (`PUBLIC_PREFIXES` in `src/pages/media/[...key].ts`).
- Form-capture pattern (`connect`): `handleX(env, form, ip)` = zod → Turnstile → insert → `notifyStaff`
  → redirect; admin list with status actions + delete.
- Options-registry pattern (`src/lib/connect/steps.ts`).
- `feature('community')` flag (already on all branches).

## 3. Data model (2 migrations)

**`0022_groups.sql`:**
```sql
CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  day TEXT,
  time TEXT,
  location TEXT,
  format TEXT NOT NULL DEFAULT 'in_person',   -- in_person | online | hybrid
  audience TEXT NOT NULL DEFAULT 'everyone',
  leader TEXT,
  image_key TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);
```

**`0023_group_interests.sql`:**
```sql
CREATE TABLE IF NOT EXISTS group_interests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER,
  group_name TEXT,            -- snapshot, so the admin shows the group even if it is later deleted
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',  -- new | contacted | done
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```
No FK constraint on `group_id` (the `group_name` snapshot is the source of truth for display);
orphans after a group delete are acceptable at church scale.

## 4. Components

### 4.1 Options registry — `src/lib/community/group-options.ts`

`DAYS` (Sunday…Saturday + 'Various'), `FORMATS` (`in_person`/`online`/`hybrid`), `AUDIENCES`
(`everyone`/`men`/`women`/`young_adults`/`couples`/`youth`/`seniors`/`families`) — each `{key,label}`.
Exports `FORMAT_KEYS`, `AUDIENCE_KEYS`, and `optionLabel(list, key)`. Drives the admin form selects, the
finder filters, and the public display badges (one place to edit).

### 4.2 Schemas (in `src/lib/db/schemas.ts`)

```ts
export const GroupInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  day: z.string().trim().max(40).optional().or(z.literal('')),
  time: z.string().trim().max(40).optional().or(z.literal('')),
  location: z.string().trim().max(160).optional().or(z.literal('')),
  format: z.string().trim().max(20).default('in_person'),
  audience: z.string().trim().max(30).default('everyone'),
  leader: z.string().trim().max(120).optional().or(z.literal('')),
  sort_order: z.coerce.number().int().min(0).default(0),
  published: z.coerce.boolean().default(false),
});
export const GroupInterestInputSchema = z.object({
  group_id: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  message: z.string().trim().max(2000).optional().or(z.literal('')),
});
```

### 4.3 Data access

- `src/lib/db/groups.ts` (mirror `ministries.ts`): `Group`/`GroupFull` types, `listPublishedGroups`
  (`published=1` ordered by `sort_order, id`), `listAllGroups`, `getGroupById`, `createGroup`,
  `updateGroup`, `setGroupPublished`, `deleteGroup`, `setGroupImage`.
- `src/lib/db/group-interests.ts`: `GroupInterest` type; `createGroupInterest(db, { group_id,
  group_name, name, email, message })`; `listGroupInterests(db, limit)` (newest first);
  `setGroupInterestStatus(db, id, status)`; `deleteGroupInterest(db, id)`.

### 4.4 Handler — `src/lib/community/group-interest-handler.ts`

`handleGroupInterest(env, form, ip)`:
1. `GroupInterestInputSchema.safeParse` (group_id + name + email + message).
2. `getGroupById(env.DB, group_id)`; if missing or not published → `/groups?interest=err`.
3. `verifyTurnstile` → fail → `/groups?interest=err`.
4. `createGroupInterest` with `group_name = group.name` (snapshot).
5. `notifyStaff('New group interest', \`${name} (${email}) is interested in ${group.name}\`)`.
6. `/groups?interest=ok`.
Pure; unit-tested.

### 4.5 Public page — `src/pages/groups.astro`

- `if (!feature('community')) return Astro.redirect('/')`.
- `PageHero` "Find a Group".
- **Filters:** three `<select>`s (day / format / audience, options from the registry) + a "clear".
- **Cards:** each published group as a card carrying `data-day`, `data-format`, `data-audience` —
  name, day·time, location, format+audience badges, leader, description, optional image (`mediaUrl(
  image_key)` with a placeholder fallback), and an **"I'm interested"** button.
- **One shared interest form** (a single Turnstile widget) at the bottom: hidden `group_id`, a visible
  "Interested in: <group name>" line, name/email/message, submit → `/api/forms/group-interest`. The
  card buttons set the hidden `group_id` + label and scroll to the form (inline JS).
- Empty state when no published groups. Success/err banner from `?interest=ok|err`.
- A client script filters cards by the three selects (show/hide via `data-*`).

### 4.6 API — `src/pages/api/forms/group-interest.ts`

`POST` → `handleGroupInterest(env, form, ip)` → redirect.

### 4.7 Admin

- **Groups CRUD** (mirror ministries): `src/pages/admin/groups.astro` (list with publish toggle + edit/
  delete), `groups/new.astro`, `groups/[id].astro`, `src/components/admin/GroupForm.astro` (text fields
  + day/format/audience selects + image upload, `enctype=multipart/form-data`),
  `src/pages/api/admin/groups.ts` (create/update/delete/publish; image → `uploadImage(MEDIA, file,
  'groups')` + `setGroupImage`). Add `groups/` to `PUBLIC_PREFIXES` in `src/pages/media/[...key].ts`.
- **Group interests:** `src/pages/admin/group-interests.astro` (list with group name, contact, message,
  status badge, mark Contacted/Done/reopen, delete) + `src/pages/api/admin/group-interests.ts`
  (`action ∈ {status, delete}`).
- **Admin nav:** add "Groups" + "Group Signups", gated by `community`.

### 4.8 Discovery (no public nav item — nav is at 9)

- Footer "Groups" link (gated `community`, conditional spread next to "Next Steps").
- A "Find a group" CTA/link on the Ministries page (`src/pages/ministries.astro`), gated `community`.

## 5. Testing

Offline (Vitest + Miniflare `createTestDb`):
- `group-options.test.ts`: keys unique per list; `optionLabel(FORMATS, 'in_person')` returns the label;
  unknown key returns the key.
- `groups.test.ts`: `createGroup` + `listPublishedGroups` returns only published, ordered by
  `sort_order`; `getGroupById`; `setGroupPublished`; `deleteGroup`.
- `group-interests.test.ts`: `createGroupInterest` stores the snapshot `group_name`; `listGroupInterests`
  newest first; `setGroupInterestStatus`; `deleteGroupInterest`.
- `group-interest-handler.test.ts`: valid (existing published group) → `/groups?interest=ok` + a row
  with the snapshot name; non-existent / unpublished group_id → `/groups?interest=err` and nothing
  stored; bad Turnstile → err.

Admin pages + the finder are verified by `astro build`; the live finder/filtering is checked post-deploy.

## 6. Definition of Done

- `/groups` renders when `feature('community')` (redirects when off); lists published groups; the three
  filters narrow the cards; "I'm interested" captures an interest with the group-name snapshot and
  notifies staff; an interest in a missing/unpublished group is rejected.
- Admin can CRUD groups (incl. image + publish) and review/triage interests (status + delete).
- Footer + Ministries-page discovery appear only when `community` is on.
- Migrations `0022` + `0023` applied locally; `npx vitest run` green (current 240 + new); `npx astro
  build` passes.
- Merges to `main`; ships to Kharis via `merge main` + apply `0022`/`0023` remote + deploy (no
  config-structure change — `community` already on `kharis`).

## 7. Open questions (resolved)

- No map (filterable text finder); a map is a later D3b. ✔
- Per-group interest capture into `group_interests` (vs reuse Connect / contact-only). ✔
- Fields/filters = day · format · audience (+ name/description/time/location/leader/image). ✔
- `group_name` snapshot + no FK (interests survive a group delete). ✔
- One shared interest form on the finder (buttons populate it) — single Turnstile widget. ✔
