# Phase 4B: Admin CRUD, Settings & Registrations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the admin functional — staff can create/edit/delete and publish/unpublish sermons, events, and ministries; edit site settings; and view per-event registrations — all gated and audited. R2 image uploads are deferred to Phase 4C.

**Architecture:** Gated admin API routes under `/api/admin/*` each call `requireAdmin(request, env)` (wraps `getAdminEmail`; returns the email or a 403 `Response`). Mutations use zod-validated `FormData`, write through new mutation functions in `src/lib/db/*` (prepared statements; record `updated_by = email`), and redirect back to the list. HTML forms post `_action` (create | update | delete | toggle) to one route per entity, so everything works without client JS and Astro's CSRF origin check applies. Slugs come from a tested `slugify()` with uniqueness handled by the unique index (retry-with-suffix on conflict). All mutation/data functions are Miniflare-tested; the route wrappers stay thin.

**Tech Stack:** Astro 6 SSR, Cloudflare D1, Zod, Vitest + Miniflare harness, Cloudflare Access (gate).

**Working directory:** `C:\dev\Projects\KharisBuilders Project\stitch_kharisbuilders_church_web_design` (git repo, branch off `main`).

> **Conventions:** binding via `env` from `src/lib/runtime.ts` in routes/pages only; data + helpers take params and are unit-tested. Defined theme tokens only. Admin pages keep the Phase-4A guard (`getAdminEmail(...) ?? redirect('/admin/denied')`). Reference admin mockups for field sets.

---

## File Structure (created/modified)

```
src/lib/slug.ts                        # slugify(text) + uniqueSlug(db, table, base)
src/lib/admin-auth.ts                  # MODIFY: add requireAdmin(request, env, devMode)
src/lib/db/schemas.ts                  # MODIFY: SermonInput/EventInput/MinistryInput/SettingsInput schemas
src/lib/db/sermons.ts                  # MODIFY: createSermon/updateSermon/deleteSermon/setSermonPublished/getSermonById
src/lib/db/events.ts                   # MODIFY: createEvent/updateEvent/deleteEvent/setEventPublished/getEventById
src/lib/db/ministries.ts              # MODIFY: create/update/delete/setPublished/getById
src/lib/db/settings.ts                 # MODIFY: setSettings(db, map)
src/lib/db/registrations.ts            # MODIFY: listRegistrationsForEvent(db, eventId)
src/pages/api/admin/sermons.ts         # gated POST: create|update|delete|toggle
src/pages/api/admin/events.ts
src/pages/api/admin/ministries.ts
src/pages/api/admin/settings.ts
src/pages/admin/sermons/new.astro      # create form
src/pages/admin/sermons/[id].astro     # edit form
src/pages/admin/events/new.astro
src/pages/admin/events/[id].astro
src/pages/admin/events/[id]/registrations.astro
src/pages/admin/ministries/new.astro
src/pages/admin/ministries/[id].astro
src/pages/admin/settings.astro
src/pages/admin/sermons.astro          # MODIFY: add New/Edit/Delete/Publish controls
src/pages/admin/events.astro           # MODIFY: same
src/pages/admin/ministries.astro       # MODIFY: same
src/components/admin/Row…              # (optional shared bits)
tests/slug.test.ts
tests/db/sermons-crud.test.ts
tests/db/events-crud.test.ts
tests/db/ministries-crud.test.ts
tests/db/settings-crud.test.ts
tests/db/registrations-list.test.ts
```

---

## Task 1: slugify + requireAdmin (TDD)

**Files:** Create `src/lib/slug.ts`, `tests/slug.test.ts`; Modify `src/lib/admin-auth.ts`.

- [ ] **Step 1: Write `tests/slug.test.ts` (failing)**

```ts
import { describe, it, expect } from 'vitest';
import { slugify, uniqueSlug } from '../src/lib/slug';

describe('slugify', () => {
  it('lowercases, trims, and hyphenates', () => {
    expect(slugify('  The Architecture of Faith: Part IV ')).toBe('the-architecture-of-faith-part-iv');
  });
  it('strips punctuation and collapses separators', () => {
    expect(slugify('Grace & Truth!!  Now')).toBe('grace-truth-now');
  });
  it('falls back to "item" for empty input', () => {
    expect(slugify('—')).toBe('item');
  });
});

describe('uniqueSlug', () => {
  it('returns the base when free, else appends -2, -3, ...', async () => {
    const existing = new Set(['gala', 'gala-2']);
    const check = async (s: string) => existing.has(s);
    expect(await uniqueSlug(check, 'gala')).toBe('gala-3');
    expect(await uniqueSlug(check, 'new')).toBe('new');
  });
});
```

- [ ] **Step 2: Run → fail** (`npx vitest run tests/slug.test.ts`).

- [ ] **Step 3: Implement `src/lib/slug.ts`**

```ts
export function slugify(text: string): string {
  const s = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'item';
}

/** Find a free slug given an existence check; appends -2, -3, ... on conflict. */
export async function uniqueSlug(exists: (slug: string) => Promise<boolean>, base: string): Promise<string> {
  if (!(await exists(base))) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`;
    if (!(await exists(candidate))) return candidate;
  }
  return `${base}-${Date.now()}`;
}
```

- [ ] **Step 4: Run → pass.**

- [ ] **Step 5: Add `requireAdmin` to `src/lib/admin-auth.ts`**

Append:
```ts
/** Returns the admin email, or a 403 Response when unauthenticated. Use in /api/admin routes. */
export function requireAdmin(
  request: Request,
  env: AdminAuthEnv,
  devMode = false,
): { email: string } | { response: Response } {
  const email = getAdminEmail(request, env, devMode);
  if (!email) return { response: new Response('Forbidden', { status: 403 }) };
  return { email };
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/slug.ts tests/slug.test.ts src/lib/admin-auth.ts
git commit -m "feat: slugify + uniqueSlug helpers and requireAdmin guard with tests"
```

---

## Task 2: Sermon mutations + schema (TDD)

**Files:** Modify `src/lib/db/schemas.ts`, `src/lib/db/sermons.ts`; Create `tests/db/sermons-crud.test.ts`.

- [ ] **Step 1: Add `SermonInputSchema` to `schemas.ts`**

```ts
export const SermonInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug: z.string().trim().max(200).optional().or(z.literal('')),
  speaker: z.string().trim().max(120).optional().or(z.literal('')),
  series: z.string().trim().max(120).optional().or(z.literal('')),
  scripture_ref: z.string().trim().max(120).optional().or(z.literal('')),
  video_url: z.string().trim().url().max(500),
  video_provider: z.enum(['youtube', 'vimeo']).default('youtube'),
  description: z.string().trim().max(4000).optional().or(z.literal('')),
  sermon_date: z.string().trim().max(20).optional().or(z.literal('')),
  published: z.coerce.boolean().default(false),
});
export type SermonInput = z.infer<typeof SermonInputSchema>;
```

- [ ] **Step 2: Write `tests/db/sermons-crud.test.ts` (failing)**

```ts
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { createSermon, updateSermon, deleteSermon, setSermonPublished, getSermonById } from '../../src/lib/db/sermons';

let ctx: TestDb;
beforeAll(async () => { ctx = await createTestDb(); });
afterAll(async () => { await ctx.dispose(); });

const base = { title: 'Faith', slug: '', speaker: 'P', series: '', scripture_ref: '', video_url: 'https://youtu.be/abc', video_provider: 'youtube' as const, description: '', sermon_date: '2024-01-01', published: true };

describe('sermon mutations', () => {
  it('creates with a generated unique slug and records updated_by', async () => {
    const id1 = await createSermon(ctx.db, base, 'admin@x');
    const id2 = await createSermon(ctx.db, base, 'admin@x'); // same title -> slug collision
    const a = await getSermonById(ctx.db, id1);
    const b = await getSermonById(ctx.db, id2);
    expect(a?.slug).toBe('faith');
    expect(b?.slug).toBe('faith-2');
    expect(a?.updated_by).toBe('admin@x');
  });
  it('updates fields', async () => {
    const id = await createSermon(ctx.db, { ...base, title: 'Hope' }, 'a@x');
    await updateSermon(ctx.db, id, { ...base, title: 'Hope Renewed', slug: 'hope' }, 'b@x');
    const s = await getSermonById(ctx.db, id);
    expect(s?.title).toBe('Hope Renewed');
    expect(s?.updated_by).toBe('b@x');
  });
  it('toggles published and deletes', async () => {
    const id = await createSermon(ctx.db, { ...base, title: 'Temp' }, 'a@x');
    await setSermonPublished(ctx.db, id, false);
    expect((await getSermonById(ctx.db, id))?.published).toBe(0);
    await deleteSermon(ctx.db, id);
    expect(await getSermonById(ctx.db, id)).toBeNull();
  });
});
```

- [ ] **Step 3: Run → fail.**

- [ ] **Step 4: Implement the mutations in `src/lib/db/sermons.ts`**

Add (uses `slugify`/`uniqueSlug` from `../slug`; `getSermonById` returns the full row incl. `published`/`updated_by`):
```ts
import { slugify, uniqueSlug } from '../slug';
import type { SermonInput } from './schemas';

export interface SermonFull extends Sermon {
  published: number;
  updated_by: string | null;
}

export async function getSermonById(db: D1Database, id: number): Promise<SermonFull | null> {
  const row = await db
    .prepare(
      `SELECT id, title, slug, speaker, series, scripture_ref, video_url, video_provider,
        thumbnail_key, description, sermon_date, published, updated_by FROM sermons WHERE id = ?`,
    )
    .bind(id)
    .first<SermonFull>();
  return row ?? null;
}

async function resolveSlug(db: D1Database, desired: string, title: string, excludeId?: number): Promise<string> {
  const base = slugify(desired || title);
  const exists = async (s: string) => {
    const row = await db.prepare('SELECT id FROM sermons WHERE slug = ?').bind(s).first<{ id: number }>();
    return row != null && row.id !== excludeId;
  };
  return uniqueSlug(exists, base);
}

export async function createSermon(db: D1Database, input: SermonInput, email: string): Promise<number> {
  const slug = await resolveSlug(db, input.slug ?? '', input.title);
  const r = await db
    .prepare(
      `INSERT INTO sermons (title, slug, speaker, series, scripture_ref, video_url, video_provider, description, sermon_date, published, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.title, slug, input.speaker || null, input.series || null, input.scripture_ref || null,
      input.video_url, input.video_provider, input.description || null, input.sermon_date || null,
      input.published ? 1 : 0, email,
    )
    .run();
  return Number(r.meta.last_row_id);
}

export async function updateSermon(db: D1Database, id: number, input: SermonInput, email: string): Promise<void> {
  const slug = await resolveSlug(db, input.slug ?? '', input.title, id);
  await db
    .prepare(
      `UPDATE sermons SET title=?, slug=?, speaker=?, series=?, scripture_ref=?, video_url=?, video_provider=?,
        description=?, sermon_date=?, published=?, updated_by=?, updated_at=datetime('now') WHERE id=?`,
    )
    .bind(
      input.title, slug, input.speaker || null, input.series || null, input.scripture_ref || null,
      input.video_url, input.video_provider, input.description || null, input.sermon_date || null,
      input.published ? 1 : 0, email, id,
    )
    .run();
}

export async function setSermonPublished(db: D1Database, id: number, published: boolean): Promise<void> {
  await db.prepare("UPDATE sermons SET published=?, updated_at=datetime('now') WHERE id=?").bind(published ? 1 : 0, id).run();
}

export async function deleteSermon(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM sermons WHERE id = ?').bind(id).run();
}
```

- [ ] **Step 5: Run → pass.**

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/sermons.ts src/lib/db/schemas.ts tests/db/sermons-crud.test.ts
git commit -m "feat: sermon CRUD mutations (slug + audit) with tests"
```

---

## Task 3: Event mutations + schema (TDD)

Mirror Task 2 for events. `EventInputSchema`: title, slug?, category?, description?, start_at (required), end_at?, location?, registration_enabled (coerce bool), capacity (coerce number nullable), published (coerce bool). Implement `createEvent/updateEvent/deleteEvent/setEventPublished/getEventById` (note `getEventById` differs from the Phase-3B `getEventForRegistration`; return the full editable row). Test create-with-unique-slug, update, toggle, delete. Commit `feat: event CRUD mutations with tests`.

> Full schema:
```ts
export const EventInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug: z.string().trim().max(200).optional().or(z.literal('')),
  category: z.string().trim().max(80).optional().or(z.literal('')),
  description: z.string().trim().max(4000).optional().or(z.literal('')),
  start_at: z.string().trim().min(1).max(30),
  end_at: z.string().trim().max(30).optional().or(z.literal('')),
  location: z.string().trim().max(200).optional().or(z.literal('')),
  registration_enabled: z.coerce.boolean().default(false),
  // Empty field => unlimited (undefined). Preprocess so '' doesn't coerce to 0 and fail positive().
  capacity: z.preprocess((v) => (v === '' || v == null ? undefined : v), z.coerce.number().int().positive().optional()),
  published: z.coerce.boolean().default(false),
});
export type EventInput = z.infer<typeof EventInputSchema>;
```
> `getEventById` selects all editable columns + `published`, `updated_by`. Use the same `resolveSlug` pattern against the `events` table.

---

## Task 4: Ministry mutations + schema (TDD)

Mirror for ministries. `MinistryInputSchema`: name, slug?, description, leader?, meeting_time?, sort_order (coerce number default 0), published (coerce bool). Implement `createMinistry/updateMinistry/deleteMinistry/setMinistryPublished/getMinistryById`. Test + commit `feat: ministry CRUD mutations with tests`.

> Schema:
```ts
export const MinistryInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().max(120).optional().or(z.literal('')),
  description: z.string().trim().min(1).max(2000),
  leader: z.string().trim().max(120).optional().or(z.literal('')),
  meeting_time: z.string().trim().max(120).optional().or(z.literal('')),
  sort_order: z.coerce.number().int().min(0).default(0),
  published: z.coerce.boolean().default(false),
});
export type MinistryInput = z.infer<typeof MinistryInputSchema>;
```

---

## Task 5: Settings update + registrations list (TDD)

**Files:** Modify `src/lib/db/settings.ts`, `src/lib/db/registrations.ts`, `src/lib/db/schemas.ts`; Create `tests/db/settings-crud.test.ts`, `tests/db/registrations-list.test.ts`.

- [ ] **Step 1: Add `setSettings(db, map)` to `settings.ts`**

```ts
export async function setSettings(db: D1Database, entries: Record<string, string>): Promise<void> {
  const stmts = Object.entries(entries).map(([key, value]) =>
    db.prepare("INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')").bind(key, value),
  );
  if (stmts.length) await db.batch(stmts);
}
```

- [ ] **Step 2: Add `listRegistrationsForEvent` to `registrations.ts`**

```ts
export interface RegistrationRow {
  id: number; name: string; email: string; phone: string | null; guests: number; created_at: string;
}
export async function listRegistrationsForEvent(db: D1Database, eventId: number): Promise<RegistrationRow[]> {
  const { results } = await db
    .prepare('SELECT id, name, email, phone, guests, created_at FROM event_registrations WHERE event_id = ? ORDER BY created_at ASC')
    .bind(eventId)
    .all<RegistrationRow>();
  return results;
}
```

- [ ] **Step 3: Write `tests/db/settings-crud.test.ts` + `tests/db/registrations-list.test.ts` (failing), then implement, then pass**

settings test: `setSettings(db, {address:'A', phone:'B'})` then `getAllSettings` shows both; calling again with `{address:'C'}` updates address, leaves phone. registrations test: insert event + 2 registrations, `listRegistrationsForEvent` returns 2 ordered by created_at.

- [ ] **Step 4: Commit** `feat: settings update + event registrations list with tests`.

---

## Task 6: Gated admin API routes (sermons, events, ministries, settings)

**Files:** Create `src/pages/api/admin/{sermons,events,ministries,settings}.ts`.

Each route: `requireAdmin` → 403 if unauthenticated; read `_action`; for create/update validate with the entity schema and call the mutation (passing the email); for delete/toggle read `id`/`published`; redirect back to the list (`/admin/<entity>`). Example (`sermons.ts`):
```ts
import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { requireAdmin } from '../../../lib/admin-auth';
import { SermonInputSchema } from '../../../lib/db/schemas';
import { createSermon, updateSermon, deleteSermon, setSermonPublished } from '../../../lib/db/sermons';

export const POST: APIRoute = async ({ request }) => {
  const auth = requireAdmin(request, env, import.meta.env.DEV);
  if ('response' in auth) return auth.response;
  const form = await request.formData();
  const action = String(form.get('_action') ?? '');
  const id = Number(form.get('id') ?? 0);
  try {
    if (action === 'delete') { await deleteSermon(env.DB, id); }
    else if (action === 'toggle') { await setSermonPublished(env.DB, id, String(form.get('published')) === 'true'); }
    else {
      const data = SermonInputSchema.parse(Object.fromEntries(form));
      if (action === 'update') await updateSermon(env.DB, id, data, auth.email);
      else await createSermon(env.DB, data, auth.email);
    }
  } catch {
    return new Response('Invalid submission', { status: 400 });
  }
  return new Response(null, { status: 303, headers: { Location: '/admin/sermons' } });
};
```
Replicate for events/ministries (own schema + mutations, redirect to their list) and settings (no schema/_action switch — just `setSettings(env.DB, Object.fromEntries(form))` minus any control fields, redirect `/admin/settings`). Commit `feat: gated admin mutation API routes`.

> Note: `Object.fromEntries(form)` includes `_action`/`id`; zod `.parse` ignores unknown keys by default, so that's fine. For settings, strip `_action` before `setSettings` if present.

---

## Task 7: Admin forms + list controls + settings + registrations pages

**Files:** Create the `new.astro`/`[id].astro` forms for sermons/events/ministries, `settings.astro`, `events/[id]/registrations.astro`; modify the three list pages to add New/Edit/Delete/Publish controls.

> **Checkbox caution:** `published`/`registration_enabled` use `z.coerce.boolean()`, which treats ANY non-empty string as true (`Boolean('false') === true`). So the checkbox must have NO explicit `value` of `"false"` — rely on a plain `<input type="checkbox" name="published" />` that is simply absent from the POST when unchecked (→ schema default `false`) and present (value `"on"`) when checked. For edit forms, set the `checked` attribute from the row.

- [ ] Each **new/edit form** page: Phase-4A guard; for `[id]`, load the row via `getXById` (redirect to list if missing); render a `<form method="POST" action="/api/admin/<entity>">` with a hidden `_action` (create/update) and (for edit) hidden `id`, and `<Field>`s for every column; a published checkbox; submit button. Reuse `Field.astro` (add `value`/`checked`/`textarea` support as needed — extend `Field` minimally).
- [ ] Each **list page**: add a "New" link to `/admin/<entity>/new`, and per row an Edit link to `/admin/<entity>/<id>`, plus small inline `<form>`s posting `_action=toggle` (publish/unpublish) and `_action=delete` (with an `onsubmit` confirm).
- [ ] **settings.astro**: guard; load `getAllSettings`; a form posting to `/api/admin/settings` with fields for address, contact_email, phone, service_times (textarea JSON), socials (textarea JSON), default_theme (select sacred/purple), turnstile_site_key.
- [ ] **events/[id]/registrations.astro**: guard; load the event + `listRegistrationsForEvent`; render a table (name/email/guests/when) and a "Download CSV" link (a sibling route or inline data URI). Link to it from the events list.
- [ ] **Verify in dev** (DEV_ADMIN_EMAIL set): create a sermon via the form → appears in `/admin/sermons` and on the public `/sermons`; toggle publish hides it publicly; edit changes it; delete removes it; edit a setting and see it reflected on the public site; view an event's registrations.
- [ ] **Commit** `feat: admin CRUD forms, settings editor, and registrations view`.

---

## Task 8: Full gate + review

- [ ] `npx vitest run` — prior 39 + slug (4) + sermons-crud (3) + events-crud (3) + ministries-crud (3) + settings-crud (1) + registrations-list (1) ≈ 54 passing.
- [ ] `npm run build` succeeds.
- [ ] Dev smoke: full create→publish→edit→delete loop for one entity; settings save; registrations view. Confirm unauthenticated `/api/admin/sermons` POST returns 403 (remove DEV_ADMIN_EMAIL, retry, restore).
- [ ] `git status --short` clean.

---

## Phase 4B Done — Definition of Done
- Staff can fully manage sermons, events, ministries (create/edit/delete/publish), edit settings, and view per-event registrations — all gated, audited (`updated_by`), and validated.
- `/api/admin/*` routes return 403 without an identity.
- `npx vitest run` and `npm run build` pass.

**Next:** Phase 4C — R2 image uploads (sermon thumbnails, event/ministry images) with signed/direct upload + serving via Image Resizing. Then Phase 5 (Paystack giving), Phase 6 (hardening: Access JWT verification, security headers, CI, robots/sitemap, real Turnstile + email provider keys).

---

## Open Questions (non-blocking)
- CSV export mechanism for registrations (inline data-URI link vs a dedicated gated route) — pick the simpler at build time.
- Whether deleting an event should cascade-delete its registrations (current: no FK cascade; consider blocking delete when registrations exist, or a soft archive) — decide during Task 6/7.
