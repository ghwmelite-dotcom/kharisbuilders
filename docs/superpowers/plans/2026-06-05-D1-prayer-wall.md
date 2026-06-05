# D1: Prayer Wall Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A public `/prayer` wall (approved public requests + "I prayed" counter), a submit form with a public/private choice, and admin moderation — gated behind a new `community` feature flag.

**Architecture:** Reuse the existing `prayer_requests` table + `handlePrayer` pipeline. Add a `pray_count` column, public-safe data-access functions, a moderated public page, a pray-counter endpoint, an admin moderation page, and a `community` flag wired through config/nav/provisioner. Pure data/handler logic is unit-tested; pages/routes verified by build.

**Tech Stack:** Astro 6 SSR, Cloudflare D1 (wrangler migrations), Vitest + Miniflare, Cloudflare Turnstile. Spec: `docs/superpowers/specs/2026-06-05-D1-prayer-wall-design.md`.

**Working dir:** `C:\dev\Projects\KharisBuilders Project\stitch_kharisbuilders_church_web_design`.

> **Gotcha (locked in):** `PrayerInputSchema.is_private` is `z.coerce.boolean()` and `Boolean('false') === true`. So the public/private control must resolve to a real boolean in the handler — never rely on a `value="false"` form field.

---

## File Structure

```
migrations/0020_prayer_pray_count.sql      # CREATE (Task 1)
src/lib/db/prayer-requests.ts              # MODIFY — public-safe queries + moderation (Task 2)
tests/db/prayer-requests.test.ts           # CREATE (Task 2)
src/lib/live/prayer-handler.ts             # MODIFY — opts.page + visibility→is_private (Task 3)
tests/live/prayer-handler.test.ts          # CREATE (Task 3)
src/config/church.ts                       # MODIFY — community flag (Task 4)
tests/config/church.test.ts                # MODIFY — 7 features (Task 4)
scripts/lib/provision.mjs                  # MODIFY — community in FEATURE_KEYS + render (Task 4)
scripts/new-church.config.example.json     # MODIFY — community:true (Task 4)
tests/template/provision.test.ts           # MODIFY — fixture community:true (Task 4)
src/pages/api/forms/prayer.ts              # MODIFY — allowlist return_to (Task 5)
src/pages/api/prayer/pray.ts               # CREATE — pray counter endpoint (Task 5)
src/pages/prayer.astro                     # CREATE — the wall + submit form (Task 5)
src/components/Nav.astro                    # MODIFY — Prayer link gated by community (Task 5)
src/pages/api/admin/prayer.ts              # CREATE — approve/hide/delete (Task 6)
src/pages/admin/prayer.astro               # CREATE — moderation hub (Task 6)
src/layouts/AdminLayout.astro              # MODIFY — admin Prayer nav (Task 6)
```

---

## Task 1: Migration — `pray_count` column

**Files:** Create `migrations/0020_prayer_pray_count.sql`.

- [ ] **Step 1: Confirm clean tree + branch**

Run: `git status --short && git rev-parse --abbrev-ref HEAD`
Expected: empty, `main`. Then: `git checkout -b feat/D1-prayer-wall`

- [ ] **Step 2: Create the migration** `migrations/0020_prayer_pray_count.sql`

```sql
-- Prayer Wall: a per-request "I prayed" counter.
ALTER TABLE prayer_requests ADD COLUMN pray_count INTEGER NOT NULL DEFAULT 0;
```

- [ ] **Step 3: Apply to local D1**

Run: `npx wrangler d1 migrations apply kharisbuilders --local`
Expected: applies `0020` (or reports already-applied). No SQL error.

- [ ] **Step 4: Commit**

```bash
git add migrations/0020_prayer_pray_count.sql
git commit -m "feat(d1): prayer_requests.pray_count column (migration 0020)"
```

---

## Task 2: Data access — public queries + moderation

**Files:** Modify `src/lib/db/prayer-requests.ts`. Create `tests/db/prayer-requests.test.ts`.

- [ ] **Step 1: Write the failing test** `tests/db/prayer-requests.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import {
  createPrayerRequest,
  listPublicPrayers,
  incrementPrayCount,
  setPrayerStatus,
  deletePrayerRequest,
  listPrayerRequests,
} from '../../src/lib/db/prayer-requests';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
  // 1: public, will be approved | 2: public, stays new | 3: private | 4: public, hidden
  await createPrayerRequest(ctx.db, { name: 'Ada', email: 'a@x.com', request: 'Public one', is_private: false });
  await createPrayerRequest(ctx.db, { name: '', email: '', request: 'Awaiting', is_private: false });
  await createPrayerRequest(ctx.db, { name: 'Priv', email: 'p@x.com', request: 'Private one', is_private: true });
  await createPrayerRequest(ctx.db, { name: 'Hid', email: '', request: 'Hidden one', is_private: false });
  await setPrayerStatus(ctx.db, 1, 'approved');
  await setPrayerStatus(ctx.db, 4, 'hidden');
});
afterAll(async () => { await ctx.dispose(); });

describe('listPublicPrayers', () => {
  it('returns only approved public rows, without email', async () => {
    const rows = await listPublicPrayers(ctx.db);
    expect(rows.map((r) => r.request)).toEqual(['Public one']);
    expect(rows[0]).not.toHaveProperty('email');
    expect(rows[0].pray_count).toBe(0);
  });
});

describe('incrementPrayCount', () => {
  it('bumps an approved-public row and returns the new count', async () => {
    expect(await incrementPrayCount(ctx.db, 1)).toBe(1);
    expect(await incrementPrayCount(ctx.db, 1)).toBe(2);
  });
  it('is a no-op (returns 0) for private or unapproved rows', async () => {
    expect(await incrementPrayCount(ctx.db, 2)).toBe(0); // new, not approved
    expect(await incrementPrayCount(ctx.db, 3)).toBe(0); // private
    expect(await incrementPrayCount(ctx.db, 999)).toBe(0); // missing
  });
});

describe('moderation', () => {
  it('setPrayerStatus + delete work; admin list includes pray_count', async () => {
    const all = await listPrayerRequests(ctx.db);
    expect(all.find((r) => r.id === 1)?.pray_count).toBe(2);
    await deletePrayerRequest(ctx.db, 2);
    expect((await listPrayerRequests(ctx.db)).some((r) => r.id === 2)).toBe(false);
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/db/prayer-requests.test.ts`
Expected: FAIL (functions not exported / `pray_count` missing).

- [ ] **Step 3: Rewrite `src/lib/db/prayer-requests.ts`**

```ts
import type { PrayerInput } from './schemas';

export interface PrayerRequest {
  id: number;
  name: string | null;
  email: string | null;
  request: string;
  is_private: number;
  status: string;
  pray_count: number;
  created_at: string;
}

/** Public-safe shape — no email, no status. */
export interface PublicPrayer {
  id: number;
  name: string | null;
  request: string;
  pray_count: number;
  created_at: string;
}

export type PrayerStatus = 'new' | 'approved' | 'hidden';

export async function createPrayerRequest(db: D1Database, input: PrayerInput): Promise<void> {
  await db
    .prepare('INSERT INTO prayer_requests (name, email, request, is_private) VALUES (?, ?, ?, ?)')
    .bind(input.name || null, input.email || null, input.request, input.is_private ? 1 : 0)
    .run();
}

/** Admin: every request, newest first. */
export async function listPrayerRequests(db: D1Database, limit = 100): Promise<PrayerRequest[]> {
  const { results } = await db
    .prepare(
      'SELECT id, name, email, request, is_private, status, pray_count, created_at FROM prayer_requests ORDER BY id DESC LIMIT ?',
    )
    .bind(limit)
    .all<PrayerRequest>();
  return results;
}

/** Public wall: approved + public only, no email. */
export async function listPublicPrayers(db: D1Database, limit = 60): Promise<PublicPrayer[]> {
  const { results } = await db
    .prepare(
      "SELECT id, name, request, pray_count, created_at FROM prayer_requests WHERE is_private = 0 AND status = 'approved' ORDER BY created_at DESC, id DESC LIMIT ?",
    )
    .bind(limit)
    .all<PublicPrayer>();
  return results;
}

/** Increment a wall request's counter. Only affects approved-public rows. Returns the new count (0 if ineligible). */
export async function incrementPrayCount(db: D1Database, id: number): Promise<number> {
  await db
    .prepare(
      "UPDATE prayer_requests SET pray_count = pray_count + 1 WHERE id = ? AND is_private = 0 AND status = 'approved'",
    )
    .bind(id)
    .run();
  const row = await db
    .prepare("SELECT pray_count FROM prayer_requests WHERE id = ? AND is_private = 0 AND status = 'approved'")
    .bind(id)
    .first<{ pray_count: number }>();
  return row?.pray_count ?? 0;
}

export async function setPrayerStatus(db: D1Database, id: number, status: PrayerStatus): Promise<void> {
  await db.prepare('UPDATE prayer_requests SET status = ? WHERE id = ?').bind(status, id).run();
}

export async function deletePrayerRequest(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM prayer_requests WHERE id = ?').bind(id).run();
}
```

- [ ] **Step 4: Run → pass**

Run: `npx vitest run tests/db/prayer-requests.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/prayer-requests.ts tests/db/prayer-requests.test.ts
git commit -m "feat(d1): public-safe prayer queries + moderation (listPublicPrayers, incrementPrayCount, setPrayerStatus, delete)"
```

---

## Task 3: Handler — redirect page + visibility→is_private

**Files:** Modify `src/lib/live/prayer-handler.ts`. Create `tests/live/prayer-handler.test.ts`.

- [ ] **Step 1: Write the failing test** `tests/live/prayer-handler.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { handlePrayer } from '../../src/lib/live/prayer-handler';
import { listPrayerRequests } from '../../src/lib/db/prayer-requests';

// Turnstile siteverify is called via global fetch in verifyTurnstile; stub it.
let ctx: TestDb;
beforeAll(async () => { ctx = await createTestDb(); });
afterAll(async () => { await ctx.dispose(); });

function form(f: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(f)) fd.append(k, v);
  return fd;
}
const okFetch = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
const env = () => ({ DB: ctx.db, TURNSTILE_SECRET_KEY: 'x' }) as any;

describe('handlePrayer', () => {
  it('redirects to the given page on success and stores the request', async () => {
    vi.stubGlobal('fetch', okFetch);
    const r = await handlePrayer(env(), form({ request: 'Pray please', visibility: 'public', 'cf-turnstile-response': 't' }), '1.1.1.1', { page: '/prayer' });
    expect(r).toEqual({ status: 303, redirect: '/prayer?prayer=ok' });
    const all = await listPrayerRequests(ctx.db);
    expect(all[0].request).toBe('Pray please');
    expect(all[0].is_private).toBe(0); // visibility=public -> NOT private (despite z.coerce gotcha)
    vi.unstubAllGlobals();
  });
  it('treats anything other than visibility=public as private; defaults page to /live', async () => {
    vi.stubGlobal('fetch', okFetch);
    const r = await handlePrayer(env(), form({ request: 'Quiet one', visibility: 'private', 'cf-turnstile-response': 't' }), undefined);
    expect(r.redirect).toBe('/live?prayer=ok');
    expect((await listPrayerRequests(ctx.db))[0].is_private).toBe(1);
    vi.unstubAllGlobals();
  });
  it('redirects to <page>?prayer=err on invalid input', async () => {
    const r = await handlePrayer(env(), form({ request: '', 'cf-turnstile-response': 't' }), undefined, { page: '/prayer' });
    expect(r.redirect).toBe('/prayer?prayer=err');
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/live/prayer-handler.test.ts`
Expected: FAIL (opts param not supported; visibility not handled).

- [ ] **Step 3: Rewrite `src/lib/live/prayer-handler.ts`**

```ts
import { PrayerInputSchema } from '../db/schemas';
import { createPrayerRequest } from '../db/prayer-requests';
import { verifyTurnstile } from '../turnstile';
import { notifyStaff, type NotifyEnv } from '../notify';

export type PrayerEnv = NotifyEnv & { DB: D1Database; TURNSTILE_SECRET_KEY?: string };
export interface FormResult {
  status: number;
  redirect?: string;
}

/** Resolve is_private as a real boolean (avoids the z.coerce.boolean('false')===true trap). */
function resolveIsPrivate(form: FormData): boolean {
  const vis = form.get('visibility');
  if (vis != null) return String(vis) !== 'public';
  const ip = form.get('is_private');
  if (ip != null) return String(ip) !== 'false';
  return true;
}

/** Pure prayer-request pipeline: validate -> Turnstile -> insert -> best-effort notify. */
export async function handlePrayer(
  env: PrayerEnv,
  form: FormData,
  ip?: string,
  opts: { page?: string } = {},
): Promise<FormResult> {
  const page = opts.page ?? '/live';
  const parsed = PrayerInputSchema.safeParse({
    name: form.get('name') ?? '',
    email: form.get('email') ?? '',
    request: form.get('request'),
    is_private: resolveIsPrivate(form),
  });
  if (!parsed.success) return { status: 303, redirect: `${page}?prayer=err` };

  const ok = await verifyTurnstile(env.TURNSTILE_SECRET_KEY ?? '', String(form.get('cf-turnstile-response') ?? ''), ip);
  if (!ok) return { status: 303, redirect: `${page}?prayer=err` };

  await createPrayerRequest(env.DB, parsed.data);
  await notifyStaff(env, 'New prayer request', `${parsed.data.name || 'Someone'} requested prayer: ${parsed.data.request}`);
  return { status: 303, redirect: `${page}?prayer=ok` };
}
```

- [ ] **Step 4: Run → pass**

Run: `npx vitest run tests/live/prayer-handler.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/live/prayer-handler.ts tests/live/prayer-handler.test.ts
git commit -m "feat: handlePrayer accepts redirect page + resolves is_private from visibility"
```

---

## Task 4: The `community` feature flag

**Files:** Modify `src/config/church.ts`, `tests/config/church.test.ts`, `scripts/lib/provision.mjs`, `scripts/new-church.config.example.json`, `tests/template/provision.test.ts`.

- [ ] **Step 1: Add `community` to `src/config/church.ts`** — in the `ChurchFeatures` interface and the `CHURCH.features` literal:

In `interface ChurchFeatures { ... }` add after `live: boolean;`:
```ts
  community: boolean;
```
In `CHURCH.features = { ... }` change the line to:
```ts
  features: { sermons: true, events: true, ministries: true, giving: true, ai: true, live: true, community: true },
```

- [ ] **Step 2: Update `tests/config/church.test.ts`** — the feature assertions:

Replace the `it('has identity ... 6 features', ...)` title with `7 features`, and update the keys array:
```ts
    expect(Object.keys(CHURCH.features).sort()).toEqual(['ai', 'community', 'events', 'giving', 'live', 'ministries', 'sermons']);
```

- [ ] **Step 3: Update `scripts/lib/provision.mjs`** — two spots:

`const FEATURE_KEYS = [...]` → add `'community'`:
```js
const FEATURE_KEYS = ['sermons', 'events', 'ministries', 'giving', 'ai', 'live', 'community'];
```
In `renderChurchConfigTs`, the features line:
```js
  features: { sermons: ${ft.sermons}, events: ${ft.events}, ministries: ${ft.ministries}, giving: ${ft.giving}, ai: ${ft.ai}, live: ${ft.live}, community: ${ft.community} },
```

- [ ] **Step 4: Update `scripts/new-church.config.example.json`** — the `features` object:
```json
  "features": { "sermons": true, "events": true, "ministries": true, "giving": true, "ai": true, "live": true, "community": true }
```

- [ ] **Step 5: Update `tests/template/provision.test.ts`** — the `valid` fixture `features` line:
```ts
  features: { sermons: true, events: true, ministries: true, giving: true, ai: true, live: true, community: true },
```

- [ ] **Step 6: Run the affected suites**

Run: `npx vitest run tests/config/ tests/template/provision.test.ts`
Expected: PASS (config integrity now expects 7 features; provision fixture validates).

- [ ] **Step 7: Commit**

```bash
git add src/config/church.ts tests/config/church.test.ts scripts/lib/provision.mjs scripts/new-church.config.example.json tests/template/provision.test.ts
git commit -m "feat: add 'community' feature flag (config + provisioner + tests)"
```

---

## Task 5: Public `/prayer` wall + endpoints + nav

**Files:** Create `src/pages/prayer.astro`, `src/pages/api/prayer/pray.ts`; Modify `src/pages/api/forms/prayer.ts`, `src/components/Nav.astro`.

- [ ] **Step 1: Update `src/pages/api/forms/prayer.ts`** — allowlist `return_to`:

```ts
import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { handlePrayer } from '../../../lib/live/prayer-handler';

const PAGES = new Set(['/live', '/prayer']);

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const ip = request.headers.get('cf-connecting-ip') ?? undefined;
  const rt = String(form.get('return_to') ?? '/live');
  const page = PAGES.has(rt) ? rt : '/live';
  const r = await handlePrayer(env, form, ip, { page });
  return new Response(null, { status: r.status, headers: { Location: r.redirect ?? page } });
};
```

- [ ] **Step 2: Create `src/pages/api/prayer/pray.ts`**

```ts
import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { feature } from '../../../config/church';
import { incrementPrayCount } from '../../../lib/db/prayer-requests';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  if (!feature('community')) return json({ error: 'Not found' }, 404);
  let data: { id?: unknown };
  try {
    data = (await request.json()) as typeof data;
  } catch {
    return json({ error: 'Invalid request' }, 400);
  }
  const id = Number(data.id);
  if (!Number.isInteger(id) || id <= 0) return json({ error: 'Invalid id' }, 400);
  const count = await incrementPrayCount(env.DB, id);
  return json({ count });
};
```

- [ ] **Step 3: Create `src/pages/prayer.astro`**

```astro
---
import PublicLayout from '../layouts/PublicLayout.astro';
import PageHero from '../components/PageHero.astro';
import { env } from '../lib/runtime';
import { getAllSettings } from '../lib/db/settings';
import { getAllContent } from '../lib/db/content';
import { makeImage } from '../lib/content/content';
import { listPublicPrayers, type PublicPrayer } from '../lib/db/prayer-requests';
import { SITE } from '../lib/seo';
import { feature } from '../config/church';

if (!feature('community')) return Astro.redirect('/');

let siteKey = '1x00000000000000000000AA';
let cimg = makeImage({});
let prayers: PublicPrayer[] = [];
try {
  const settings = await getAllSettings(env.DB);
  siteKey = settings.turnstile_site_key ?? siteKey;
  cimg = makeImage(await getAllContent(env.DB).catch(() => ({})));
  prayers = await listPublicPrayers(env.DB);
} catch {
  // DB unavailable in some envs — render an empty wall
}
const status = Astro.url.searchParams.get('prayer');
const fmt = (s: string) => s?.slice(0, 10) ?? '';
---
<PublicLayout title={`Prayer Wall | ${SITE.name}`} description={`Share a prayer request and pray for others at ${SITE.name}.`}>
  <PageHero image={cimg('pages.sermons_hero')} height="h-[300px] md:h-[380px]">
    <span class="font-label-sm uppercase tracking-[0.3em] text-heritage-gold mb-4 block hero-shadow">Community</span>
    <h1 class="font-display text-display-mobile md:text-display-lg text-white hero-shadow">Prayer Wall</h1>
    <p class="font-body text-body-lg text-white/85 max-w-2xl mx-auto mt-4 hero-shadow">Share what's on your heart, and pray for one another.</p>
  </PageHero>

  <section class="py-16 md:py-24 px-margin-mobile md:px-margin-desktop max-w-[var(--container-max)] mx-auto">
    {status === 'ok' && (
      <div class="max-w-2xl mx-auto mb-10 border-t-2 border-heritage-gold bg-surface-container-lowest p-5 text-center font-body text-body-md text-primary">
        Thank you — your request was received. Public requests appear once a member of our team has reviewed them.
      </div>
    )}
    {status === 'err' && (
      <div class="max-w-2xl mx-auto mb-10 border-t-2 border-accent-deep bg-surface-container-lowest p-5 text-center font-body text-body-md text-primary">
        Sorry — we couldn't submit that. Please check your request and try again.
      </div>
    )}

    <!-- Submit -->
    <div class="max-w-2xl mx-auto mb-16 bg-surface-container-lowest border-t-2 border-heritage-gold elev-2 p-8 md:p-10">
      <h2 class="font-display text-headline-md text-primary mb-2">Share a request</h2>
      <p class="font-body text-body-md text-stone-gray mb-6">Your email (optional) is kept private — only our prayer team sees it.</p>
      <form method="POST" action="/api/forms/prayer" class="space-y-5">
        <input type="hidden" name="return_to" value="/prayer" />
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input name="name" placeholder="Your name (optional)" class="border border-champagne bg-surface px-4 py-3 font-body text-body-md text-primary" />
          <input name="email" type="email" placeholder="Email (optional, private)" class="border border-champagne bg-surface px-4 py-3 font-body text-body-md text-primary" />
        </div>
        <textarea name="request" rows="4" required maxlength="2000" placeholder="How can we pray for you?" class="w-full border border-champagne bg-surface px-4 py-3 font-body text-body-md text-primary"></textarea>
        <fieldset class="space-y-2">
          <label class="flex items-center gap-3 font-body text-body-md text-primary">
            <input type="radio" name="visibility" value="private" checked /> Keep private — just for the prayer team
          </label>
          <label class="flex items-center gap-3 font-body text-body-md text-primary">
            <input type="radio" name="visibility" value="public" /> Share on the wall (after review)
          </label>
        </fieldset>
        <div class="cf-turnstile" data-sitekey={siteKey}></div>
        <button type="submit" class="bg-heritage-gold text-primary font-label-md uppercase tracking-widest px-8 py-3 hover:bg-secondary transition-all">Send request</button>
      </form>
    </div>

    <!-- Wall -->
    <h2 class="font-display text-headline-lg text-primary text-center mb-3">Prayers from our community</h2>
    <p class="text-center font-body text-body-md text-stone-gray mb-10">Requests are reviewed before they appear here.</p>
    {
      prayers.length === 0 ? (
        <p class="text-center font-body text-body-md text-stone-gray">No requests on the wall yet — be the first to share, or check back soon.</p>
      ) : (
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {prayers.map((p) => (
            <article class="bg-surface-container-lowest border border-champagne p-6 flex flex-col" data-prayer-card>
              <p class="font-body text-body-md text-primary leading-relaxed whitespace-pre-line flex-1">{p.request}</p>
              <div class="mt-5 pt-4 border-t border-champagne flex items-center justify-between">
                <span class="font-label-sm uppercase tracking-[0.18em] text-stone-gray">{p.name || 'Anonymous'} · {fmt(p.created_at)}</span>
                <button type="button" class="pray-btn inline-flex items-center gap-2 font-label-sm uppercase tracking-[0.14em] text-heritage-gold hover:text-primary transition-colors" data-id={p.id}>
                  <span aria-hidden="true">&#128591;</span> Prayed <span class="pray-count font-display">{p.pray_count}</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )
    }
  </section>

  <script is:inline src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
  <script is:inline>
    let prayed = [];
    try { prayed = JSON.parse(localStorage.getItem('prayed-ids') || '[]'); } catch (e) {}
    document.querySelectorAll('.pray-btn').forEach((btn) => {
      const id = Number(btn.getAttribute('data-id'));
      if (prayed.includes(id)) { btn.disabled = true; btn.style.opacity = '0.55'; }
      btn.addEventListener('click', async () => {
        if (btn.disabled) return;
        btn.disabled = true; btn.style.opacity = '0.55';
        const countEl = btn.querySelector('.pray-count');
        try {
          const res = await fetch('/api/prayer/pray', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) });
          const data = await res.json();
          if (typeof data.count === 'number') countEl.textContent = data.count;
          prayed.push(id);
          try { localStorage.setItem('prayed-ids', JSON.stringify(prayed)); } catch (e) {}
        } catch (e) { btn.disabled = false; btn.style.opacity = '1'; }
      });
    });
  </script>
</PublicLayout>
```

- [ ] **Step 4: Add the Prayer link to `src/components/Nav.astro`** — in `allLinks` (after Visit or before it), add:
```ts
  { label: 'Prayer', href: '/prayer' },
```
And in the `featureOf` map add:
```ts
  '/prayer': 'community',
```

- [ ] **Step 5: Build**

Run: `npx astro build`
Expected: `Complete!`.

- [ ] **Step 6: Commit**

```bash
git add src/pages/prayer.astro src/pages/api/prayer/pray.ts src/pages/api/forms/prayer.ts src/components/Nav.astro
git commit -m "feat: public /prayer wall (submit + moderated requests + 'I prayed' counter)"
```

---

## Task 6: Admin moderation

**Files:** Create `src/pages/admin/prayer.astro`, `src/pages/api/admin/prayer.ts`; Modify `src/layouts/AdminLayout.astro`.

- [ ] **Step 1: Create `src/pages/api/admin/prayer.ts`**

```ts
import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { requireAdmin } from '../../../lib/admin-auth';
import { setPrayerStatus, deletePrayerRequest } from '../../../lib/db/prayer-requests';

export const POST: APIRoute = async ({ request }) => {
  const auth = requireAdmin(request, env, import.meta.env.DEV);
  if ('response' in auth) return auth.response;
  const form = await request.formData();
  const id = Number(form.get('id'));
  const action = String(form.get('action') ?? '');
  if (Number.isInteger(id) && id > 0) {
    if (action === 'approve') await setPrayerStatus(env.DB, id, 'approved');
    else if (action === 'hide') await setPrayerStatus(env.DB, id, 'hidden');
    else if (action === 'delete') await deletePrayerRequest(env.DB, id);
  }
  return new Response(null, { status: 303, headers: { Location: '/admin/prayer' } });
};
```

- [ ] **Step 2: Create `src/pages/admin/prayer.astro`**

```astro
---
import AdminLayout from '../../layouts/AdminLayout.astro';
import { env } from '../../lib/runtime';
import { getAdminEmail } from '../../lib/admin-auth';
import { listPrayerRequests } from '../../lib/db/prayer-requests';
import { feature } from '../../config/church';

if (!feature('community')) return Astro.redirect('/');
const email = getAdminEmail(Astro.request, env, import.meta.env.DEV);
if (!email) return Astro.redirect('/admin/denied');

const prayers = await listPrayerRequests(env.DB).catch(() => []);
// Inline hex (the project's Tailwind @theme is custom; default palette utilities aren't guaranteed).
const statusStyle = (s: string) =>
  s === 'approved'
    ? 'background:#dcfce7;color:#166534'
    : s === 'hidden'
      ? 'background:#e7e5e4;color:#57534e'
      : 'background:#fef3c7;color:#92400e';
const visStyle = (priv: number) => (priv ? 'background:#ede9fe;color:#5b21b6' : 'background:#e0f2fe;color:#075985');
---
<AdminLayout title="Prayer" email={email} active="prayer">
  <h1 class="text-2xl font-semibold text-primary mb-2">Prayer requests</h1>
  <p class="text-on-surface-variant mb-6">Approve public requests to show them on the wall. Private requests are for the prayer team only.</p>
  {prayers.length === 0 ? (
    <p class="text-on-surface-variant">No prayer requests yet.</p>
  ) : (
    <div class="space-y-3">
      {prayers.map((p) => (
        <div class="border border-champagne rounded-lg p-4 bg-surface-container-lowest">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <p class="text-primary whitespace-pre-line">{p.request}</p>
              <p class="text-sm text-on-surface-variant mt-2">
                {p.name || 'Anonymous'}{p.email ? ` · ${p.email}` : ''} · {p.created_at?.slice(0, 16)}
              </p>
            </div>
            <div class="flex flex-col items-end gap-2 flex-none">
              <span class="text-xs px-2 py-0.5 rounded-full" style={visStyle(p.is_private)}>{p.is_private ? 'Private' : 'Public'}</span>
              <span class="text-xs px-2 py-0.5 rounded-full" style={statusStyle(p.status)}>{p.status}</span>
              <span class="text-xs text-on-surface-variant">{p.pray_count} prayed</span>
            </div>
          </div>
          <div class="flex gap-2 mt-3">
            {p.is_private === 0 && p.status !== 'approved' && (
              <form method="POST" action="/api/admin/prayer"><input type="hidden" name="id" value={p.id} /><input type="hidden" name="action" value="approve" /><button class="text-sm px-3 py-1.5 bg-primary text-on-primary rounded">Approve</button></form>
            )}
            {p.is_private === 0 && p.status === 'approved' && (
              <form method="POST" action="/api/admin/prayer"><input type="hidden" name="id" value={p.id} /><input type="hidden" name="action" value="hide" /><button class="text-sm px-3 py-1.5 border border-champagne rounded text-primary">Hide</button></form>
            )}
            <form method="POST" action="/api/admin/prayer" onsubmit="return confirm('Delete this request?')"><input type="hidden" name="id" value={p.id} /><input type="hidden" name="action" value="delete" /><button class="text-sm px-3 py-1.5 text-accent-deep">Delete</button></form>
          </div>
        </div>
      ))}
    </div>
  )}
</AdminLayout>
```

- [ ] **Step 3: Add admin nav entry in `src/layouts/AdminLayout.astro`** — in `allNav`, add before Settings:
```ts
  { label: 'Prayer', href: '/admin/prayer', key: 'prayer', gate: 'community' },
```

- [ ] **Step 4: Build**

Run: `npx astro build`
Expected: `Complete!`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/prayer.astro src/pages/api/admin/prayer.ts src/layouts/AdminLayout.astro
git commit -m "feat: admin prayer moderation (approve/hide/delete) + nav"
```

---

## Task 7: Final gate

- [ ] **Step 1: Full suite**

Run: `npx vitest run`
Expected: PASS — prior 219 + new (db ~3, handler ~3) ≈ 225, all green. (Config/provision tests modified, not added.)

- [ ] **Step 2: Build**

Run: `npx astro build`
Expected: `Complete!`.

- [ ] **Step 3: Confirm clean tree**

Run: `git status --short`
Expected: empty.

---

## Task 8: Finish

- [ ] **Step 1:** Announce: "I'm using the finishing-a-development-branch skill to complete this work."
- [ ] **Step 2:** REQUIRED SUB-SKILL: superpowers:finishing-a-development-branch → merge `feat/D1-prayer-wall` → `main`.

> **Ship-to-Kharis follow-up (when deploying):** `git checkout kharis && git merge main`, then (config-structure change) add `community` to Kharis's `src/config/church.ts` (`ChurchFeatures` + `CHURCH.features`) and `kharis.config.json`; apply migration `0020` remote (`npx wrangler d1 migrations apply kharisbuilders --remote`); `npm run build && wrangler deploy`.

---

## Definition of Done
- `/prayer` renders when `feature('community')` (redirects when off); submit works (public → `status='new'` awaiting moderation; private → team-only); the wall shows only approved-public requests with a working "I prayed" counter; email never exposed publicly.
- Admin can approve/hide/delete; `community` flag wired through config + nav + provisioner + tests.
- Migration `0020` applied locally; `npx vitest run` green (~225); `npx astro build` passes.
- Merges to `main`. Kharis gets it via the follow-up above.

**Next:** D2 (Connect / Next-Steps), then D3–D5.
```
