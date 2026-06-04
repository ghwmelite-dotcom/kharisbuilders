# Phase E2: Editable Lists (Leadership · Journey · Home Cards) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the About leadership team, About journey timeline, and home quick-link cards fully admin-managed (CRUD + image upload + reorder), seeded with current items so the site is unchanged until edited.

**Architecture:** Three CRUD tables following the existing `funds`/`ministries` pattern (data access + zod schema + gated admin route with `uploadImage` + form + list/new/edit pages + nav). Public pages render from D1 with index-based image fallbacks (to the bundled images) and graceful empty states. The three new R2 prefixes are added to the public media-route allowlist.

**Tech Stack:** Astro 6 SSR, Cloudflare D1 + R2, zod v4, Vitest + Miniflare. Spec: `docs/superpowers/specs/2026-06-04-editable-lists-e2-design.md`.

**Working dir:** `C:\dev\Projects\KharisBuilders Project\stitch_kharisbuilders_church_web_design` (branch `feat/phaseE2-lists` off `main`).

> **Reference patterns (copy these):** `src/lib/db/funds.ts` (data access incl. `setFundActive`/`deleteFund`), `src/pages/api/admin/sermons.ts` (route with image upload via `uploadImage`+`setSermonImage`), `src/components/admin/MinistryForm.astro` (form with `enctype=multipart/form-data`+file input), `src/pages/admin/funds.astro` / `funds/new.astro` / `funds/[id].astro` (list/new/edit), `src/lib/media.ts` (`uploadImage`,`mediaUrl`), `src/pages/media/[...key].ts` (`PUBLIC_PREFIXES`).

---

## File Structure (created/modified)

```
migrations/0015_leaders.sql 0016_journey.sql 0017_home_cards.sql
db/seed_lists.sql
src/lib/db/{leaders,journey,homeCards}.ts
src/lib/db/schemas.ts                         # + Leader/Journey/HomeCard input schemas
src/pages/media/[...key].ts                   # + 3 prefixes to PUBLIC_PREFIXES
src/pages/api/admin/{leaders,journey,home-cards}.ts
src/components/admin/{LeaderForm,JourneyForm,HomeCardForm}.astro
src/pages/admin/{leaders,journey,home-cards}.astro
src/pages/admin/{leaders,journey,home-cards}/new.astro
src/pages/admin/{leaders,journey,home-cards}/[id].astro
src/layouts/AdminLayout.astro                 # + Leadership/Journey/Home Cards nav
src/pages/about.astro src/pages/index.astro   # render lists from D1
tests/db/lists.test.ts
```

---

## Task 1: migrations + seed

**Files:** Create `migrations/0015_leaders.sql`, `0016_journey.sql`, `0017_home_cards.sql`, `db/seed_lists.sql`.

- [ ] **Step 1: `migrations/0015_leaders.sql`**
```sql
CREATE TABLE IF NOT EXISTS leaders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT,
  image_key TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);
```

- [ ] **Step 2: `migrations/0016_journey.sql`**
```sql
CREATE TABLE IF NOT EXISTS journey (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  image_key TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);
```

- [ ] **Step 3: `migrations/0017_home_cards.sql`**
```sql
CREATE TABLE IF NOT EXISTS home_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  eyebrow TEXT,
  title TEXT NOT NULL,
  description TEXT,
  href TEXT NOT NULL,
  image_key TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);
```

- [ ] **Step 4: `db/seed_lists.sql`** (current items; image_key left NULL → pages fall back to bundled images by position)
```sql
INSERT OR IGNORE INTO leaders (id, name, role, sort_order) VALUES
  (1, 'Dr. Samuel A. Kharis', 'Founding Pastor', 1),
  (2, 'Pastor Elena Kharis', 'Executive Pastor', 2),
  (3, 'Min. David Chen', 'Worship & Arts', 3);

INSERT OR IGNORE INTO journey (id, year, title, body, sort_order) VALUES
  (1, '2012', 'The First Cornerstone', 'Kharisbuilders began as a small gathering of twelve in a downtown studio, united by a vision for architectural spiritual growth.', 1),
  (2, '2017', 'Expanding the Walls', 'Our community grew to five hundred, leading us to our current sanctuary — a space designed to facilitate spiritual encounter and professional excellence.', 2),
  (3, '2024', 'Shaping the Future', 'Launching our digital global campus and the ''Builders Academy,'' training leaders for the next generation of societal transformation.', 3);

INSERT OR IGNORE INTO home_cards (id, eyebrow, title, description, href, sort_order) VALUES
  (1, 'New Here?', 'Plan a Visit', 'Know what to expect and let us welcome you home.', '/visit', 1),
  (2, 'Messages', 'Watch Sermons', 'Catch up on recent messages, anytime, anywhere.', '/sermons', 2),
  (3, 'Generosity', 'Give', 'Partner with the mission and the ministries.', '/giving', 3);
```

- [ ] **Step 5: Apply + seed locally + verify**
```bash
npx wrangler d1 migrations apply kharisbuilders --local
npx wrangler d1 execute kharisbuilders --local --file db/seed_lists.sql
npx wrangler d1 execute kharisbuilders --local --command "SELECT (SELECT COUNT(*) FROM leaders) AS l, (SELECT COUNT(*) FROM journey) AS j, (SELECT COUNT(*) FROM home_cards) AS h;"
```
Expected: l=3, j=3, h=3.

- [ ] **Step 6: Commit** `feat: leaders/journey/home_cards tables + seed`.

---

## Task 2: input schemas

**Files:** Modify `src/lib/db/schemas.ts`.

- [ ] **Step 1: Append**
```ts
export const LeaderInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  role: z.string().trim().max(120).optional().or(z.literal('')),
  sort_order: z.coerce.number().int().min(0).default(0),
});
export type LeaderInput = z.infer<typeof LeaderInputSchema>;

export const JourneyInputSchema = z.object({
  year: z.string().trim().min(1).max(20),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(2000).optional().or(z.literal('')),
  sort_order: z.coerce.number().int().min(0).default(0),
});
export type JourneyInput = z.infer<typeof JourneyInputSchema>;

export const HomeCardInputSchema = z.object({
  eyebrow: z.string().trim().max(80).optional().or(z.literal('')),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400).optional().or(z.literal('')),
  href: z.string().trim().min(1).max(200),
  sort_order: z.coerce.number().int().min(0).default(0),
});
export type HomeCardInput = z.infer<typeof HomeCardInputSchema>;
```

- [ ] **Step 2: Commit** `feat: input schemas for editable lists`.

---

## Task 3: data access (TDD)

**Files:** Create `src/lib/db/leaders.ts`, `src/lib/db/journey.ts`, `src/lib/db/homeCards.ts`, `tests/db/lists.test.ts`.

- [ ] **Step 1: Write the failing test** (`tests/db/lists.test.ts`)
```ts
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { listLeaders, createLeader, updateLeader, getLeaderById, deleteLeader, setLeaderImage } from '../../src/lib/db/leaders';
import { listJourney, createJourney, getJourneyById } from '../../src/lib/db/journey';
import { listHomeCards, createHomeCard, getHomeCardById } from '../../src/lib/db/homeCards';

let ctx: TestDb;
beforeAll(async () => { ctx = await createTestDb(); });
afterAll(async () => { await ctx.dispose(); });

describe('editable lists data access', () => {
  it('leaders: create/list ordered/update/setImage/delete', async () => {
    const b = await createLeader(ctx.db, { name: 'B', role: 'r', sort_order: 2 }, 'a@x');
    const a = await createLeader(ctx.db, { name: 'A', role: 'r', sort_order: 1 }, 'a@x');
    expect((await listLeaders(ctx.db)).map((l) => l.id)).toEqual([a, b]); // sort_order asc
    await updateLeader(ctx.db, a, { name: 'A2', role: 'r2', sort_order: 1 }, 'b@x');
    expect((await getLeaderById(ctx.db, a))?.name).toBe('A2');
    await setLeaderImage(ctx.db, a, 'leaders/x.jpg');
    expect((await getLeaderById(ctx.db, a))?.image_key).toBe('leaders/x.jpg');
    await deleteLeader(ctx.db, b);
    expect(await getLeaderById(ctx.db, b)).toBeNull();
  });
  it('journey: create + list + get', async () => {
    const id = await createJourney(ctx.db, { year: '2030', title: 'Future', body: 'x', sort_order: 1 }, 'a@x');
    expect((await getJourneyById(ctx.db, id))?.year).toBe('2030');
    expect((await listJourney(ctx.db)).some((j) => j.id === id)).toBe(true);
  });
  it('home_cards: create + list + get', async () => {
    const id = await createHomeCard(ctx.db, { eyebrow: 'E', title: 'T', description: 'd', href: '/x', sort_order: 1 }, 'a@x');
    expect((await getHomeCardById(ctx.db, id))?.href).toBe('/x');
    expect((await listHomeCards(ctx.db)).some((h) => h.id === id)).toBe(true);
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement `src/lib/db/leaders.ts`** (the template)
```ts
import type { LeaderInput } from './schemas';

export interface Leader {
  id: number;
  name: string;
  role: string | null;
  image_key: string | null;
  sort_order: number;
}

const COLS = 'id, name, role, image_key, sort_order';

export async function listLeaders(db: D1Database): Promise<Leader[]> {
  const { results } = await db.prepare(`SELECT ${COLS} FROM leaders ORDER BY sort_order ASC, id ASC`).all<Leader>();
  return results;
}
export async function getLeaderById(db: D1Database, id: number): Promise<Leader | null> {
  const row = await db.prepare(`SELECT ${COLS} FROM leaders WHERE id = ?`).bind(id).first<Leader>();
  return row ?? null;
}
export async function createLeader(db: D1Database, input: LeaderInput, email: string): Promise<number> {
  const r = await db
    .prepare('INSERT INTO leaders (name, role, sort_order, updated_by) VALUES (?, ?, ?, ?)')
    .bind(input.name, input.role || null, input.sort_order, email)
    .run();
  return Number(r.meta.last_row_id);
}
export async function updateLeader(db: D1Database, id: number, input: LeaderInput, email: string): Promise<void> {
  await db
    .prepare("UPDATE leaders SET name=?, role=?, sort_order=?, updated_by=?, updated_at=datetime('now') WHERE id=?")
    .bind(input.name, input.role || null, input.sort_order, email, id)
    .run();
}
export async function setLeaderImage(db: D1Database, id: number, key: string): Promise<void> {
  await db.prepare("UPDATE leaders SET image_key=?, updated_at=datetime('now') WHERE id=?").bind(key, id).run();
}
export async function deleteLeader(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM leaders WHERE id = ?').bind(id).run();
}
```

- [ ] **Step 4: Implement `src/lib/db/journey.ts`** — same as leaders with: interface `Journey { id; year; title; body|null; image_key|null; sort_order }`, `COLS='id, year, title, body, image_key, sort_order'`, table `journey`, create/update bind `(year, title, body||null, sort_order, ...)`, fns `listJourney/getJourneyById/createJourney/updateJourney/setJourneyImage/deleteJourney`.

- [ ] **Step 5: Implement `src/lib/db/homeCards.ts`** — same with: interface `HomeCard { id; eyebrow|null; title; description|null; href; image_key|null; sort_order }`, `COLS='id, eyebrow, title, description, href, image_key, sort_order'`, table `home_cards`, create/update bind `(eyebrow||null, title, description||null, href, sort_order, ...)`, fns `listHomeCards/getHomeCardById/createHomeCard/updateHomeCard/setHomeCardImage/deleteHomeCard`.

- [ ] **Step 6: Run → pass. Commit** `feat: data access for leaders/journey/home_cards with tests`.

---

## Task 4: media route prefixes

**Files:** Modify `src/pages/media/[...key].ts`.

- [ ] **Step 1: Extend the allowlist**
```ts
const PUBLIC_PREFIXES = ['sermons/', 'events/', 'ministries/', 'leaders/', 'journey/', 'home-cards/'];
```

- [ ] **Step 2: Build** → succeeds. **Commit** `feat: allow leaders/journey/home-cards media prefixes`.

---

## Task 5: gated admin routes

**Files:** Create `src/pages/api/admin/leaders.ts`, `journey.ts`, `home-cards.ts`.

- [ ] **Step 1: `src/pages/api/admin/leaders.ts`** (template — mirrors `sermons.ts`)
```ts
import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { requireAdmin } from '../../../lib/admin-auth';
import { LeaderInputSchema } from '../../../lib/db/schemas';
import { createLeader, updateLeader, deleteLeader, setLeaderImage } from '../../../lib/db/leaders';
import { uploadImage } from '../../../lib/media';

export const POST: APIRoute = async ({ request }) => {
  const auth = requireAdmin(request, env, import.meta.env.DEV);
  if ('response' in auth) return auth.response;
  const form = await request.formData();
  const action = String(form.get('_action') ?? '');
  const id = Number(form.get('id') ?? 0);
  try {
    if (action === 'delete') {
      await deleteLeader(env.DB, id);
    } else {
      const data = LeaderInputSchema.parse(Object.fromEntries(form));
      const targetId = action === 'update' ? id : await createLeader(env.DB, data, auth.email);
      if (action === 'update') await updateLeader(env.DB, id, data, auth.email);
      const image = form.get('image');
      if (image instanceof File && image.size > 0) {
        const key = await uploadImage(env.MEDIA, image, 'leaders');
        await setLeaderImage(env.DB, targetId, key);
      }
    }
  } catch {
    return new Response('Invalid submission', { status: 400 });
  }
  return new Response(null, { status: 303, headers: { Location: '/admin/leaders' } });
};
```

- [ ] **Step 2: `journey.ts`** — same with `JourneyInputSchema`, `journey` data-access fns, prefix `'journey'`, redirect `/admin/journey`.
- [ ] **Step 3: `home-cards.ts`** — same with `HomeCardInputSchema`, `homeCards` fns, prefix `'home-cards'`, redirect `/admin/home-cards`.

- [ ] **Step 4: Build → succeeds. Commit** `feat: gated admin routes for editable lists`.

---

## Task 6: admin forms, pages, nav

**Files:** Create `src/components/admin/{LeaderForm,JourneyForm,HomeCardForm}.astro`; `src/pages/admin/{leaders,journey,home-cards}.astro` + `.../new.astro` + `.../[id].astro`; modify `src/layouts/AdminLayout.astro`.

- [ ] **Step 1: `src/components/admin/LeaderForm.astro`** (mirrors `MinistryForm.astro`)
```astro
---
import Field from '../Field.astro';
import Button from '../Button.astro';
import type { Leader } from '../../lib/db/leaders';
interface Props { leader?: Leader | null }
const { leader } = Astro.props;
const isEdit = !!leader;
---
<form method="POST" action="/api/admin/leaders" enctype="multipart/form-data" class="flex flex-col gap-6 max-w-xl">
  <input type="hidden" name="_action" value={isEdit ? 'update' : 'create'} />
  {isEdit && <input type="hidden" name="id" value={String(leader!.id)} />}
  <Field label="Name" name="name" required value={leader?.name ?? ''} />
  <Field label="Role" name="role" value={leader?.role ?? ''} />
  <Field label="Sort order" name="sort_order" type="number" min={0} value={leader?.sort_order != null ? String(leader.sort_order) : '0'} />
  <div class="flex flex-col gap-1">
    <label for="f-image" class="text-xs uppercase tracking-wider text-on-surface-variant">Photo (optional, max 6 MB)</label>
    <input id="f-image" name="image" type="file" accept="image/*" class="text-sm text-on-surface-variant" />
    {leader?.image_key && <p class="text-xs text-on-surface-variant">Current: {leader.image_key}</p>}
  </div>
  <Button type="submit" variant="primary">{isEdit ? 'Save' : 'Create'}</Button>
</form>
```

- [ ] **Step 2: `JourneyForm.astro`** — fields: Year (`year`, required), Title (`title`, required), Body (`body`, textarea), Sort order, image. Action `/api/admin/journey`. **Step 3: `HomeCardForm.astro`** — fields: Eyebrow (`eyebrow`), Title (`title`, required), Description (`description`, textarea), Link (`href`, required), Sort order, image. Action `/api/admin/home-cards`.

- [ ] **Step 4: List pages** — `src/pages/admin/leaders.astro` (mirrors `funds.astro`):
```astro
---
import AdminLayout from '../../layouts/AdminLayout.astro';
import { env } from '../../lib/runtime';
import { getAdminEmail } from '../../lib/admin-auth';
import { listLeaders } from '../../lib/db/leaders';
const email = getAdminEmail(Astro.request, env, import.meta.env.DEV);
if (!email) return Astro.redirect('/admin/denied');
const leaders = await listLeaders(env.DB).catch(() => []);
---
<AdminLayout title="Leadership" email={email} active="leaders">
  <a href="/admin/leaders/new" class="inline-block mb-6 bg-primary text-on-primary px-5 py-2 text-sm uppercase tracking-wider">+ New leader</a>
  <table class="w-full text-sm">
    <thead><tr class="text-left text-on-surface-variant border-b border-champagne"><th class="py-2">Name</th><th>Role</th><th>Order</th><th class="text-right">Actions</th></tr></thead>
    <tbody>
      {leaders.map((l) => (
        <tr class="border-b border-champagne/50">
          <td class="py-3"><a href={`/admin/leaders/${l.id}`} class="text-primary hover:text-accent">{l.name}</a></td>
          <td>{l.role}</td><td>{l.sort_order}</td>
          <td class="text-right">
            <form method="POST" action="/api/admin/leaders" class="inline" onsubmit="return confirm('Delete this leader?')">
              <input type="hidden" name="_action" value="delete" /><input type="hidden" name="id" value={String(l.id)} />
              <button class="text-accent-deep text-xs uppercase tracking-wider">Delete</button>
            </form>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
  {leaders.length === 0 && <p class="text-on-surface-variant mt-4">No leaders yet.</p>}
</AdminLayout>
```
`journey.astro` (columns Year/Title/Order, `listJourney`, active="journey") and `home-cards.astro` (columns Title/Link/Order, `listHomeCards`, active="home-cards") follow the same shape.

- [ ] **Step 5: new/edit pages** — `src/pages/admin/leaders/new.astro` (mirrors `funds/new.astro`, renders `<LeaderForm />`) and `leaders/[id].astro` (loads `getLeaderById`, redirect to `/admin/leaders` if missing, renders `<LeaderForm leader={leader} />`). Repeat for journey (`getJourneyById`, `JourneyForm`) and home-cards (`getHomeCardById`, `HomeCardForm`).

- [ ] **Step 6: AdminLayout nav** — after the `content` entry:
```astro
  { label: 'Leadership', href: '/admin/leaders', key: 'leaders' },
  { label: 'Journey', href: '/admin/journey', key: 'journey' },
  { label: 'Home Cards', href: '/admin/home-cards', key: 'home-cards' },
```

- [ ] **Step 7: Build → succeeds. Commit** `feat: admin editors (forms, list, new/edit) + nav for editable lists`.

---

## Task 7: render public pages from D1

**Files:** Modify `src/pages/about.astro`, `src/pages/index.astro`.

- [ ] **Step 1: `about.astro`** — replace the hardcoded `leaders`/`journey` arrays

Frontmatter: add `import { mediaUrl } from '../lib/media';`, `import { listLeaders } from '../lib/db/leaders';`, `import { listJourney } from '../lib/db/journey';`. Remove the hardcoded `const leaders = [...]` and `const journey = [...]`; replace with:
```ts
const leaders = await listLeaders(env.DB).catch(() => []);
const journey = await listJourney(env.DB).catch(() => []);
const leaderFallback = ['/images/about-3.jpg', '/images/about-4.jpg', '/images/about-5.jpg'];
const journeyFallback = ['/images/about-6.jpg', '/images/about-7.jpg', '/images/about-8.jpg'];
```
In the leaders map: `img={mediaUrl(l.image_key) ?? leaderFallback[i % leaderFallback.length]}` (use `l.name`/`l.role`); wrap the section so an empty list hides it: `{leaders.length > 0 && (<section ...>…</section>)}`.
In the journey map: use `p.year`/`p.title`/`p.body` (was `p.text`) and `mediaUrl(p.image_key) ?? journeyFallback[i % journeyFallback.length]`; hide the section when `journey.length === 0`.

- [ ] **Step 2: `index.astro`** — replace the hardcoded `introCards` array

Add `import { listHomeCards } from '../lib/db/homeCards';` and load alongside the others (extend the `Promise.all` or a separate call). Build the render list with a fallback to the current defaults when empty:
```ts
const dbCards = await listHomeCards(env.DB).catch(() => []);
const cardFallback = ['/images/visit-1.jpg', '/images/home-3.jpg', '/images/home-2.jpg'];
const defaultCards = [
  { eyebrow: 'New Here?', title: 'Plan a Visit', href: '/visit', description: 'Know what to expect and let us welcome you home.', image_key: null },
  { eyebrow: 'Messages', title: 'Watch Sermons', href: '/sermons', description: 'Catch up on recent messages, anytime, anywhere.', image_key: null },
  { eyebrow: 'Generosity', title: 'Give', href: '/giving', description: 'Partner with the mission and the ministries.', image_key: null },
];
const introCards = (dbCards.length ? dbCards : defaultCards).map((cd, i) => ({
  label: cd.eyebrow ?? '', title: cd.title, href: cd.href, desc: cd.description ?? '',
  img: mediaUrl((cd as { image_key?: string | null }).image_key ?? null) ?? cardFallback[i % cardFallback.length],
}));
```
> `mediaUrl` is already imported in `index.astro` (Phase A1). The existing intro-cards markup already reads `c.label/c.title/c.desc/c.href/c.img`, so no markup change is needed.

- [ ] **Step 3: Build → succeeds. Commit** `feat: render leadership, journey, and home cards from editable lists`.

---

## Task 8: full gate + dev verify

- [ ] **Step 1: Full suite** (`npx vitest run`) — prior 151 + new (~3) pass.
- [ ] **Step 2: Build.**
- [ ] **Step 3: Dev verify** (`npm run dev`):
```bash
# About shows the seeded leaders + journey
curl -s http://localhost:4321/about | grep -o 'Dr. Samuel A. Kharis' | head -1
curl -s http://localhost:4321/about | grep -o 'The First Cornerstone' | head -1
# Home shows the seeded cards
curl -s http://localhost:4321/ | grep -o 'Plan a Visit' | head -1
# admin editors render
for p in leaders journey home-cards; do echo "$p: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:4321/admin/$p)"; done
# create a leader via the gated route, confirm it appears
curl -s -o /dev/null -X POST http://localhost:4321/api/admin/leaders -H "Origin: http://localhost:4321" -F "_action=create" -F "name=Test Elder" -F "role=Deacon" -F "sort_order=9"
curl -s http://localhost:4321/about | grep -o 'Test Elder' | head -1
# cleanup
npx wrangler d1 execute kharisbuilders --local --command "DELETE FROM leaders WHERE name='Test Elder';"
```
Expected: seeded items render; admin pages 200; created leader appears.
- [ ] **Step 4: Clean tree.**

---

## Phase E2 Done — Definition of Done
- `leaders`/`journey`/`home_cards` tables seeded with current items; admin can create/edit/delete/reorder each + upload images.
- About leadership & timeline and home quick-link cards render from D1 with bundled-image fallbacks; emptying a list degrades gracefully.
- New media prefixes serve uploaded list images.
- `npx vitest run` + `npm run build` pass; dev round-trip verified.

**Next:** E3 — replaceable singleton page images (hero backgrounds, pastor portrait, Vision & Mission image, scripture/giving backgrounds) via R2, tied to content keys.

---

## Open Questions (resolved defaults)
- Empty home_cards → render the 3 code defaults; empty About lists → hide that section.
- Image prefixes `leaders/`,`journey/`,`home-cards/` added to the media allowlist.
- Hard delete; numeric `sort_order` reordering; orphan R2 sweep deferred (A1 stance).
