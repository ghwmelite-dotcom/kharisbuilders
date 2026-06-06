# D4: Volunteer Signups (Opportunity Board) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development). Steps use checkbox (`- [ ]`) syntax.

**Goal:** A public `/serve` opportunity board (browse + filter volunteer roles by area/commitment, sign up per role), with admin CRUD for roles and a signups triage list.

**Architecture:** A direct structural twin of D3 (small-group finder). Two tables (`volunteer_roles` mirroring `groups`; `volunteer_signups` with a `role_name` snapshot + `phone`). An options registry (areas + commitments), the standard `handleX` capture pipeline, a filterable public page (client-side), and admin CRUD/triage. Pure logic unit-tested; pages verified by build.

**Tech Stack:** Astro 6 SSR, Cloudflare D1 + R2, Vitest + Miniflare, Turnstile. Spec: `docs/superpowers/specs/2026-06-06-D4-volunteer-signups-design.md`.

**Working dir:** `C:\dev\Projects\KharisBuilders Project\stitch_kharisbuilders_church_web_design`.

---

## File Structure

```
migrations/0024_volunteer_roles.sql            # CREATE (Task 1)
migrations/0025_volunteer_signups.sql          # CREATE (Task 1)
src/lib/community/volunteer-options.ts         # CREATE — areas + commitments registry (Task 2)
tests/community/volunteer-options.test.ts      # CREATE (Task 2)
src/lib/db/schemas.ts                          # MODIFY — VolunteerRole + VolunteerSignup schemas (Task 3)
src/lib/db/volunteer-roles.ts                  # CREATE — roles data access (Task 3)
tests/db/volunteer-roles.test.ts               # CREATE (Task 3)
src/lib/db/volunteer-signups.ts                # CREATE — signups data access (Task 4)
tests/db/volunteer-signups.test.ts             # CREATE (Task 4)
src/lib/community/volunteer-handler.ts         # CREATE — capture pipeline (Task 5)
tests/community/volunteer-handler.test.ts      # CREATE (Task 5)
src/pages/serve.astro                          # CREATE — the board (Task 6)
src/pages/api/forms/volunteer-signup.ts        # CREATE (Task 6)
src/components/Footer.astro                    # MODIFY — Serve footer link (Task 6)
src/pages/about.astro                          # MODIFY — Serve CTA band (Task 6)
src/components/admin/VolunteerRoleForm.astro   # CREATE (Task 7)
src/pages/admin/volunteer-roles.astro          # CREATE — list (Task 7)
src/pages/admin/volunteer-roles/new.astro      # CREATE (Task 7)
src/pages/admin/volunteer-roles/[id].astro     # CREATE (Task 7)
src/pages/api/admin/volunteer-roles.ts         # CREATE (Task 7)
src/pages/media/[...key].ts                    # MODIFY — add 'volunteer/' prefix (Task 7)
src/layouts/AdminLayout.astro                  # MODIFY — Serve Roles + Serve Signups nav (Task 7 + 8)
src/pages/admin/volunteer-signups.astro        # CREATE (Task 8)
src/pages/api/admin/volunteer-signups.ts       # CREATE (Task 8)
```

---

## Task 1: Migrations

**Files:** Create `migrations/0024_volunteer_roles.sql`, `migrations/0025_volunteer_signups.sql`.

- [ ] **Step 1: Branch**

Run: `git status --short && git rev-parse --abbrev-ref HEAD` → empty, `main`. Then `git checkout -b feat/D4-volunteer`.

- [ ] **Step 2: Create `migrations/0024_volunteer_roles.sql`**

```sql
-- Volunteer roles shown on the public /serve opportunity board.
CREATE TABLE IF NOT EXISTS volunteer_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  area TEXT NOT NULL DEFAULT 'general',
  commitment TEXT NOT NULL DEFAULT 'as_needed',
  schedule TEXT,
  requirements TEXT,
  leader TEXT,
  image_key TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);
```

- [ ] **Step 3: Create `migrations/0025_volunteer_signups.sql`**

```sql
-- Per-role "I want to serve" submissions, for staff follow-up.
CREATE TABLE IF NOT EXISTS volunteer_signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_id INTEGER,
  role_name TEXT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- [ ] **Step 4: Apply locally**

Run: `npx wrangler d1 migrations apply church-template --local`
Expected: applies `0024` + `0025`. No error.

- [ ] **Step 5: Commit**

```bash
git add migrations/0024_volunteer_roles.sql migrations/0025_volunteer_signups.sql
git commit -m "feat(d1): volunteer_roles + volunteer_signups tables (migrations 0024-0025)"
```

---

## Task 2: Options registry

**Files:** Create `src/lib/community/volunteer-options.ts`, `tests/community/volunteer-options.test.ts`.

- [ ] **Step 1: Write the failing test** `tests/community/volunteer-options.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { AREAS, COMMITMENTS, AREA_KEYS, COMMITMENT_KEYS, optionLabel } from '../../src/lib/community/volunteer-options';

describe('volunteer-options', () => {
  it('has unique keys per list', () => {
    for (const list of [AREAS, COMMITMENTS]) {
      const keys = list.map((o) => o.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
    expect(AREA_KEYS).toContain('kids');
    expect(COMMITMENT_KEYS).toContain('weekly');
  });
  it('optionLabel returns the label, or the key when unknown', () => {
    expect(optionLabel(COMMITMENTS, 'weekly')).toBe('Weekly');
    expect(optionLabel(AREAS, 'zzz')).toBe('zzz');
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/community/volunteer-options.test.ts`
Expected: FAIL (cannot import).

- [ ] **Step 3: Create `src/lib/community/volunteer-options.ts`**

```ts
export interface Option {
  key: string;
  label: string;
}

export const AREAS: Option[] = [
  { key: 'general', label: 'General / wherever needed' },
  { key: 'kids', label: 'Kids ministry' },
  { key: 'worship', label: 'Worship & music' },
  { key: 'hospitality', label: 'Hospitality & welcome' },
  { key: 'media', label: 'Media & tech' },
  { key: 'parking', label: 'Parking & safety' },
  { key: 'outreach', label: 'Outreach & missions' },
  { key: 'facilities', label: 'Facilities & setup' },
  { key: 'prayer', label: 'Prayer team' },
  { key: 'admin', label: 'Admin & office' },
];

export const COMMITMENTS: Option[] = [
  { key: 'one_time', label: 'One-time' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'as_needed', label: 'As needed / on-call' },
];

export const AREA_KEYS: string[] = AREAS.map((o) => o.key);
export const COMMITMENT_KEYS: string[] = COMMITMENTS.map((o) => o.key);

export function optionLabel(list: Option[], key: string): string {
  return list.find((o) => o.key === key)?.label ?? key;
}
```

- [ ] **Step 4: Run → pass**

Run: `npx vitest run tests/community/volunteer-options.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/community/volunteer-options.ts tests/community/volunteer-options.test.ts
git commit -m "feat: volunteer options registry (areas + commitments)"
```

---

## Task 3: Schemas + roles data access

**Files:** Modify `src/lib/db/schemas.ts`; Create `src/lib/db/volunteer-roles.ts`, `tests/db/volunteer-roles.test.ts`.

- [ ] **Step 1: Append the schemas to `src/lib/db/schemas.ts`** (after the `GroupInterestInputSchema` block / at end of file)

```ts

export const VolunteerRoleInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  area: z.string().trim().max(30).default('general'),
  commitment: z.string().trim().max(20).default('as_needed'),
  schedule: z.string().trim().max(120).optional().or(z.literal('')),
  requirements: z.string().trim().max(500).optional().or(z.literal('')),
  leader: z.string().trim().max(120).optional().or(z.literal('')),
  sort_order: z.coerce.number().int().min(0).default(0),
  published: z.coerce.boolean().default(false),
});
export type VolunteerRoleInput = z.infer<typeof VolunteerRoleInputSchema>;

export const VolunteerSignupInputSchema = z.object({
  role_id: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  message: z.string().trim().max(2000).optional().or(z.literal('')),
});
export type VolunteerSignupInput = z.infer<typeof VolunteerSignupInputSchema>;
```

- [ ] **Step 2: Write the failing test** `tests/db/volunteer-roles.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import {
  createRole,
  listPublishedRoles,
  listAllRoles,
  getRoleById,
  setRolePublished,
  deleteRole,
} from '../../src/lib/db/volunteer-roles';

const r = (over: Record<string, unknown> = {}) => ({
  name: 'Sunday Greeter',
  description: 'Welcome people at the door.',
  area: 'hospitality',
  commitment: 'weekly',
  schedule: 'Sundays, 8-10am',
  requirements: '',
  leader: 'Ada',
  sort_order: 0,
  published: false,
  ...over,
});

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
  await createRole(ctx.db, r({ name: 'A', sort_order: 2, published: true }), 'admin@x');
  await createRole(ctx.db, r({ name: 'B', sort_order: 1, published: true }), 'admin@x');
  await createRole(ctx.db, r({ name: 'Draft', published: false }), 'admin@x');
});
afterAll(async () => {
  await ctx.dispose();
});

describe('volunteer-roles', () => {
  it('listPublishedRoles returns only published, ordered by sort_order', async () => {
    const rows = await listPublishedRoles(ctx.db);
    expect(rows.map((x) => x.name)).toEqual(['B', 'A']);
  });
  it('listAllRoles includes drafts; getRoleById works', async () => {
    expect((await listAllRoles(ctx.db)).length).toBe(3);
    expect((await getRoleById(ctx.db, 1))?.name).toBe('A');
  });
  it('publish toggle + delete', async () => {
    await setRolePublished(ctx.db, 3, true);
    expect((await listPublishedRoles(ctx.db)).length).toBe(3);
    await deleteRole(ctx.db, 3);
    expect((await listAllRoles(ctx.db)).some((x) => x.id === 3)).toBe(false);
  });
});
```

- [ ] **Step 3: Run → fail**

Run: `npx vitest run tests/db/volunteer-roles.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 4: Create `src/lib/db/volunteer-roles.ts`**

```ts
import type { VolunteerRoleInput } from './schemas';

export interface VolunteerRole {
  id: number;
  name: string;
  description: string | null;
  area: string;
  commitment: string;
  schedule: string | null;
  requirements: string | null;
  leader: string | null;
  image_key: string | null;
  sort_order: number;
}
export interface VolunteerRoleFull extends VolunteerRole {
  published: number;
  updated_by: string | null;
}

const COLS = 'id, name, description, area, commitment, schedule, requirements, leader, image_key, sort_order';

export async function listPublishedRoles(db: D1Database): Promise<VolunteerRole[]> {
  const { results } = await db
    .prepare(`SELECT ${COLS} FROM volunteer_roles WHERE published = 1 ORDER BY sort_order ASC, name ASC`)
    .all<VolunteerRole>();
  return results;
}
export async function listAllRoles(db: D1Database): Promise<VolunteerRoleFull[]> {
  const { results } = await db
    .prepare(`SELECT ${COLS}, published, updated_by FROM volunteer_roles ORDER BY sort_order ASC, name ASC`)
    .all<VolunteerRoleFull>();
  return results;
}
export async function getRoleById(db: D1Database, id: number): Promise<VolunteerRoleFull | null> {
  const row = await db
    .prepare(`SELECT ${COLS}, published, updated_by FROM volunteer_roles WHERE id = ?`)
    .bind(id)
    .first<VolunteerRoleFull>();
  return row ?? null;
}
export async function createRole(db: D1Database, input: VolunteerRoleInput, email: string): Promise<number> {
  const r = await db
    .prepare(
      `INSERT INTO volunteer_roles (name, description, area, commitment, schedule, requirements, leader, sort_order, published, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.name,
      input.description || null,
      input.area,
      input.commitment,
      input.schedule || null,
      input.requirements || null,
      input.leader || null,
      input.sort_order,
      input.published ? 1 : 0,
      email,
    )
    .run();
  return Number(r.meta.last_row_id);
}
export async function updateRole(db: D1Database, id: number, input: VolunteerRoleInput, email: string): Promise<void> {
  await db
    .prepare(
      `UPDATE volunteer_roles SET name=?, description=?, area=?, commitment=?, schedule=?, requirements=?, leader=?,
        sort_order=?, published=?, updated_by=?, updated_at=datetime('now') WHERE id=?`,
    )
    .bind(
      input.name,
      input.description || null,
      input.area,
      input.commitment,
      input.schedule || null,
      input.requirements || null,
      input.leader || null,
      input.sort_order,
      input.published ? 1 : 0,
      email,
      id,
    )
    .run();
}
export async function setRolePublished(db: D1Database, id: number, published: boolean): Promise<void> {
  await db.prepare("UPDATE volunteer_roles SET published=?, updated_at=datetime('now') WHERE id=?").bind(published ? 1 : 0, id).run();
}
export async function deleteRole(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM volunteer_roles WHERE id = ?').bind(id).run();
}
export async function setRoleImage(db: D1Database, id: number, key: string): Promise<void> {
  await db.prepare("UPDATE volunteer_roles SET image_key=?, updated_at=datetime('now') WHERE id=?").bind(key, id).run();
}
```

- [ ] **Step 5: Run → pass**

Run: `npx vitest run tests/db/volunteer-roles.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/schemas.ts src/lib/db/volunteer-roles.ts tests/db/volunteer-roles.test.ts
git commit -m "feat(d1): volunteer-roles data access + Role/Signup schemas"
```

---

## Task 4: Signups data access

**Files:** Create `src/lib/db/volunteer-signups.ts`, `tests/db/volunteer-signups.test.ts`.

- [ ] **Step 1: Write the failing test** `tests/db/volunteer-signups.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import {
  createVolunteerSignup,
  listVolunteerSignups,
  setVolunteerSignupStatus,
  deleteVolunteerSignup,
} from '../../src/lib/db/volunteer-signups';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
  await createVolunteerSignup(ctx.db, { role_id: 5, role_name: 'Sunday Greeter', name: 'Ada', email: 'a@x.com', phone: '0800', message: 'Keen' });
  await createVolunteerSignup(ctx.db, { role_id: 6, role_name: 'Parking', name: 'Ben', email: 'b@x.com', phone: '', message: '' });
});
afterAll(async () => {
  await ctx.dispose();
});

describe('volunteer-signups', () => {
  it('stores role_name snapshot + phone, newest first', async () => {
    const rows = await listVolunteerSignups(ctx.db);
    expect(rows.map((x) => x.name)).toEqual(['Ben', 'Ada']);
    expect(rows[1].role_name).toBe('Sunday Greeter');
    expect(rows[1].phone).toBe('0800');
    expect(rows[1].status).toBe('new');
  });
  it('status + delete', async () => {
    await setVolunteerSignupStatus(ctx.db, 1, 'done');
    expect((await listVolunteerSignups(ctx.db)).find((x) => x.id === 1)?.status).toBe('done');
    await deleteVolunteerSignup(ctx.db, 2);
    expect((await listVolunteerSignups(ctx.db)).some((x) => x.id === 2)).toBe(false);
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/db/volunteer-signups.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `src/lib/db/volunteer-signups.ts`**

```ts
export type VolunteerSignupStatus = 'new' | 'contacted' | 'done';

export interface VolunteerSignup {
  id: number;
  role_id: number | null;
  role_name: string | null;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  status: string;
  created_at: string;
}

export async function createVolunteerSignup(
  db: D1Database,
  input: { role_id: number; role_name: string; name: string; email: string; phone: string; message: string },
): Promise<void> {
  await db
    .prepare('INSERT INTO volunteer_signups (role_id, role_name, name, email, phone, message) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(input.role_id, input.role_name, input.name, input.email, input.phone || null, input.message || null)
    .run();
}

export async function listVolunteerSignups(db: D1Database, limit = 200): Promise<VolunteerSignup[]> {
  const { results } = await db
    .prepare(
      'SELECT id, role_id, role_name, name, email, phone, message, status, created_at FROM volunteer_signups ORDER BY id DESC LIMIT ?',
    )
    .bind(limit)
    .all<VolunteerSignup>();
  return results;
}

export async function setVolunteerSignupStatus(db: D1Database, id: number, status: VolunteerSignupStatus): Promise<void> {
  await db.prepare('UPDATE volunteer_signups SET status = ? WHERE id = ?').bind(status, id).run();
}

export async function deleteVolunteerSignup(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM volunteer_signups WHERE id = ?').bind(id).run();
}
```

- [ ] **Step 4: Run → pass**

Run: `npx vitest run tests/db/volunteer-signups.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/volunteer-signups.ts tests/db/volunteer-signups.test.ts
git commit -m "feat(d1): volunteer-signups data access (snapshot role_name + phone)"
```

---

## Task 5: Signup handler

**Files:** Create `src/lib/community/volunteer-handler.ts`, `tests/community/volunteer-handler.test.ts`.

- [ ] **Step 1: Write the failing test** `tests/community/volunteer-handler.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { handleVolunteerSignup } from '../../src/lib/community/volunteer-handler';
import { createRole } from '../../src/lib/db/volunteer-roles';
import { listVolunteerSignups } from '../../src/lib/db/volunteer-signups';

let ctx: TestDb;
let pubId: number;
let draftId: number;
beforeAll(async () => {
  ctx = await createTestDb();
  pubId = await createRole(
    ctx.db,
    { name: 'Open Role', description: '', area: 'kids', commitment: 'weekly', schedule: '', requirements: '', leader: '', sort_order: 0, published: true },
    'a@x',
  );
  draftId = await createRole(
    ctx.db,
    { name: 'Hidden', description: '', area: 'kids', commitment: 'weekly', schedule: '', requirements: '', leader: '', sort_order: 0, published: false },
    'a@x',
  );
});
afterAll(async () => {
  await ctx.dispose();
});

function form(f: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(f)) fd.append(k, v);
  return fd;
}
const okFetch = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
const env = () => ({ DB: ctx.db, TURNSTILE_SECRET_KEY: 'x' }) as unknown as Parameters<typeof handleVolunteerSignup>[0];

describe('handleVolunteerSignup', () => {
  it('captures a signup for a published role with the snapshot name', async () => {
    vi.stubGlobal('fetch', okFetch);
    const r = await handleVolunteerSignup(
      env(),
      form({ role_id: String(pubId), name: 'Ada', email: 'a@x.com', phone: '0800', 'cf-turnstile-response': 't' }),
      '1.1.1.1',
    );
    expect(r).toEqual({ status: 303, redirect: '/serve?signup=ok' });
    const rows = await listVolunteerSignups(ctx.db);
    expect(rows[0].role_name).toBe('Open Role');
    expect(rows[0].phone).toBe('0800');
    vi.unstubAllGlobals();
  });
  it('rejects a missing or unpublished role without storing', async () => {
    const before = (await listVolunteerSignups(ctx.db)).length;
    const r1 = await handleVolunteerSignup(env(), form({ role_id: '99999', name: 'X', email: 'x@x.com', 'cf-turnstile-response': 't' }), undefined);
    const r2 = await handleVolunteerSignup(env(), form({ role_id: String(draftId), name: 'X', email: 'x@x.com', 'cf-turnstile-response': 't' }), undefined);
    expect(r1.redirect).toBe('/serve?signup=err');
    expect(r2.redirect).toBe('/serve?signup=err');
    expect((await listVolunteerSignups(ctx.db)).length).toBe(before);
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/community/volunteer-handler.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `src/lib/community/volunteer-handler.ts`**

```ts
import { VolunteerSignupInputSchema } from '../db/schemas';
import { getRoleById } from '../db/volunteer-roles';
import { createVolunteerSignup } from '../db/volunteer-signups';
import { verifyTurnstile } from '../turnstile';
import { notifyStaff, type NotifyEnv } from '../notify';

export type VolunteerEnv = NotifyEnv & { DB: D1Database; TURNSTILE_SECRET_KEY?: string };
export interface FormResult {
  status: number;
  redirect?: string;
}

/** Pure volunteer-signup pipeline: validate -> role exists+published -> Turnstile -> insert -> best-effort notify. */
export async function handleVolunteerSignup(env: VolunteerEnv, form: FormData, ip?: string): Promise<FormResult> {
  const parsed = VolunteerSignupInputSchema.safeParse({
    role_id: form.get('role_id'),
    name: form.get('name'),
    email: form.get('email'),
    phone: form.get('phone') ?? '',
    message: form.get('message') ?? '',
  });
  if (!parsed.success) return { status: 303, redirect: '/serve?signup=err' };

  const role = await getRoleById(env.DB, parsed.data.role_id);
  if (!role || !role.published) return { status: 303, redirect: '/serve?signup=err' };

  const ok = await verifyTurnstile(env.TURNSTILE_SECRET_KEY ?? '', String(form.get('cf-turnstile-response') ?? ''), ip);
  if (!ok) return { status: 303, redirect: '/serve?signup=err' };

  await createVolunteerSignup(env.DB, {
    role_id: role.id,
    role_name: role.name,
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone ?? '',
    message: parsed.data.message ?? '',
  });
  await notifyStaff(env, 'New volunteer signup', `${parsed.data.name} (${parsed.data.email}) wants to serve in ${role.name}`);
  return { status: 303, redirect: '/serve?signup=ok' };
}
```

- [ ] **Step 4: Run → pass**

Run: `npx vitest run tests/community/volunteer-handler.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/community/volunteer-handler.ts tests/community/volunteer-handler.test.ts
git commit -m "feat: handleVolunteerSignup (validate published role, snapshot name)"
```

---

## Task 6: Public board + endpoint + discovery

**Files:** Create `src/pages/serve.astro`, `src/pages/api/forms/volunteer-signup.ts`; Modify `src/components/Footer.astro`, `src/pages/about.astro`.

- [ ] **Step 1: Create `src/pages/api/forms/volunteer-signup.ts`**

```ts
import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { handleVolunteerSignup } from '../../../lib/community/volunteer-handler';

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const ip = request.headers.get('cf-connecting-ip') ?? undefined;
  const r = await handleVolunteerSignup(env, form, ip);
  return new Response(null, { status: r.status, headers: { Location: r.redirect ?? '/serve' } });
};
```

- [ ] **Step 2: Create `src/pages/serve.astro`**

```astro
---
import PublicLayout from '../layouts/PublicLayout.astro';
import PageHero from '../components/PageHero.astro';
import { env } from '../lib/runtime';
import { getAllSettings } from '../lib/db/settings';
import { getAllContent } from '../lib/db/content';
import { makeImage } from '../lib/content/content';
import { mediaUrl } from '../lib/media';
import { PLACEHOLDER } from '../lib/images';
import { listPublishedRoles, type VolunteerRole } from '../lib/db/volunteer-roles';
import { AREAS, COMMITMENTS, optionLabel } from '../lib/community/volunteer-options';
import { SITE } from '../lib/seo';
import { feature } from '../config/church';

if (!feature('community')) return Astro.redirect('/');

let siteKey = '1x00000000000000000000AA';
let cimg = makeImage({});
let roles: VolunteerRole[] = [];
try {
  const settings = await getAllSettings(env.DB);
  siteKey = settings.turnstile_site_key ?? siteKey;
  cimg = makeImage(await getAllContent(env.DB).catch(() => ({})));
  roles = await listPublishedRoles(env.DB);
} catch {
  // DB unavailable in some envs — render an empty board
}
const status = Astro.url.searchParams.get('signup');
---
<PublicLayout title={`Serve | ${SITE.name}`} description={`Find a place to serve and volunteer at ${SITE.name}.`}>
  <PageHero image={cimg('pages.ministries_hero')} height="h-[300px] md:h-[380px]">
    <span class="font-label-sm uppercase tracking-[0.3em] text-heritage-gold mb-4 block hero-shadow">Get Involved</span>
    <h1 class="font-display text-display-mobile md:text-display-lg text-white hero-shadow">Serve</h1>
    <p class="font-body text-body-lg text-white/85 max-w-2xl mx-auto mt-4 hero-shadow">Every gift matters — find a place to serve.</p>
  </PageHero>

  <section class="py-16 md:py-24 px-margin-mobile md:px-margin-desktop max-w-[var(--container-max)] mx-auto">
    {status === 'ok' && (
      <div class="max-w-2xl mx-auto mb-10 border-t-2 border-heritage-gold bg-surface-container-lowest p-5 text-center font-body text-body-md text-primary">
        Thank you — a team leader will be in touch soon.
      </div>
    )}
    {status === 'err' && (
      <div class="max-w-2xl mx-auto mb-10 border-t-2 border-accent-deep bg-surface-container-lowest p-5 text-center font-body text-body-md text-primary">
        Sorry — we couldn't record that. Please try again.
      </div>
    )}

    {roles.length === 0 ? (
      <p class="text-center font-body text-body-md text-stone-gray">No volunteer roles listed yet — check back soon.</p>
    ) : (
      <>
        <div class="flex flex-wrap gap-4 justify-center mb-10">
          <select id="f-area" class="border border-champagne bg-surface px-4 py-2 font-body text-body-md text-primary"><option value="">Any area</option>{AREAS.map((a) => (<option value={a.key}>{a.label}</option>))}</select>
          <select id="f-commit" class="border border-champagne bg-surface px-4 py-2 font-body text-body-md text-primary"><option value="">Any commitment</option>{COMMITMENTS.map((c) => (<option value={c.key}>{c.label}</option>))}</select>
        </div>
        <p id="r-empty" class="hidden text-center font-body text-body-md text-stone-gray mb-8">No roles match those filters.</p>

        <div id="r-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {roles.map((role) => (
            <article class="role-card bg-surface-container-lowest border border-champagne flex flex-col overflow-hidden" data-area={role.area} data-commit={role.commitment}>
              <div class="aspect-[16/10] overflow-hidden bg-surface-dim">
                <img src={mediaUrl(role.image_key) ?? PLACEHOLDER.card} alt="" class="w-full h-full object-cover" />
              </div>
              <div class="p-6 flex flex-col flex-1">
                <h3 class="font-display text-headline-md text-primary mb-1">{role.name}</h3>
                {role.schedule && <p class="font-label-sm uppercase tracking-[0.14em] text-stone-gray mb-3">{role.schedule}</p>}
                <div class="flex flex-wrap gap-2 mb-3">
                  <span class="text-xs px-2 py-0.5 rounded-full border border-champagne text-primary">{optionLabel(AREAS, role.area)}</span>
                  <span class="text-xs px-2 py-0.5 rounded-full border border-champagne text-primary">{optionLabel(COMMITMENTS, role.commitment)}</span>
                </div>
                {role.description && <p class="font-body text-body-md text-stone-gray mb-4 flex-1 whitespace-pre-line">{role.description}</p>}
                {role.requirements && <p class="font-body text-body-sm text-accent-deep mb-3">Note: {role.requirements}</p>}
                {role.leader && <p class="font-body text-body-md text-stone-gray mb-4">Team lead: {role.leader}</p>}
                <button type="button" class="serve-btn mt-auto self-start font-label-sm uppercase tracking-[0.14em] text-heritage-gold hover:text-primary transition-colors" data-id={String(role.id)} data-name={role.name}>I want to serve &rarr;</button>
              </div>
            </article>
          ))}
        </div>

        <div id="signup-form" class="max-w-2xl mx-auto mt-16 bg-surface-container-lowest border-t-2 border-heritage-gold elev-2 p-8 md:p-10">
          <h2 class="font-display text-headline-md text-primary mb-1">I want to serve</h2>
          <p class="font-body text-body-md text-stone-gray mb-6">Role: <span id="signup-role" class="text-primary font-medium">choose a role above</span></p>
          <form method="POST" action="/api/forms/volunteer-signup" class="space-y-5">
            <input type="hidden" name="role_id" id="signup-role-id" value="" />
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input name="name" required maxlength="120" placeholder="Your name" class="border border-champagne bg-surface px-4 py-3 font-body text-body-md text-primary" />
              <input name="email" type="email" required maxlength="200" placeholder="Email" class="border border-champagne bg-surface px-4 py-3 font-body text-body-md text-primary" />
            </div>
            <input name="phone" maxlength="40" placeholder="Phone (optional)" class="w-full border border-champagne bg-surface px-4 py-3 font-body text-body-md text-primary" />
            <textarea name="message" rows="3" maxlength="2000" placeholder="Anything you'd like the team to know? (optional)" class="w-full border border-champagne bg-surface px-4 py-3 font-body text-body-md text-primary"></textarea>
            <div class="cf-turnstile" data-sitekey={siteKey}></div>
            <button type="submit" class="bg-heritage-gold text-primary font-label-md uppercase tracking-widest px-8 py-3 hover:bg-secondary transition-all">Send</button>
          </form>
        </div>
      </>
    )}
  </section>

  <script is:inline src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
  <script is:inline>
    const area = document.getElementById('f-area');
    const commit = document.getElementById('f-commit');
    const cards = Array.from(document.querySelectorAll('.role-card'));
    const empty = document.getElementById('r-empty');
    function applyFilter() {
      let shown = 0;
      cards.forEach((c) => {
        const ok = (!area.value || c.dataset.area === area.value) && (!commit.value || c.dataset.commit === commit.value);
        c.style.display = ok ? '' : 'none';
        if (ok) shown++;
      });
      if (empty) empty.classList.toggle('hidden', shown !== 0);
    }
    [area, commit].forEach((s) => s && s.addEventListener('change', applyFilter));

    const roleIdEl = document.getElementById('signup-role-id');
    const roleLabel = document.getElementById('signup-role');
    document.querySelectorAll('.serve-btn').forEach((b) => b.addEventListener('click', () => {
      roleIdEl.value = b.getAttribute('data-id');
      roleLabel.textContent = b.getAttribute('data-name');
      document.getElementById('signup-form').scrollIntoView({ behavior: 'smooth' });
    }));
  </script>
</PublicLayout>
```

- [ ] **Step 3: Footer link in `src/components/Footer.astro`** — change the community spread (currently `...(feature('community') ? [{ label: 'Groups', href: '/groups' }, { label: 'Next Steps', href: '/connect' }] : []),`) to add Serve:

```ts
  ...(feature('community') ? [{ label: 'Groups', href: '/groups' }, { label: 'Serve', href: '/serve' }, { label: 'Next Steps', href: '/connect' }] : []),
```

- [ ] **Step 4a: Add the `feature` import to `src/pages/about.astro`.** It does NOT currently import it. Add to the frontmatter import block (the imports end before the `---` close at the top; `SITE` is already imported from `../lib/seo`):

```ts
import { feature } from '../config/church';
```

- [ ] **Step 4b: Insert the Serve CTA band in `src/pages/about.astro`** immediately after the `</PageHero>` closing tag (line ~29):

```astro
  {
    feature('community') && (
      <div class="bg-primary-container text-on-primary py-10 px-margin-mobile md:px-margin-desktop">
        <div class="max-w-[var(--container-max)] mx-auto flex flex-col sm:flex-row items-center justify-between gap-5 text-center sm:text-left">
          <p class="font-display text-headline-md text-white">Find your place — serve with us.</p>
          <a href="/serve" class="flex-none bg-heritage-gold text-primary font-label-md uppercase tracking-widest px-8 py-3 hover:bg-secondary transition-colors">Explore serving</a>
        </div>
      </div>
    )
  }
```

- [ ] **Step 5: Build**

Run: `npx astro build`
Expected: `Complete!`.

- [ ] **Step 6: Commit**

```bash
git add src/pages/serve.astro src/pages/api/forms/volunteer-signup.ts src/components/Footer.astro src/pages/about.astro
git commit -m "feat: public /serve board (filter + signup) + footer + about CTA"
```

---

## Task 7: Admin volunteer-roles CRUD

**Files:** Create `src/components/admin/VolunteerRoleForm.astro`, `src/pages/admin/volunteer-roles.astro`, `src/pages/admin/volunteer-roles/new.astro`, `src/pages/admin/volunteer-roles/[id].astro`, `src/pages/api/admin/volunteer-roles.ts`; Modify `src/pages/media/[...key].ts`, `src/layouts/AdminLayout.astro`.

- [ ] **Step 1: Add `'volunteer/'` to `PUBLIC_PREFIXES` in `src/pages/media/[...key].ts`** (currently ends `..., 'page/', 'groups/'];`)

```ts
const PUBLIC_PREFIXES = ['sermons/', 'events/', 'ministries/', 'leaders/', 'journey/', 'home-cards/', 'page/', 'groups/', 'volunteer/'];
```

- [ ] **Step 2: Create `src/components/admin/VolunteerRoleForm.astro`**

```astro
---
import Field from '../Field.astro';
import Button from '../Button.astro';
import { AREAS, COMMITMENTS } from '../../lib/community/volunteer-options';
import type { VolunteerRoleFull } from '../../lib/db/volunteer-roles';
interface Props {
  role?: VolunteerRoleFull | null;
}
const { role } = Astro.props;
const isEdit = !!role;
const sel = (a: string | null | undefined, b: string) => (a ?? '') === b;
---
<form method="POST" action="/api/admin/volunteer-roles" enctype="multipart/form-data" class="flex flex-col gap-6 max-w-xl">
  <input type="hidden" name="_action" value={isEdit ? 'update' : 'create'} />
  {isEdit && <input type="hidden" name="id" value={String(role!.id)} />}
  <Field label="Name" name="name" required value={role?.name ?? ''} />
  <Field label="Team lead" name="leader" value={role?.leader ?? ''} />
  <div class="grid grid-cols-2 gap-4">
    <label class="flex flex-col gap-1 text-xs uppercase tracking-wider text-on-surface-variant">Area
      <select name="area" class="border border-champagne bg-surface px-3 py-2 text-sm text-primary normal-case tracking-normal">{AREAS.map((a) => (<option value={a.key} selected={sel(role?.area, a.key)}>{a.label}</option>))}</select>
    </label>
    <label class="flex flex-col gap-1 text-xs uppercase tracking-wider text-on-surface-variant">Commitment
      <select name="commitment" class="border border-champagne bg-surface px-3 py-2 text-sm text-primary normal-case tracking-normal">{COMMITMENTS.map((c) => (<option value={c.key} selected={sel(role?.commitment, c.key)}>{c.label}</option>))}</select>
    </label>
  </div>
  <Field label="Schedule (free text, e.g. Sundays 8-10am)" name="schedule" value={role?.schedule ?? ''} />
  <Field label="Requirements (optional, e.g. Background check required)" name="requirements" value={role?.requirements ?? ''} />
  <Field label="Sort order" name="sort_order" type="number" min={0} value={role?.sort_order != null ? String(role.sort_order) : '0'} />
  <Field label="Description" name="description" textarea value={role?.description ?? ''} />
  <div class="flex flex-col gap-1">
    <label for="f-image" class="text-xs uppercase tracking-wider text-on-surface-variant">Role image (optional, max 6 MB)</label>
    <input id="f-image" name="image" type="file" accept="image/*" class="text-sm text-on-surface-variant" />
    {role?.image_key && <p class="text-xs text-on-surface-variant">Current: {role.image_key}</p>}
  </div>
  <Field label="Published" name="published" type="checkbox" checked={!!role?.published} />
  <Button type="submit" variant="primary">{isEdit ? 'Save' : 'Create'}</Button>
</form>
```

- [ ] **Step 3: Create `src/pages/api/admin/volunteer-roles.ts`**

```ts
import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { requireAdmin } from '../../../lib/admin-auth';
import { VolunteerRoleInputSchema } from '../../../lib/db/schemas';
import { createRole, updateRole, deleteRole, setRolePublished, setRoleImage } from '../../../lib/db/volunteer-roles';
import { uploadImage } from '../../../lib/media';

export const POST: APIRoute = async ({ request }) => {
  const auth = requireAdmin(request, env, import.meta.env.DEV);
  if ('response' in auth) return auth.response;
  const form = await request.formData();
  const action = String(form.get('_action') ?? '');
  const id = Number(form.get('id') ?? 0);
  try {
    if (action === 'delete') {
      await deleteRole(env.DB, id);
    } else if (action === 'toggle') {
      await setRolePublished(env.DB, id, String(form.get('published')) === 'true');
    } else {
      const data = VolunteerRoleInputSchema.parse(Object.fromEntries(form));
      const targetId = action === 'update' ? id : await createRole(env.DB, data, auth.email);
      if (action === 'update') await updateRole(env.DB, id, data, auth.email);
      const image = form.get('image');
      if (image instanceof File && image.size > 0) {
        const key = await uploadImage(env.MEDIA, image, 'volunteer');
        await setRoleImage(env.DB, targetId, key);
      }
    }
  } catch {
    return new Response('Invalid submission', { status: 400 });
  }
  return new Response(null, { status: 303, headers: { Location: '/admin/volunteer-roles' } });
};
```

- [ ] **Step 4: Create `src/pages/admin/volunteer-roles.astro`**

```astro
---
import AdminLayout from '../../layouts/AdminLayout.astro';
import { env } from '../../lib/runtime';
import { getAdminEmail } from '../../lib/admin-auth';
import { listAllRoles } from '../../lib/db/volunteer-roles';
import { feature } from '../../config/church';

if (!feature('community')) return Astro.redirect('/');
const email = getAdminEmail(Astro.request, env, import.meta.env.DEV);
if (!email) return Astro.redirect('/admin/denied');
const roles = await listAllRoles(env.DB).catch(() => []);
---
<AdminLayout title="Serve Roles" email={email} active="volunteer-roles">
  <a href="/admin/volunteer-roles/new" class="inline-block mb-6 bg-primary text-on-primary px-5 py-2 text-sm uppercase tracking-wider">+ New role</a>
  <table class="w-full text-sm">
    <thead>
      <tr class="text-left text-on-surface-variant border-b border-champagne">
        <th class="py-2">Name</th><th>Area</th><th>Order</th><th>Status</th><th class="text-right">Actions</th>
      </tr>
    </thead>
    <tbody>
      {
        roles.map((m) => (
          <tr class="border-b border-champagne/50">
            <td class="py-3">
              <a href={`/admin/volunteer-roles/${m.id}`} class="text-primary hover:text-accent">{m.name}</a>
            </td>
            <td>{m.area}</td>
            <td>{m.sort_order}</td>
            <td>{m.published ? 'Published' : 'Draft'}</td>
            <td class="text-right whitespace-nowrap">
              <form method="POST" action="/api/admin/volunteer-roles" class="inline">
                <input type="hidden" name="_action" value="toggle" />
                <input type="hidden" name="id" value={String(m.id)} />
                <input type="hidden" name="published" value={m.published ? 'false' : 'true'} />
                <button class="text-accent text-xs uppercase tracking-wider">{m.published ? 'Unpublish' : 'Publish'}</button>
              </form>
              <form method="POST" action="/api/admin/volunteer-roles" class="inline ml-3" onsubmit="return confirm('Delete this role?')">
                <input type="hidden" name="_action" value="delete" />
                <input type="hidden" name="id" value={String(m.id)} />
                <button class="text-accent-deep text-xs uppercase tracking-wider">Delete</button>
              </form>
            </td>
          </tr>
        ))
      }
    </tbody>
  </table>
  {roles.length === 0 && <p class="text-on-surface-variant mt-4">No roles yet.</p>}
</AdminLayout>
```

- [ ] **Step 5: Create `src/pages/admin/volunteer-roles/new.astro`**

```astro
---
import AdminLayout from '../../../layouts/AdminLayout.astro';
import VolunteerRoleForm from '../../../components/admin/VolunteerRoleForm.astro';
import { env } from '../../../lib/runtime';
import { getAdminEmail } from '../../../lib/admin-auth';
import { feature } from '../../../config/church';

if (!feature('community')) return Astro.redirect('/');
const email = getAdminEmail(Astro.request, env, import.meta.env.DEV);
if (!email) return Astro.redirect('/admin/denied');
---
<AdminLayout title="New Role" email={email} active="volunteer-roles">
  <VolunteerRoleForm />
  <a href="/admin/volunteer-roles" class="inline-block mt-8 text-accent text-sm uppercase tracking-widest">← Back</a>
</AdminLayout>
```

- [ ] **Step 6: Create `src/pages/admin/volunteer-roles/[id].astro`**

```astro
---
import AdminLayout from '../../../layouts/AdminLayout.astro';
import VolunteerRoleForm from '../../../components/admin/VolunteerRoleForm.astro';
import { env } from '../../../lib/runtime';
import { getAdminEmail } from '../../../lib/admin-auth';
import { getRoleById } from '../../../lib/db/volunteer-roles';
import { feature } from '../../../config/church';

if (!feature('community')) return Astro.redirect('/');
const email = getAdminEmail(Astro.request, env, import.meta.env.DEV);
if (!email) return Astro.redirect('/admin/denied');
const role = await getRoleById(env.DB, Number(Astro.params.id)).catch(() => null);
if (!role) return Astro.redirect('/admin/volunteer-roles');
---
<AdminLayout title="Edit Role" email={email} active="volunteer-roles">
  <VolunteerRoleForm role={role} />
  <a href="/admin/volunteer-roles" class="inline-block mt-8 text-accent text-sm uppercase tracking-widest">← Back</a>
</AdminLayout>
```

- [ ] **Step 7: Add the Serve Roles + Serve Signups admin nav in `src/layouts/AdminLayout.astro`** — after the Groups + Group Signups entries (which follow Connect):

```ts
  { label: 'Serve Roles', href: '/admin/volunteer-roles', key: 'volunteer-roles', gate: 'community' },
  { label: 'Serve Signups', href: '/admin/volunteer-signups', key: 'volunteer-signups', gate: 'community' },
```

- [ ] **Step 8: Build + commit**

Run: `npx astro build`
Expected: `Complete!`.

```bash
git add src/components/admin/VolunteerRoleForm.astro src/pages/admin/volunteer-roles.astro src/pages/admin/volunteer-roles/new.astro "src/pages/admin/volunteer-roles/[id].astro" src/pages/api/admin/volunteer-roles.ts "src/pages/media/[...key].ts" src/layouts/AdminLayout.astro
git commit -m "feat: admin volunteer-roles CRUD (mirror groups) + media prefix + nav"
```

---

## Task 8: Admin volunteer signups

**Files:** Create `src/pages/admin/volunteer-signups.astro`, `src/pages/api/admin/volunteer-signups.ts`. (Nav entry was added in Task 7 Step 7.)

- [ ] **Step 1: Create `src/pages/api/admin/volunteer-signups.ts`**

```ts
import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { requireAdmin } from '../../../lib/admin-auth';
import { setVolunteerSignupStatus, deleteVolunteerSignup, type VolunteerSignupStatus } from '../../../lib/db/volunteer-signups';

const STATUSES = new Set<VolunteerSignupStatus>(['new', 'contacted', 'done']);

export const POST: APIRoute = async ({ request }) => {
  const auth = requireAdmin(request, env, import.meta.env.DEV);
  if ('response' in auth) return auth.response;
  const form = await request.formData();
  const id = Number(form.get('id'));
  const action = String(form.get('action') ?? '');
  if (Number.isInteger(id) && id > 0) {
    if (action === 'delete') await deleteVolunteerSignup(env.DB, id);
    else if (action === 'status') {
      const value = String(form.get('value') ?? '') as VolunteerSignupStatus;
      if (STATUSES.has(value)) await setVolunteerSignupStatus(env.DB, id, value);
    }
  }
  return new Response(null, { status: 303, headers: { Location: '/admin/volunteer-signups' } });
};
```

- [ ] **Step 2: Create `src/pages/admin/volunteer-signups.astro`**

```astro
---
import AdminLayout from '../../layouts/AdminLayout.astro';
import { env } from '../../lib/runtime';
import { getAdminEmail } from '../../lib/admin-auth';
import { listVolunteerSignups } from '../../lib/db/volunteer-signups';
import { feature } from '../../config/church';

if (!feature('community')) return Astro.redirect('/');
const email = getAdminEmail(Astro.request, env, import.meta.env.DEV);
if (!email) return Astro.redirect('/admin/denied');
const rows = await listVolunteerSignups(env.DB).catch(() => []);
const statusStyle = (s: string) =>
  s === 'done'
    ? 'background:#dcfce7;color:#166534'
    : s === 'contacted'
      ? 'background:#dbeafe;color:#1e40af'
      : 'background:#fef3c7;color:#92400e';
---
<AdminLayout title="Serve Signups" email={email} active="volunteer-signups">
  <h1 class="text-2xl font-semibold text-primary mb-2">Serve signups</h1>
  <p class="text-on-surface-variant mb-6">People who offered to serve. Pass each to the relevant team lead.</p>
  {
    rows.length === 0 ? (
      <p class="text-on-surface-variant">No signups yet.</p>
    ) : (
      <div class="space-y-3">
        {rows.map((c) => (
          <div class="border border-champagne rounded-lg p-4 bg-surface-container-lowest">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <p class="text-primary font-medium">{c.name} · <span class="font-normal text-on-surface-variant">{c.email}</span>{c.phone ? <span class="font-normal text-on-surface-variant"> · {c.phone}</span> : null}</p>
                <p class="text-sm text-heritage-gold mt-1">Wants to serve: {c.role_name ?? '(role removed)'}</p>
                {c.message && <p class="text-sm text-on-surface-variant mt-2 whitespace-pre-line">{c.message}</p>}
                <p class="text-xs text-on-surface-variant mt-2">{c.created_at?.slice(0, 16)}</p>
              </div>
              <span class="text-xs px-2 py-0.5 rounded-full flex-none" style={statusStyle(c.status)}>{c.status}</span>
            </div>
            <div class="flex gap-2 mt-3">
              {c.status !== 'contacted' && (
                <form method="POST" action="/api/admin/volunteer-signups">
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="action" value="status" />
                  <input type="hidden" name="value" value="contacted" />
                  <button class="text-sm px-3 py-1.5 border border-champagne rounded text-primary">Contacted</button>
                </form>
              )}
              {c.status !== 'done' && (
                <form method="POST" action="/api/admin/volunteer-signups">
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="action" value="status" />
                  <input type="hidden" name="value" value="done" />
                  <button class="text-sm px-3 py-1.5 bg-primary text-on-primary rounded">Done</button>
                </form>
              )}
              <form method="POST" action="/api/admin/volunteer-signups" onsubmit="return confirm('Delete this signup?')">
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="action" value="delete" />
                <button class="text-sm px-3 py-1.5 text-accent-deep">Delete</button>
              </form>
            </div>
          </div>
        ))}
      </div>
    )
  }
</AdminLayout>
```

- [ ] **Step 3: Build + commit**

Run: `npx astro build`
Expected: `Complete!`.

```bash
git add src/pages/admin/volunteer-signups.astro src/pages/api/admin/volunteer-signups.ts
git commit -m "feat: admin serve signups (volunteer triage)"
```

---

## Task 9: Final gate

- [ ] **Step 1: Full suite**

Run: `npx vitest run`
Expected: PASS — prior 249 + new (options 2, roles 3, signups 2, handler 2) = 258, all green.

- [ ] **Step 2: Build**

Run: `npx astro build`
Expected: `Complete!`.

- [ ] **Step 3: Clean tree**

Run: `git status --short`
Expected: empty.

---

## Task 10: Finish

- [ ] **Step 1:** Announce: "I'm using the finishing-a-development-branch skill to complete this work."
- [ ] **Step 2:** REQUIRED SUB-SKILL: superpowers:finishing-a-development-branch → merge `feat/D4-volunteer` → `main`.

> **Ship-to-Kharis follow-up:** `git checkout kharis && git merge main`; apply migrations `0024` + `0025` remote (`npx wrangler d1 migrations apply kharisbuilders --remote`); `npm run build && npx wrangler deploy` (wrangler is authed to the Missdiasporagh account that owns Kharis); verify `/serve` 200.

---

## Definition of Done
- `/serve` renders when `feature('community')` (redirects when off); lists published roles; the two filters narrow cards; "I want to serve" captures a signup with the snapshot role name + phone + notifies staff; missing/unpublished role rejected.
- Admin CRUD for roles (incl. image + publish) + signup triage (status + delete) work.
- Footer "Serve" + About-page CTA appear only when `community` is on.
- Migrations `0024`+`0025` applied locally; `npx vitest run` green (~258); `npx astro build` passes.
- Merges to `main`; ships to Kharis via the follow-up above.

**Next:** D5 (event RSVP + .ics calendar download).
```
