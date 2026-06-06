# D3: Small-Group Finder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development). Steps use checkbox (`- [ ]`) syntax.

**Goal:** A public `/groups` finder (browse + filter by day/format/audience, express interest per group), with admin CRUD for groups and an interest list for follow-up.

**Architecture:** Two tables (`groups` mirroring `ministries`; `group_interests` with a `group_name` snapshot). An options registry, the standard `handleX` capture pipeline, a filterable public page (client-side), and CRUD admin mirroring ministries. Reuses the `community` flag. Pure logic unit-tested; pages verified by build.

**Tech Stack:** Astro 6 SSR, Cloudflare D1 (wrangler migrations) + R2, Vitest + Miniflare, Turnstile. Spec: `docs/superpowers/specs/2026-06-05-D3-small-group-finder-design.md`.

**Working dir:** `C:\dev\Projects\KharisBuilders Project\stitch_kharisbuilders_church_web_design`.

---

## File Structure

```
migrations/0022_groups.sql                 # CREATE (Task 1)
migrations/0023_group_interests.sql        # CREATE (Task 1)
src/lib/community/group-options.ts         # CREATE — options registry (Task 2)
tests/community/group-options.test.ts      # CREATE (Task 2)
src/lib/db/schemas.ts                      # MODIFY — Group + GroupInterest schemas (Task 3)
src/lib/db/groups.ts                       # CREATE — groups data access (Task 3)
tests/db/groups.test.ts                    # CREATE (Task 3)
src/lib/db/group-interests.ts             # CREATE — interests data access (Task 4)
tests/db/group-interests.test.ts          # CREATE (Task 4)
src/lib/community/group-interest-handler.ts# CREATE — capture pipeline (Task 5)
tests/community/group-interest-handler.test.ts # CREATE (Task 5)
src/pages/groups.astro                     # CREATE — the finder (Task 6)
src/pages/api/forms/group-interest.ts      # CREATE (Task 6)
src/components/Footer.astro                # MODIFY — Groups footer link (Task 6)
src/pages/ministries.astro                 # MODIFY — Find-a-group CTA (Task 6)
src/components/admin/GroupForm.astro        # CREATE (Task 7)
src/pages/admin/groups.astro               # CREATE — list (Task 7)
src/pages/admin/groups/new.astro           # CREATE (Task 7)
src/pages/admin/groups/[id].astro          # CREATE (Task 7)
src/pages/api/admin/groups.ts              # CREATE (Task 7)
src/pages/media/[...key].ts                # MODIFY — add 'groups/' prefix (Task 7)
src/layouts/AdminLayout.astro              # MODIFY — Groups nav (Task 7)
src/pages/admin/group-interests.astro      # CREATE (Task 8)
src/pages/api/admin/group-interests.ts     # CREATE (Task 8)
src/layouts/AdminLayout.astro              # MODIFY — Group Signups nav (Task 8)
```

---

## Task 1: Migrations

**Files:** Create `migrations/0022_groups.sql`, `migrations/0023_group_interests.sql`.

- [ ] **Step 1: Branch**

Run: `git status --short && git rev-parse --abbrev-ref HEAD` → empty, `main`. Then `git checkout -b feat/D3-groups`.

- [ ] **Step 2: Create `migrations/0022_groups.sql`**

```sql
-- Small groups (life groups / home groups) shown on the public finder.
CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  day TEXT,
  time TEXT,
  location TEXT,
  format TEXT NOT NULL DEFAULT 'in_person',
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

- [ ] **Step 3: Create `migrations/0023_group_interests.sql`**

```sql
-- Per-group "I'm interested" submissions, for leader follow-up.
CREATE TABLE IF NOT EXISTS group_interests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER,
  group_name TEXT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- [ ] **Step 4: Apply locally**

Run: `npx wrangler d1 migrations apply church-template --local`
Expected: applies `0022` + `0023`. No error.

- [ ] **Step 5: Commit**

```bash
git add migrations/0022_groups.sql migrations/0023_group_interests.sql
git commit -m "feat(d1): groups + group_interests tables (migrations 0022-0023)"
```

---

## Task 2: Options registry

**Files:** Create `src/lib/community/group-options.ts`, `tests/community/group-options.test.ts`.

- [ ] **Step 1: Write the failing test** `tests/community/group-options.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { DAYS, FORMATS, AUDIENCES, FORMAT_KEYS, AUDIENCE_KEYS, optionLabel } from '../../src/lib/community/group-options';

describe('group-options', () => {
  it('has unique keys per list', () => {
    for (const list of [DAYS, FORMATS, AUDIENCES]) {
      const keys = list.map((o) => o.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
    expect(FORMAT_KEYS).toContain('in_person');
    expect(AUDIENCE_KEYS).toContain('everyone');
  });
  it('optionLabel returns the label, or the key when unknown', () => {
    expect(optionLabel(FORMATS, 'in_person')).toBe('In person');
    expect(optionLabel(AUDIENCES, 'zzz')).toBe('zzz');
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/community/group-options.test.ts`
Expected: FAIL (cannot import).

- [ ] **Step 3: Create `src/lib/community/group-options.ts`**

```ts
export interface Option {
  key: string;
  label: string;
}

export const DAYS: Option[] = [
  { key: 'Sunday', label: 'Sunday' },
  { key: 'Monday', label: 'Monday' },
  { key: 'Tuesday', label: 'Tuesday' },
  { key: 'Wednesday', label: 'Wednesday' },
  { key: 'Thursday', label: 'Thursday' },
  { key: 'Friday', label: 'Friday' },
  { key: 'Saturday', label: 'Saturday' },
  { key: 'Various', label: 'Various / flexible' },
];

export const FORMATS: Option[] = [
  { key: 'in_person', label: 'In person' },
  { key: 'online', label: 'Online' },
  { key: 'hybrid', label: 'Hybrid' },
];

export const AUDIENCES: Option[] = [
  { key: 'everyone', label: 'Everyone' },
  { key: 'men', label: 'Men' },
  { key: 'women', label: 'Women' },
  { key: 'young_adults', label: 'Young adults' },
  { key: 'couples', label: 'Couples' },
  { key: 'youth', label: 'Youth' },
  { key: 'seniors', label: 'Seniors' },
  { key: 'families', label: 'Families' },
];

export const FORMAT_KEYS: string[] = FORMATS.map((o) => o.key);
export const AUDIENCE_KEYS: string[] = AUDIENCES.map((o) => o.key);

export function optionLabel(list: Option[], key: string): string {
  return list.find((o) => o.key === key)?.label ?? key;
}
```

- [ ] **Step 4: Run → pass**

Run: `npx vitest run tests/community/group-options.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/community/group-options.ts tests/community/group-options.test.ts
git commit -m "feat: group options registry (days/formats/audiences)"
```

---

## Task 3: Schemas + groups data access

**Files:** Modify `src/lib/db/schemas.ts`; Create `src/lib/db/groups.ts`, `tests/db/groups.test.ts`.

- [ ] **Step 1: Append the schemas to `src/lib/db/schemas.ts`**

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
export type GroupInput = z.infer<typeof GroupInputSchema>;

export const GroupInterestInputSchema = z.object({
  group_id: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  message: z.string().trim().max(2000).optional().or(z.literal('')),
});
export type GroupInterestInput = z.infer<typeof GroupInterestInputSchema>;
```

- [ ] **Step 2: Write the failing test** `tests/db/groups.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import {
  createGroup,
  listPublishedGroups,
  listAllGroups,
  getGroupById,
  setGroupPublished,
  deleteGroup,
} from '../../src/lib/db/groups';

const g = (over: Record<string, unknown> = {}) => ({
  name: 'Tuesday Group',
  description: 'A warm group.',
  day: 'Tuesday',
  time: '7:00 PM',
  location: 'Eastside',
  format: 'in_person',
  audience: 'everyone',
  leader: 'Ada',
  sort_order: 0,
  published: false,
  ...over,
});

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
  await createGroup(ctx.db, g({ name: 'A', sort_order: 2, published: true }), 'admin@x');
  await createGroup(ctx.db, g({ name: 'B', sort_order: 1, published: true }), 'admin@x');
  await createGroup(ctx.db, g({ name: 'Draft', published: false }), 'admin@x');
});
afterAll(async () => { await ctx.dispose(); });

describe('groups', () => {
  it('listPublishedGroups returns only published, ordered by sort_order', async () => {
    const rows = await listPublishedGroups(ctx.db);
    expect(rows.map((r) => r.name)).toEqual(['B', 'A']);
  });
  it('listAllGroups includes drafts; getGroupById works', async () => {
    expect((await listAllGroups(ctx.db)).length).toBe(3);
    expect((await getGroupById(ctx.db, 1))?.name).toBe('A');
  });
  it('publish toggle + delete', async () => {
    await setGroupPublished(ctx.db, 3, true);
    expect((await listPublishedGroups(ctx.db)).length).toBe(3);
    await deleteGroup(ctx.db, 3);
    expect((await listAllGroups(ctx.db)).some((r) => r.id === 3)).toBe(false);
  });
});
```

- [ ] **Step 3: Run → fail**

Run: `npx vitest run tests/db/groups.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 4: Create `src/lib/db/groups.ts`**

```ts
import type { GroupInput } from './schemas';

export interface Group {
  id: number;
  name: string;
  description: string | null;
  day: string | null;
  time: string | null;
  location: string | null;
  format: string;
  audience: string;
  leader: string | null;
  image_key: string | null;
  sort_order: number;
}
export interface GroupFull extends Group {
  published: number;
  updated_by: string | null;
}

const COLS = 'id, name, description, day, time, location, format, audience, leader, image_key, sort_order';

export async function listPublishedGroups(db: D1Database): Promise<Group[]> {
  const { results } = await db
    .prepare(`SELECT ${COLS} FROM groups WHERE published = 1 ORDER BY sort_order ASC, name ASC`)
    .all<Group>();
  return results;
}
export async function listAllGroups(db: D1Database): Promise<GroupFull[]> {
  const { results } = await db
    .prepare(`SELECT ${COLS}, published, updated_by FROM groups ORDER BY sort_order ASC, name ASC`)
    .all<GroupFull>();
  return results;
}
export async function getGroupById(db: D1Database, id: number): Promise<GroupFull | null> {
  const row = await db
    .prepare(`SELECT ${COLS}, published, updated_by FROM groups WHERE id = ?`)
    .bind(id)
    .first<GroupFull>();
  return row ?? null;
}
export async function createGroup(db: D1Database, input: GroupInput, email: string): Promise<number> {
  const r = await db
    .prepare(
      `INSERT INTO groups (name, description, day, time, location, format, audience, leader, sort_order, published, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.name,
      input.description || null,
      input.day || null,
      input.time || null,
      input.location || null,
      input.format,
      input.audience,
      input.leader || null,
      input.sort_order,
      input.published ? 1 : 0,
      email,
    )
    .run();
  return Number(r.meta.last_row_id);
}
export async function updateGroup(db: D1Database, id: number, input: GroupInput, email: string): Promise<void> {
  await db
    .prepare(
      `UPDATE groups SET name=?, description=?, day=?, time=?, location=?, format=?, audience=?, leader=?,
        sort_order=?, published=?, updated_by=?, updated_at=datetime('now') WHERE id=?`,
    )
    .bind(
      input.name,
      input.description || null,
      input.day || null,
      input.time || null,
      input.location || null,
      input.format,
      input.audience,
      input.leader || null,
      input.sort_order,
      input.published ? 1 : 0,
      email,
      id,
    )
    .run();
}
export async function setGroupPublished(db: D1Database, id: number, published: boolean): Promise<void> {
  await db.prepare("UPDATE groups SET published=?, updated_at=datetime('now') WHERE id=?").bind(published ? 1 : 0, id).run();
}
export async function deleteGroup(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM groups WHERE id = ?').bind(id).run();
}
export async function setGroupImage(db: D1Database, id: number, key: string): Promise<void> {
  await db.prepare("UPDATE groups SET image_key=?, updated_at=datetime('now') WHERE id=?").bind(key, id).run();
}
```

- [ ] **Step 5: Run → pass**

Run: `npx vitest run tests/db/groups.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/schemas.ts src/lib/db/groups.ts tests/db/groups.test.ts
git commit -m "feat(d1): groups data access + Group/GroupInterest schemas"
```

---

## Task 4: Group-interests data access

**Files:** Create `src/lib/db/group-interests.ts`, `tests/db/group-interests.test.ts`.

- [ ] **Step 1: Write the failing test** `tests/db/group-interests.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import {
  createGroupInterest,
  listGroupInterests,
  setGroupInterestStatus,
  deleteGroupInterest,
} from '../../src/lib/db/group-interests';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
  await createGroupInterest(ctx.db, { group_id: 5, group_name: 'Tuesday Group', name: 'Ada', email: 'a@x.com', message: 'Keen' });
  await createGroupInterest(ctx.db, { group_id: 6, group_name: 'Mens', name: 'Ben', email: 'b@x.com', message: '' });
});
afterAll(async () => { await ctx.dispose(); });

describe('group-interests', () => {
  it('stores the group_name snapshot, newest first', async () => {
    const rows = await listGroupInterests(ctx.db);
    expect(rows.map((r) => r.name)).toEqual(['Ben', 'Ada']);
    expect(rows[1].group_name).toBe('Tuesday Group');
    expect(rows[1].status).toBe('new');
  });
  it('status + delete', async () => {
    await setGroupInterestStatus(ctx.db, 1, 'done');
    expect((await listGroupInterests(ctx.db)).find((r) => r.id === 1)?.status).toBe('done');
    await deleteGroupInterest(ctx.db, 2);
    expect((await listGroupInterests(ctx.db)).some((r) => r.id === 2)).toBe(false);
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/db/group-interests.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `src/lib/db/group-interests.ts`**

```ts
export type GroupInterestStatus = 'new' | 'contacted' | 'done';

export interface GroupInterest {
  id: number;
  group_id: number | null;
  group_name: string | null;
  name: string;
  email: string;
  message: string | null;
  status: string;
  created_at: string;
}

export async function createGroupInterest(
  db: D1Database,
  input: { group_id: number; group_name: string; name: string; email: string; message: string },
): Promise<void> {
  await db
    .prepare('INSERT INTO group_interests (group_id, group_name, name, email, message) VALUES (?, ?, ?, ?, ?)')
    .bind(input.group_id, input.group_name, input.name, input.email, input.message || null)
    .run();
}

export async function listGroupInterests(db: D1Database, limit = 200): Promise<GroupInterest[]> {
  const { results } = await db
    .prepare(
      'SELECT id, group_id, group_name, name, email, message, status, created_at FROM group_interests ORDER BY id DESC LIMIT ?',
    )
    .bind(limit)
    .all<GroupInterest>();
  return results;
}

export async function setGroupInterestStatus(db: D1Database, id: number, status: GroupInterestStatus): Promise<void> {
  await db.prepare('UPDATE group_interests SET status = ? WHERE id = ?').bind(status, id).run();
}

export async function deleteGroupInterest(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM group_interests WHERE id = ?').bind(id).run();
}
```

- [ ] **Step 4: Run → pass**

Run: `npx vitest run tests/db/group-interests.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/group-interests.ts tests/db/group-interests.test.ts
git commit -m "feat(d1): group-interests data access (snapshot group_name)"
```

---

## Task 5: Interest handler

**Files:** Create `src/lib/community/group-interest-handler.ts`, `tests/community/group-interest-handler.test.ts`.

- [ ] **Step 1: Write the failing test** `tests/community/group-interest-handler.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { handleGroupInterest } from '../../src/lib/community/group-interest-handler';
import { createGroup } from '../../src/lib/db/groups';
import { listGroupInterests } from '../../src/lib/db/group-interests';

let ctx: TestDb;
let pubId: number;
let draftId: number;
beforeAll(async () => {
  ctx = await createTestDb();
  pubId = await createGroup(ctx.db, { name: 'Open Group', description: '', day: 'Tuesday', time: '', location: '', format: 'in_person', audience: 'everyone', leader: '', sort_order: 0, published: true }, 'a@x');
  draftId = await createGroup(ctx.db, { name: 'Hidden', description: '', day: '', time: '', location: '', format: 'in_person', audience: 'everyone', leader: '', sort_order: 0, published: false }, 'a@x');
});
afterAll(async () => { await ctx.dispose(); });

function form(f: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(f)) fd.append(k, v);
  return fd;
}
const okFetch = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
const env = () => ({ DB: ctx.db, TURNSTILE_SECRET_KEY: 'x' }) as unknown as Parameters<typeof handleGroupInterest>[0];

describe('handleGroupInterest', () => {
  it('captures interest in a published group with the snapshot name', async () => {
    vi.stubGlobal('fetch', okFetch);
    const r = await handleGroupInterest(env(), form({ group_id: String(pubId), name: 'Ada', email: 'a@x.com', 'cf-turnstile-response': 't' }), '1.1.1.1');
    expect(r).toEqual({ status: 303, redirect: '/groups?interest=ok' });
    const rows = await listGroupInterests(ctx.db);
    expect(rows[0].group_name).toBe('Open Group');
    vi.unstubAllGlobals();
  });
  it('rejects a missing or unpublished group without storing', async () => {
    const before = (await listGroupInterests(ctx.db)).length;
    const r1 = await handleGroupInterest(env(), form({ group_id: '99999', name: 'X', email: 'x@x.com', 'cf-turnstile-response': 't' }), undefined);
    const r2 = await handleGroupInterest(env(), form({ group_id: String(draftId), name: 'X', email: 'x@x.com', 'cf-turnstile-response': 't' }), undefined);
    expect(r1.redirect).toBe('/groups?interest=err');
    expect(r2.redirect).toBe('/groups?interest=err');
    expect((await listGroupInterests(ctx.db)).length).toBe(before);
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/community/group-interest-handler.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `src/lib/community/group-interest-handler.ts`**

```ts
import { GroupInterestInputSchema } from '../db/schemas';
import { getGroupById } from '../db/groups';
import { createGroupInterest } from '../db/group-interests';
import { verifyTurnstile } from '../turnstile';
import { notifyStaff, type NotifyEnv } from '../notify';

export type GroupInterestEnv = NotifyEnv & { DB: D1Database; TURNSTILE_SECRET_KEY?: string };
export interface FormResult {
  status: number;
  redirect?: string;
}

/** Pure group-interest pipeline: validate -> group exists+published -> Turnstile -> insert -> notify. */
export async function handleGroupInterest(env: GroupInterestEnv, form: FormData, ip?: string): Promise<FormResult> {
  const parsed = GroupInterestInputSchema.safeParse({
    group_id: form.get('group_id'),
    name: form.get('name'),
    email: form.get('email'),
    message: form.get('message') ?? '',
  });
  if (!parsed.success) return { status: 303, redirect: '/groups?interest=err' };

  const group = await getGroupById(env.DB, parsed.data.group_id);
  if (!group || !group.published) return { status: 303, redirect: '/groups?interest=err' };

  const ok = await verifyTurnstile(env.TURNSTILE_SECRET_KEY ?? '', String(form.get('cf-turnstile-response') ?? ''), ip);
  if (!ok) return { status: 303, redirect: '/groups?interest=err' };

  await createGroupInterest(env.DB, {
    group_id: group.id,
    group_name: group.name,
    name: parsed.data.name,
    email: parsed.data.email,
    message: parsed.data.message ?? '',
  });
  await notifyStaff(env, 'New group interest', `${parsed.data.name} (${parsed.data.email}) is interested in ${group.name}`);
  return { status: 303, redirect: '/groups?interest=ok' };
}
```

- [ ] **Step 4: Run → pass**

Run: `npx vitest run tests/community/group-interest-handler.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/community/group-interest-handler.ts tests/community/group-interest-handler.test.ts
git commit -m "feat: handleGroupInterest (validate published group, snapshot name)"
```

---

## Task 6: Public finder + endpoint + discovery

**Files:** Create `src/pages/groups.astro`, `src/pages/api/forms/group-interest.ts`; Modify `src/components/Footer.astro`, `src/pages/ministries.astro`.

- [ ] **Step 1: Create `src/pages/api/forms/group-interest.ts`**

```ts
import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { handleGroupInterest } from '../../../lib/community/group-interest-handler';

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const ip = request.headers.get('cf-connecting-ip') ?? undefined;
  const r = await handleGroupInterest(env, form, ip);
  return new Response(null, { status: r.status, headers: { Location: r.redirect ?? '/groups' } });
};
```

- [ ] **Step 2: Create `src/pages/groups.astro`**

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
import { listPublishedGroups, type Group } from '../lib/db/groups';
import { DAYS, FORMATS, AUDIENCES, optionLabel } from '../lib/community/group-options';
import { SITE } from '../lib/seo';
import { feature } from '../config/church';

if (!feature('community')) return Astro.redirect('/');

let siteKey = '1x00000000000000000000AA';
let cimg = makeImage({});
let groups: Group[] = [];
try {
  const settings = await getAllSettings(env.DB);
  siteKey = settings.turnstile_site_key ?? siteKey;
  cimg = makeImage(await getAllContent(env.DB).catch(() => ({})));
  groups = await listPublishedGroups(env.DB);
} catch {
  // DB unavailable in some envs — render an empty finder
}
const status = Astro.url.searchParams.get('interest');
---
<PublicLayout title={`Find a Group | ${SITE.name}`} description={`Browse and join a small group at ${SITE.name}.`}>
  <PageHero image={cimg('pages.ministries_hero')} height="h-[300px] md:h-[380px]">
    <span class="font-label-sm uppercase tracking-[0.3em] text-heritage-gold mb-4 block hero-shadow">Community</span>
    <h1 class="font-display text-display-mobile md:text-display-lg text-white hero-shadow">Find a Group</h1>
    <p class="font-body text-body-lg text-white/85 max-w-2xl mx-auto mt-4 hero-shadow">Life is better together — find a group that fits.</p>
  </PageHero>

  <section class="py-16 md:py-24 px-margin-mobile md:px-margin-desktop max-w-[var(--container-max)] mx-auto">
    {status === 'ok' && (
      <div class="max-w-2xl mx-auto mb-10 border-t-2 border-heritage-gold bg-surface-container-lowest p-5 text-center font-body text-body-md text-primary">
        Thank you — the group's leader will be in touch soon.
      </div>
    )}
    {status === 'err' && (
      <div class="max-w-2xl mx-auto mb-10 border-t-2 border-accent-deep bg-surface-container-lowest p-5 text-center font-body text-body-md text-primary">
        Sorry — we couldn't record that. Please try again.
      </div>
    )}

    {groups.length === 0 ? (
      <p class="text-center font-body text-body-md text-stone-gray">No groups listed yet — check back soon.</p>
    ) : (
      <>
        <!-- Filters -->
        <div class="flex flex-wrap gap-4 justify-center mb-10">
          <select id="f-day" class="border border-champagne bg-surface px-4 py-2 font-body text-body-md text-primary"><option value="">Any day</option>{DAYS.map((d) => (<option value={d.key}>{d.label}</option>))}</select>
          <select id="f-format" class="border border-champagne bg-surface px-4 py-2 font-body text-body-md text-primary"><option value="">Any format</option>{FORMATS.map((f) => (<option value={f.key}>{f.label}</option>))}</select>
          <select id="f-audience" class="border border-champagne bg-surface px-4 py-2 font-body text-body-md text-primary"><option value="">Anyone</option>{AUDIENCES.map((a) => (<option value={a.key}>{a.label}</option>))}</select>
        </div>
        <p id="g-empty" class="hidden text-center font-body text-body-md text-stone-gray mb-8">No groups match those filters.</p>

        <div id="g-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((grp) => (
            <article class="group-card bg-surface-container-lowest border border-champagne flex flex-col overflow-hidden" data-day={grp.day ?? ''} data-format={grp.format} data-audience={grp.audience}>
              <div class="aspect-[16/10] overflow-hidden bg-surface-dim">
                <img src={mediaUrl(grp.image_key) ?? PLACEHOLDER.card} alt="" class="w-full h-full object-cover" />
              </div>
              <div class="p-6 flex flex-col flex-1">
                <h3 class="font-display text-headline-md text-primary mb-1">{grp.name}</h3>
                <p class="font-label-sm uppercase tracking-[0.14em] text-stone-gray mb-3">
                  {[grp.day, grp.time].filter(Boolean).join(' · ')}{grp.location ? ` · ${grp.location}` : ''}
                </p>
                <div class="flex flex-wrap gap-2 mb-3">
                  <span class="text-xs px-2 py-0.5 rounded-full border border-champagne text-primary">{optionLabel(FORMATS, grp.format)}</span>
                  <span class="text-xs px-2 py-0.5 rounded-full border border-champagne text-primary">{optionLabel(AUDIENCES, grp.audience)}</span>
                </div>
                {grp.description && <p class="font-body text-body-md text-stone-gray mb-4 flex-1 whitespace-pre-line">{grp.description}</p>}
                {grp.leader && <p class="font-body text-body-md text-stone-gray mb-4">Led by {grp.leader}</p>}
                <button type="button" class="interest-btn mt-auto self-start font-label-sm uppercase tracking-[0.14em] text-heritage-gold hover:text-primary transition-colors" data-id={grp.id} data-name={grp.name}>I'm interested →</button>
              </div>
            </article>
          ))}
        </div>

        <!-- Shared interest form -->
        <div id="interest-form" class="max-w-2xl mx-auto mt-16 bg-surface-container-lowest border-t-2 border-heritage-gold elev-2 p-8 md:p-10">
          <h2 class="font-display text-headline-md text-primary mb-1">I'm interested</h2>
          <p class="font-body text-body-md text-stone-gray mb-6">Interested in: <span id="interest-group" class="text-primary font-medium">choose a group above</span></p>
          <form method="POST" action="/api/forms/group-interest" class="space-y-5">
            <input type="hidden" name="group_id" id="interest-group-id" value="" />
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input name="name" required maxlength="120" placeholder="Your name" class="border border-champagne bg-surface px-4 py-3 font-body text-body-md text-primary" />
              <input name="email" type="email" required maxlength="200" placeholder="Email" class="border border-champagne bg-surface px-4 py-3 font-body text-body-md text-primary" />
            </div>
            <textarea name="message" rows="3" maxlength="2000" placeholder="Anything you'd like the leader to know? (optional)" class="w-full border border-champagne bg-surface px-4 py-3 font-body text-body-md text-primary"></textarea>
            <div class="cf-turnstile" data-sitekey={siteKey}></div>
            <button type="submit" class="bg-heritage-gold text-primary font-label-md uppercase tracking-widest px-8 py-3 hover:bg-secondary transition-all">Send</button>
          </form>
        </div>
      </>
    )}
  </section>

  <script is:inline src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
  <script is:inline>
    const day = document.getElementById('f-day');
    const fmt = document.getElementById('f-format');
    const aud = document.getElementById('f-audience');
    const cards = Array.from(document.querySelectorAll('.group-card'));
    const empty = document.getElementById('g-empty');
    function applyFilter() {
      let shown = 0;
      cards.forEach((c) => {
        const ok = (!day.value || c.dataset.day === day.value) && (!fmt.value || c.dataset.format === fmt.value) && (!aud.value || c.dataset.audience === aud.value);
        c.style.display = ok ? '' : 'none';
        if (ok) shown++;
      });
      if (empty) empty.classList.toggle('hidden', shown !== 0);
    }
    [day, fmt, aud].forEach((s) => s && s.addEventListener('change', applyFilter));

    const groupIdEl = document.getElementById('interest-group-id');
    const groupLabel = document.getElementById('interest-group');
    document.querySelectorAll('.interest-btn').forEach((b) => b.addEventListener('click', () => {
      groupIdEl.value = b.getAttribute('data-id');
      groupLabel.textContent = b.getAttribute('data-name');
      document.getElementById('interest-form').scrollIntoView({ behavior: 'smooth' });
    }));
  </script>
</PublicLayout>
```

- [ ] **Step 3: Footer link in `src/components/Footer.astro`** — change the `explore` array's community spread to include Groups:

```ts
  ...(feature('community') ? [{ label: 'Groups', href: '/groups' }, { label: 'Next Steps', href: '/connect' }] : []),
```

- [ ] **Step 4: Find-a-group CTA in `src/pages/ministries.astro`** — confirm it imports `feature` (it does: `import { feature } from '../config/church';`). Insert this block immediately after the opening `<PublicLayout ...>`'s `<PageHero>...</PageHero>` (i.e., right before the main ministries section). Anchor on the first `<section` after the PageHero by adding the band just before it:

```astro
  {
    feature('community') && (
      <div class="bg-primary-container text-on-primary py-10 px-margin-mobile md:px-margin-desktop">
        <div class="max-w-[var(--container-max)] mx-auto flex flex-col sm:flex-row items-center justify-between gap-5 text-center sm:text-left">
          <p class="font-display text-headline-md text-white">Looking for a smaller circle? Find a group.</p>
          <a href="/groups" class="flex-none bg-heritage-gold text-primary font-label-md uppercase tracking-widest px-8 py-3 hover:bg-secondary transition-colors">Find a group</a>
        </div>
      </div>
    )
  }
```
Place it immediately after the `</PageHero>` line in `ministries.astro`.

- [ ] **Step 5: Build**

Run: `npx astro build`
Expected: `Complete!`.

- [ ] **Step 6: Commit**

```bash
git add src/pages/groups.astro src/pages/api/forms/group-interest.ts src/components/Footer.astro src/pages/ministries.astro
git commit -m "feat: public /groups finder (filter + interest) + footer + ministries CTA"
```

---

## Task 7: Admin groups CRUD

**Files:** Create `src/components/admin/GroupForm.astro`, `src/pages/admin/groups.astro`, `src/pages/admin/groups/new.astro`, `src/pages/admin/groups/[id].astro`, `src/pages/api/admin/groups.ts`; Modify `src/pages/media/[...key].ts`, `src/layouts/AdminLayout.astro`.

- [ ] **Step 1: Add `'groups/'` to `PUBLIC_PREFIXES` in `src/pages/media/[...key].ts`**

```ts
const PUBLIC_PREFIXES = ['sermons/', 'events/', 'ministries/', 'leaders/', 'journey/', 'home-cards/', 'page/', 'groups/'];
```

- [ ] **Step 2: Create `src/components/admin/GroupForm.astro`**

```astro
---
import Field from '../Field.astro';
import Button from '../Button.astro';
import { DAYS, FORMATS, AUDIENCES } from '../../lib/community/group-options';
import type { GroupFull } from '../../lib/db/groups';
interface Props {
  group?: GroupFull | null;
}
const { group } = Astro.props;
const isEdit = !!group;
const sel = (a: string | null | undefined, b: string) => (a ?? '') === b;
---
<form method="POST" action="/api/admin/groups" enctype="multipart/form-data" class="flex flex-col gap-6 max-w-xl">
  <input type="hidden" name="_action" value={isEdit ? 'update' : 'create'} />
  {isEdit && <input type="hidden" name="id" value={String(group!.id)} />}
  <Field label="Name" name="name" required value={group?.name ?? ''} />
  <Field label="Leader" name="leader" value={group?.leader ?? ''} />
  <div class="grid grid-cols-2 gap-4">
    <label class="flex flex-col gap-1 text-xs uppercase tracking-wider text-on-surface-variant">Day
      <select name="day" class="border border-champagne bg-surface px-3 py-2 text-sm text-primary normal-case tracking-normal"><option value="">—</option>{DAYS.map((d) => (<option value={d.key} selected={sel(group?.day, d.key)}>{d.label}</option>))}</select>
    </label>
    <Field label="Time" name="time" value={group?.time ?? ''} />
  </div>
  <Field label="Location / area" name="location" value={group?.location ?? ''} />
  <div class="grid grid-cols-2 gap-4">
    <label class="flex flex-col gap-1 text-xs uppercase tracking-wider text-on-surface-variant">Format
      <select name="format" class="border border-champagne bg-surface px-3 py-2 text-sm text-primary normal-case tracking-normal">{FORMATS.map((f) => (<option value={f.key} selected={sel(group?.format, f.key)}>{f.label}</option>))}</select>
    </label>
    <label class="flex flex-col gap-1 text-xs uppercase tracking-wider text-on-surface-variant">Audience
      <select name="audience" class="border border-champagne bg-surface px-3 py-2 text-sm text-primary normal-case tracking-normal">{AUDIENCES.map((a) => (<option value={a.key} selected={sel(group?.audience, a.key)}>{a.label}</option>))}</select>
    </label>
  </div>
  <Field label="Sort order" name="sort_order" type="number" min={0} value={group?.sort_order != null ? String(group.sort_order) : '0'} />
  <Field label="Description" name="description" textarea value={group?.description ?? ''} />
  <div class="flex flex-col gap-1">
    <label for="f-image" class="text-xs uppercase tracking-wider text-on-surface-variant">Group image (optional, max 6 MB)</label>
    <input id="f-image" name="image" type="file" accept="image/*" class="text-sm text-on-surface-variant" />
    {group?.image_key && <p class="text-xs text-on-surface-variant">Current: {group.image_key}</p>}
  </div>
  <Field label="Published" name="published" type="checkbox" checked={!!group?.published} />
  <Button type="submit" variant="primary">{isEdit ? 'Save' : 'Create'}</Button>
</form>
```

- [ ] **Step 3: Create `src/pages/api/admin/groups.ts`**

```ts
import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { requireAdmin } from '../../../lib/admin-auth';
import { GroupInputSchema } from '../../../lib/db/schemas';
import { createGroup, updateGroup, deleteGroup, setGroupPublished, setGroupImage } from '../../../lib/db/groups';
import { uploadImage } from '../../../lib/media';

export const POST: APIRoute = async ({ request }) => {
  const auth = requireAdmin(request, env, import.meta.env.DEV);
  if ('response' in auth) return auth.response;
  const form = await request.formData();
  const action = String(form.get('_action') ?? '');
  const id = Number(form.get('id') ?? 0);
  try {
    if (action === 'delete') {
      await deleteGroup(env.DB, id);
    } else if (action === 'toggle') {
      await setGroupPublished(env.DB, id, String(form.get('published')) === 'true');
    } else {
      const data = GroupInputSchema.parse(Object.fromEntries(form));
      const targetId = action === 'update' ? id : await createGroup(env.DB, data, auth.email);
      if (action === 'update') await updateGroup(env.DB, id, data, auth.email);
      const image = form.get('image');
      if (image instanceof File && image.size > 0) {
        const key = await uploadImage(env.MEDIA, image, 'groups');
        await setGroupImage(env.DB, targetId, key);
      }
    }
  } catch {
    return new Response('Invalid submission', { status: 400 });
  }
  return new Response(null, { status: 303, headers: { Location: '/admin/groups' } });
};
```

- [ ] **Step 4: Create `src/pages/admin/groups.astro`**

```astro
---
import AdminLayout from '../../layouts/AdminLayout.astro';
import { env } from '../../lib/runtime';
import { getAdminEmail } from '../../lib/admin-auth';
import { listAllGroups } from '../../lib/db/groups';
import { feature } from '../../config/church';

if (!feature('community')) return Astro.redirect('/');
const email = getAdminEmail(Astro.request, env, import.meta.env.DEV);
if (!email) return Astro.redirect('/admin/denied');
const groups = await listAllGroups(env.DB).catch(() => []);
---
<AdminLayout title="Groups" email={email} active="groups">
  <a href="/admin/groups/new" class="inline-block mb-6 bg-primary text-on-primary px-5 py-2 text-sm uppercase tracking-wider">+ New group</a>
  <table class="w-full text-sm">
    <thead><tr class="text-left text-on-surface-variant border-b border-champagne"><th class="py-2">Name</th><th>Day</th><th>Order</th><th>Status</th><th class="text-right">Actions</th></tr></thead>
    <tbody>
      {groups.map((m) => (
        <tr class="border-b border-champagne/50">
          <td class="py-3"><a href={`/admin/groups/${m.id}`} class="text-primary hover:text-accent">{m.name}</a></td>
          <td>{m.day ?? '—'}</td>
          <td>{m.sort_order}</td>
          <td>{m.published ? 'Published' : 'Draft'}</td>
          <td class="text-right whitespace-nowrap">
            <form method="POST" action="/api/admin/groups" class="inline"><input type="hidden" name="_action" value="toggle" /><input type="hidden" name="id" value={String(m.id)} /><input type="hidden" name="published" value={m.published ? 'false' : 'true'} /><button class="text-accent text-xs uppercase tracking-wider">{m.published ? 'Unpublish' : 'Publish'}</button></form>
            <form method="POST" action="/api/admin/groups" class="inline ml-3" onsubmit="return confirm('Delete this group?')"><input type="hidden" name="_action" value="delete" /><input type="hidden" name="id" value={String(m.id)} /><button class="text-accent-deep text-xs uppercase tracking-wider">Delete</button></form>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
  {groups.length === 0 && <p class="text-on-surface-variant mt-4">No groups yet.</p>}
</AdminLayout>
```

- [ ] **Step 5: Create `src/pages/admin/groups/new.astro`**

```astro
---
import AdminLayout from '../../../layouts/AdminLayout.astro';
import GroupForm from '../../../components/admin/GroupForm.astro';
import { env } from '../../../lib/runtime';
import { getAdminEmail } from '../../../lib/admin-auth';
import { feature } from '../../../config/church';

if (!feature('community')) return Astro.redirect('/');
const email = getAdminEmail(Astro.request, env, import.meta.env.DEV);
if (!email) return Astro.redirect('/admin/denied');
---
<AdminLayout title="New Group" email={email} active="groups">
  <GroupForm />
  <a href="/admin/groups" class="inline-block mt-8 text-accent text-sm uppercase tracking-widest">← Back</a>
</AdminLayout>
```

- [ ] **Step 6: Create `src/pages/admin/groups/[id].astro`**

```astro
---
import AdminLayout from '../../../layouts/AdminLayout.astro';
import GroupForm from '../../../components/admin/GroupForm.astro';
import { env } from '../../../lib/runtime';
import { getAdminEmail } from '../../../lib/admin-auth';
import { getGroupById } from '../../../lib/db/groups';
import { feature } from '../../../config/church';

if (!feature('community')) return Astro.redirect('/');
const email = getAdminEmail(Astro.request, env, import.meta.env.DEV);
if (!email) return Astro.redirect('/admin/denied');
const group = await getGroupById(env.DB, Number(Astro.params.id)).catch(() => null);
if (!group) return Astro.redirect('/admin/groups');
---
<AdminLayout title="Edit Group" email={email} active="groups">
  <GroupForm group={group} />
  <a href="/admin/groups" class="inline-block mt-8 text-accent text-sm uppercase tracking-widest">← Back</a>
</AdminLayout>
```

- [ ] **Step 7: Add the Groups admin nav in `src/layouts/AdminLayout.astro`** — after the Connect entry:

```ts
  { label: 'Groups', href: '/admin/groups', key: 'groups', gate: 'community' },
```

- [ ] **Step 8: Build + commit**

Run: `npx astro build`
Expected: `Complete!`.

```bash
git add src/components/admin/GroupForm.astro src/pages/admin/groups.astro src/pages/admin/groups/new.astro "src/pages/admin/groups/[id].astro" src/pages/api/admin/groups.ts "src/pages/media/[...key].ts" src/layouts/AdminLayout.astro
git commit -m "feat: admin groups CRUD (mirror ministries) + media prefix + nav"
```

---

## Task 8: Admin group-interests

**Files:** Create `src/pages/admin/group-interests.astro`, `src/pages/api/admin/group-interests.ts`; Modify `src/layouts/AdminLayout.astro`.

- [ ] **Step 1: Create `src/pages/api/admin/group-interests.ts`**

```ts
import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { requireAdmin } from '../../../lib/admin-auth';
import { setGroupInterestStatus, deleteGroupInterest, type GroupInterestStatus } from '../../../lib/db/group-interests';

const STATUSES = new Set<GroupInterestStatus>(['new', 'contacted', 'done']);

export const POST: APIRoute = async ({ request }) => {
  const auth = requireAdmin(request, env, import.meta.env.DEV);
  if ('response' in auth) return auth.response;
  const form = await request.formData();
  const id = Number(form.get('id'));
  const action = String(form.get('action') ?? '');
  if (Number.isInteger(id) && id > 0) {
    if (action === 'delete') await deleteGroupInterest(env.DB, id);
    else if (action === 'status') {
      const value = String(form.get('value') ?? '') as GroupInterestStatus;
      if (STATUSES.has(value)) await setGroupInterestStatus(env.DB, id, value);
    }
  }
  return new Response(null, { status: 303, headers: { Location: '/admin/group-interests' } });
};
```

- [ ] **Step 2: Create `src/pages/admin/group-interests.astro`**

```astro
---
import AdminLayout from '../../layouts/AdminLayout.astro';
import { env } from '../../lib/runtime';
import { getAdminEmail } from '../../lib/admin-auth';
import { listGroupInterests } from '../../lib/db/group-interests';
import { feature } from '../../config/church';

if (!feature('community')) return Astro.redirect('/');
const email = getAdminEmail(Astro.request, env, import.meta.env.DEV);
if (!email) return Astro.redirect('/admin/denied');
const rows = await listGroupInterests(env.DB).catch(() => []);
const statusStyle = (s: string) =>
  s === 'done' ? 'background:#dcfce7;color:#166534' : s === 'contacted' ? 'background:#dbeafe;color:#1e40af' : 'background:#fef3c7;color:#92400e';
---
<AdminLayout title="Group Signups" email={email} active="group-interests">
  <h1 class="text-2xl font-semibold text-primary mb-2">Group signups</h1>
  <p class="text-on-surface-variant mb-6">People who expressed interest in a group. Pass each to the group's leader.</p>
  {rows.length === 0 ? (
    <p class="text-on-surface-variant">No signups yet.</p>
  ) : (
    <div class="space-y-3">
      {rows.map((c) => (
        <div class="border border-champagne rounded-lg p-4 bg-surface-container-lowest">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <p class="text-primary font-medium">{c.name} · <span class="font-normal text-on-surface-variant">{c.email}</span></p>
              <p class="text-sm text-heritage-gold mt-1">Interested in: {c.group_name ?? '(group removed)'}</p>
              {c.message && <p class="text-sm text-on-surface-variant mt-2 whitespace-pre-line">{c.message}</p>}
              <p class="text-xs text-on-surface-variant mt-2">{c.created_at?.slice(0, 16)}</p>
            </div>
            <span class="text-xs px-2 py-0.5 rounded-full flex-none" style={statusStyle(c.status)}>{c.status}</span>
          </div>
          <div class="flex gap-2 mt-3">
            {c.status !== 'contacted' && (<form method="POST" action="/api/admin/group-interests"><input type="hidden" name="id" value={c.id} /><input type="hidden" name="action" value="status" /><input type="hidden" name="value" value="contacted" /><button class="text-sm px-3 py-1.5 border border-champagne rounded text-primary">Contacted</button></form>)}
            {c.status !== 'done' && (<form method="POST" action="/api/admin/group-interests"><input type="hidden" name="id" value={c.id} /><input type="hidden" name="action" value="status" /><input type="hidden" name="value" value="done" /><button class="text-sm px-3 py-1.5 bg-primary text-on-primary rounded">Done</button></form>)}
            <form method="POST" action="/api/admin/group-interests" onsubmit="return confirm('Delete this signup?')"><input type="hidden" name="id" value={c.id} /><input type="hidden" name="action" value="delete" /><button class="text-sm px-3 py-1.5 text-accent-deep">Delete</button></form>
          </div>
        </div>
      ))}
    </div>
  )}
</AdminLayout>
```

- [ ] **Step 3: Add the Group Signups admin nav in `src/layouts/AdminLayout.astro`** — after the Groups entry:

```ts
  { label: 'Group Signups', href: '/admin/group-interests', key: 'group-interests', gate: 'community' },
```

- [ ] **Step 4: Build + commit**

Run: `npx astro build`
Expected: `Complete!`.

```bash
git add src/pages/admin/group-interests.astro src/pages/api/admin/group-interests.ts src/layouts/AdminLayout.astro
git commit -m "feat: admin group signups (interest triage) + nav"
```

---

## Task 9: Final gate

- [ ] **Step 1: Full suite**

Run: `npx vitest run`
Expected: PASS — prior 240 + new (options 2, groups 3, interests 2, handler 2) = 249, all green.

- [ ] **Step 2: Build**

Run: `npx astro build`
Expected: `Complete!`.

- [ ] **Step 3: Clean tree**

Run: `git status --short`
Expected: empty.

---

## Task 10: Finish

- [ ] **Step 1:** Announce: "I'm using the finishing-a-development-branch skill to complete this work."
- [ ] **Step 2:** REQUIRED SUB-SKILL: superpowers:finishing-a-development-branch → merge `feat/D3-groups` → `main`.

> **Ship-to-Kharis follow-up:** `git checkout kharis && git merge main`; apply migrations `0022` + `0023` remote (`npx wrangler d1 migrations apply kharisbuilders --remote`); `npm run build && CLOUDFLARE_ACCOUNT_ID=233d917842862e30ed5207cf7b95bc33 npx wrangler deploy`; verify `/groups` 200.

---

## Definition of Done
- `/groups` renders when `feature('community')` (redirects when off); lists published groups; the three filters narrow cards; "I'm interested" captures an interest with the snapshot group name + notifies staff; missing/unpublished group rejected.
- Admin CRUD for groups (incl. image + publish) + interest triage (status + delete) work.
- Footer "Groups" + Ministries-page CTA appear only when `community` is on.
- Migrations `0022`+`0023` applied locally; `npx vitest run` green (~249); `npx astro build` passes.
- Merges to `main`; ships to Kharis via the follow-up above.

**Next:** D4 (volunteer signups), then D5 (event RSVP + .ics).
```
