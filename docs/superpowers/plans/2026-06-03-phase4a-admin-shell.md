# Phase 4A: Admin Shell, Auth & Read-Only Views — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the staff admin behind an auth gate — an admin layout, a Cloudflare-Access-based identity helper (with a dev bypass), a Dashboard with live counts, and read-only list views for sermons, events, ministries, and people (visitors). Mutations (create/edit/delete, settings, uploads) come in Phase 4B.

**Architecture:** Cloudflare Access protects `/admin/*` + `/api/admin/*` in production; the worker reads the authenticated email from the `Cf-Access-Authenticated-User-Email` request header. A pure `src/lib/admin-auth.ts` resolves the admin email (header in prod; `DEV_ADMIN_EMAIL` env in local dev) and is unit-tested by passing fake `Request`/env. Every admin page calls it and redirects to a `/admin/denied` notice when no identity is present (defense-in-depth; Access is the real gate). Admin-only D1 reads (counts, and list-ALL including unpublished) live in `src/lib/db/admin.ts` — separate from the public `published = 1` queries — and are Miniflare-tested. Admin pages use a new `AdminLayout` (sidebar chrome), not the public layout.

**Tech Stack:** Astro 6 SSR, Cloudflare Access (prod gate), Cloudflare D1, Vitest + Miniflare harness.

**Working directory:** `C:\dev\Projects\KharisBuilders Project\stitch_kharisbuilders_church_web_design` (git repo, branch off `main`).

> **Binding rule (Astro 6):** admin pages/routes read `env` from `src/lib/runtime.ts`; data-access + auth helpers take params and are tested without `cloudflare:workers`. Use only DEFINED theme tokens. Reference admin mockups: `admin_dashboard_kharisbuilders/code.html`, `manage_sermons_admin_portal/code.html`, `manage_events_admin_portal/code.html`, `people_visitors_admin_portal/code.html`.

> **Cloudflare Access setup (USER action, before live deploy — not needed for dev):** In the Cloudflare dashboard → Zero Trust → Access → Applications → Add a self-hosted application covering the admin path (the site's domain `/admin*` and `/api/admin*`), identity = Google or one-time-PIN email, policy = allow specific staff emails. Until then, local dev uses `DEV_ADMIN_EMAIL` in `.dev.vars`.

---

## File Structure (created/modified)

```
src/lib/admin-auth.ts                 # getAdminEmail(request, env) / requireAdmin
src/lib/db/admin.ts                   # getCounts, listAllSermons, listAllEvents, listAllMinistries, listVisitors
src/layouts/AdminLayout.astro         # admin chrome (sidebar + signed-in email)
src/pages/admin/index.astro           # Dashboard (counts)
src/pages/admin/denied.astro          # no-identity notice
src/pages/admin/sermons.astro         # read-only list (incl. unpublished)
src/pages/admin/events.astro
src/pages/admin/ministries.astro
src/pages/admin/people.astro          # visitors list
.dev.vars.example                     # MODIFY: add DEV_ADMIN_EMAIL
tests/admin-auth.test.ts
tests/db/admin.test.ts
```

---

## Task 1: Admin identity helper (TDD)

**Files:**
- Create: `src/lib/admin-auth.ts`, `tests/admin-auth.test.ts`
- Modify: `.dev.vars.example`

- [ ] **Step 1: Write the failing test**

Create `tests/admin-auth.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { getAdminEmail } from '../src/lib/admin-auth';

function req(headers: Record<string, string> = {}) {
  return new Request('https://x/admin', { headers });
}

describe('getAdminEmail', () => {
  it('returns the Cloudflare Access email header when present', () => {
    const r = req({ 'cf-access-authenticated-user-email': 'pastor@church.org' });
    expect(getAdminEmail(r, {})).toBe('pastor@church.org');
  });

  it('falls back to DEV_ADMIN_EMAIL when no header (local dev)', () => {
    expect(getAdminEmail(req(), { DEV_ADMIN_EMAIL: 'dev@local' })).toBe('dev@local');
  });

  it('returns null when neither is present', () => {
    expect(getAdminEmail(req(), {})).toBeNull();
  });

  it('prefers the Access header over the dev fallback', () => {
    const r = req({ 'cf-access-authenticated-user-email': 'real@church.org' });
    expect(getAdminEmail(r, { DEV_ADMIN_EMAIL: 'dev@local' })).toBe('real@church.org');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run tests/admin-auth.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/admin-auth.ts`**

```ts
export interface AdminAuthEnv {
  DEV_ADMIN_EMAIL?: string;
}

/**
 * Resolve the signed-in admin's email. In production, Cloudflare Access sets the
 * `Cf-Access-Authenticated-User-Email` header (and is the real gate). In local dev
 * there is no Access, so fall back to `DEV_ADMIN_EMAIL`. Returns null when neither
 * is present — callers must treat that as "not authenticated".
 */
export function getAdminEmail(request: Request, env: AdminAuthEnv): string | null {
  const headerEmail = request.headers.get('cf-access-authenticated-user-email');
  if (headerEmail) return headerEmail;
  if (env.DEV_ADMIN_EMAIL) return env.DEV_ADMIN_EMAIL;
  return null;
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
npx vitest run tests/admin-auth.test.ts
```
Expected: PASS (4 tests).

- [ ] **Step 5: Add `DEV_ADMIN_EMAIL` to `.dev.vars.example` and your local `.dev.vars`**

Append to both:
```
# Local admin identity (dev only — production uses Cloudflare Access)
DEV_ADMIN_EMAIL=dev@kharisbuilders.local
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/admin-auth.ts tests/admin-auth.test.ts .dev.vars.example
git commit -m "feat: admin identity helper (Cloudflare Access header + dev fallback) with tests"
```

---

## Task 2: Admin D1 reads (TDD)

**Files:**
- Create: `src/lib/db/admin.ts`, `tests/db/admin.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/db/admin.test.ts`:
```ts
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { getCounts, listAllSermons, listAllEvents } from '../../src/lib/db/admin';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
  await ctx.db.batch([
    ctx.db.prepare("INSERT INTO sermons (title, slug, video_url, published) VALUES ('Pub', 'pub', 'u', 1)"),
    ctx.db.prepare("INSERT INTO sermons (title, slug, video_url, published) VALUES ('Draft', 'draft', 'u', 0)"),
    ctx.db.prepare("INSERT INTO events (title, slug, start_at, published) VALUES ('Up', 'up', '2999-01-01 10:00:00', 1)"),
    ctx.db.prepare("INSERT INTO visitors (name, email) VALUES ('V', 'v@x.org')"),
  ]);
});
afterAll(async () => { await ctx.dispose(); });

describe('admin reads', () => {
  it('counts include unpublished rows', async () => {
    const c = await getCounts(ctx.db);
    expect(c.sermons).toBe(2);
    expect(c.events).toBe(1);
    expect(c.visitors).toBe(1);
  });

  it('listAllSermons returns published AND unpublished, newest first', async () => {
    const list = await listAllSermons(ctx.db);
    expect(list.length).toBe(2);
    expect(list.map((s) => s.slug).sort()).toEqual(['draft', 'pub']);
  });

  it('listAllEvents returns events regardless of date', async () => {
    expect((await listAllEvents(ctx.db)).length).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run tests/db/admin.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/db/admin.ts`**

```ts
export interface AdminCounts {
  sermons: number;
  events: number;
  ministries: number;
  visitors: number;
  registrations: number;
}

export async function getCounts(db: D1Database): Promise<AdminCounts> {
  const row = await db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM sermons) AS sermons,
        (SELECT COUNT(*) FROM events) AS events,
        (SELECT COUNT(*) FROM ministries) AS ministries,
        (SELECT COUNT(*) FROM visitors) AS visitors,
        (SELECT COUNT(*) FROM event_registrations) AS registrations`,
    )
    .first<AdminCounts>();
  return (
    row ?? { sermons: 0, events: 0, ministries: 0, visitors: 0, registrations: 0 }
  );
}

export interface AdminSermonRow {
  id: number;
  title: string;
  slug: string;
  speaker: string | null;
  sermon_date: string | null;
  published: number;
}
export async function listAllSermons(db: D1Database): Promise<AdminSermonRow[]> {
  const { results } = await db
    .prepare('SELECT id, title, slug, speaker, sermon_date, published FROM sermons ORDER BY sermon_date DESC, id DESC')
    .all<AdminSermonRow>();
  return results;
}

export interface AdminEventRow {
  id: number;
  title: string;
  slug: string;
  category: string | null;
  start_at: string;
  registration_enabled: number;
  published: number;
}
export async function listAllEvents(db: D1Database): Promise<AdminEventRow[]> {
  const { results } = await db
    .prepare('SELECT id, title, slug, category, start_at, registration_enabled, published FROM events ORDER BY start_at DESC')
    .all<AdminEventRow>();
  return results;
}

export interface AdminMinistryRow {
  id: number;
  name: string;
  slug: string;
  sort_order: number;
  published: number;
}
export async function listAllMinistries(db: D1Database): Promise<AdminMinistryRow[]> {
  const { results } = await db
    .prepare('SELECT id, name, slug, sort_order, published FROM ministries ORDER BY sort_order ASC, name ASC')
    .all<AdminMinistryRow>();
  return results;
}

export interface AdminVisitorRow {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  visiting_service: string | null;
  status: string;
  created_at: string;
}
export async function listVisitors(db: D1Database): Promise<AdminVisitorRow[]> {
  const { results } = await db
    .prepare('SELECT id, name, email, phone, visiting_service, status, created_at FROM visitors ORDER BY created_at DESC, id DESC')
    .all<AdminVisitorRow>();
  return results;
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
npx vitest run tests/db/admin.test.ts
```
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/admin.ts tests/db/admin.test.ts
git commit -m "feat: admin D1 reads (counts + list-all incl. unpublished) with tests"
```

---

## Task 3: AdminLayout + denied page + gate helper

**Files:**
- Create: `src/layouts/AdminLayout.astro`, `src/pages/admin/denied.astro`

- [ ] **Step 1: Create `AdminLayout.astro`**

It reads the admin email and renders sidebar chrome. (Pages pass the resolved `email`; the layout just displays it.)
```astro
---
import '../styles/global.css';
interface Props { title: string; email: string; active?: string; }
const { title, email, active = '' } = Astro.props;
const nav = [
  { label: 'Dashboard', href: '/admin', key: 'dashboard' },
  { label: 'Sermons', href: '/admin/sermons', key: 'sermons' },
  { label: 'Events', href: '/admin/events', key: 'events' },
  { label: 'Ministries', href: '/admin/ministries', key: 'ministries' },
  { label: 'People', href: '/admin/people', key: 'people' },
];
---
<!doctype html>
<html lang="en" data-theme="sacred">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex" />
    <title>{title} · Admin</title>
  </head>
  <body class="min-h-screen md:grid md:grid-cols-[240px_1fr]">
    <aside class="bg-primary text-on-primary p-6 md:min-h-screen">
      <div class="font-[var(--font-display)] text-xl text-accent mb-8">Kharisbuilders</div>
      <nav class="flex flex-col gap-1">
        {nav.map((n) => (
          <a href={n.href}
             class={`px-3 py-2 rounded text-sm uppercase tracking-wider ${active === n.key ? 'bg-on-primary/10 text-on-primary' : 'text-on-primary/70 hover:text-on-primary'}`}>
            {n.label}
          </a>
        ))}
      </nav>
      <p class="text-on-primary/50 text-xs mt-8 break-words">{email}</p>
    </aside>
    <main class="p-6 md:p-12 bg-surface text-on-surface">
      <h1 class="font-[var(--font-display)] text-3xl text-primary mb-8">{title}</h1>
      <slot />
    </main>
  </body>
</html>
```

- [ ] **Step 2: Create `src/pages/admin/denied.astro`**

```astro
---
const email = null;
---
<!doctype html>
<html lang="en" data-theme="sacred">
  <head><meta charset="utf-8" /><title>Access required</title><meta name="robots" content="noindex" /></head>
  <body class="min-h-screen flex items-center justify-center bg-surface text-on-surface">
    <div class="text-center p-8">
      <h1 class="font-[var(--font-display)] text-2xl text-primary mb-2">Admin access required</h1>
      <p class="text-on-surface-variant text-sm">Sign in through Cloudflare Access, or set DEV_ADMIN_EMAIL for local development.</p>
    </div>
  </body>
</html>
```

- [ ] **Step 3: Build to verify both compile**

```bash
npm run build
```
Expected: succeeds (pages are unused until Task 4, but must compile).

- [ ] **Step 4: Commit**

```bash
git add src/layouts/AdminLayout.astro src/pages/admin/denied.astro
git commit -m "feat: admin layout and access-denied page"
```

---

## Task 4: Dashboard + read-only list pages

**Files:**
- Create: `src/pages/admin/index.astro`, `src/pages/admin/sermons.astro`, `src/pages/admin/events.astro`, `src/pages/admin/ministries.astro`, `src/pages/admin/people.astro`

> Each page follows the SAME guard pattern: resolve email; if null, redirect to `/admin/denied`; else render `AdminLayout` with data.

- [ ] **Step 1: Create `src/pages/admin/index.astro` (Dashboard)**

```astro
---
import AdminLayout from '../../layouts/AdminLayout.astro';
import { env } from '../../lib/runtime';
import { getAdminEmail } from '../../lib/admin-auth';
import { getCounts } from '../../lib/db/admin';

const email = getAdminEmail(Astro.request, env);
if (!email) return Astro.redirect('/admin/denied');
const counts = await getCounts(env.DB).catch(() => ({ sermons: 0, events: 0, ministries: 0, visitors: 0, registrations: 0 }));
const cards = [
  { label: 'Sermons', value: counts.sermons, href: '/admin/sermons' },
  { label: 'Events', value: counts.events, href: '/admin/events' },
  { label: 'Ministries', value: counts.ministries, href: '/admin/ministries' },
  { label: 'Visitors', value: counts.visitors, href: '/admin/people' },
  { label: 'Registrations', value: counts.registrations, href: '/admin/events' },
];
---
<AdminLayout title="Dashboard" email={email} active="dashboard">
  <div class="grid grid-cols-2 md:grid-cols-3 gap-6">
    {cards.map((c) => (
      <a href={c.href} class="bg-surface border border-champagne rounded-lg p-6 hover:-translate-y-0.5 transition-transform">
        <p class="text-on-surface-variant text-xs uppercase tracking-widest">{c.label}</p>
        <p class="font-[var(--font-display)] text-4xl text-primary mt-2">{c.value}</p>
      </a>
    ))}
  </div>
</AdminLayout>
```

- [ ] **Step 2: Create `src/pages/admin/sermons.astro`**

```astro
---
import AdminLayout from '../../layouts/AdminLayout.astro';
import { env } from '../../lib/runtime';
import { getAdminEmail } from '../../lib/admin-auth';
import { listAllSermons } from '../../lib/db/admin';

const email = getAdminEmail(Astro.request, env);
if (!email) return Astro.redirect('/admin/denied');
const sermons = await listAllSermons(env.DB).catch(() => []);
---
<AdminLayout title="Sermons" email={email} active="sermons">
  <table class="w-full text-sm">
    <thead><tr class="text-left text-on-surface-variant border-b border-champagne">
      <th class="py-2">Title</th><th>Speaker</th><th>Date</th><th>Status</th>
    </tr></thead>
    <tbody>
      {sermons.map((s) => (
        <tr class="border-b border-champagne/50">
          <td class="py-3 text-primary">{s.title}</td>
          <td>{s.speaker}</td>
          <td>{s.sermon_date}</td>
          <td>{s.published ? 'Published' : 'Draft'}</td>
        </tr>
      ))}
    </tbody>
  </table>
  {sermons.length === 0 && <p class="text-on-surface-variant mt-4">No sermons yet.</p>}
</AdminLayout>
```

- [ ] **Step 3: Create `src/pages/admin/events.astro`** (same pattern, columns Title/Category/Date/Registration/Status, using `listAllEvents`; show `registration_enabled ? 'Open' : '—'` and `published ? 'Published' : 'Draft'`).

```astro
---
import AdminLayout from '../../layouts/AdminLayout.astro';
import { env } from '../../lib/runtime';
import { getAdminEmail } from '../../lib/admin-auth';
import { listAllEvents } from '../../lib/db/admin';

const email = getAdminEmail(Astro.request, env);
if (!email) return Astro.redirect('/admin/denied');
const events = await listAllEvents(env.DB).catch(() => []);
---
<AdminLayout title="Events" email={email} active="events">
  <table class="w-full text-sm">
    <thead><tr class="text-left text-on-surface-variant border-b border-champagne">
      <th class="py-2">Title</th><th>Category</th><th>Starts</th><th>Registration</th><th>Status</th>
    </tr></thead>
    <tbody>
      {events.map((e) => (
        <tr class="border-b border-champagne/50">
          <td class="py-3 text-primary">{e.title}</td>
          <td>{e.category}</td>
          <td>{e.start_at?.slice(0, 16).replace('T', ' ')}</td>
          <td>{e.registration_enabled ? 'Open' : '—'}</td>
          <td>{e.published ? 'Published' : 'Draft'}</td>
        </tr>
      ))}
    </tbody>
  </table>
  {events.length === 0 && <p class="text-on-surface-variant mt-4">No events yet.</p>}
</AdminLayout>
```

- [ ] **Step 4: Create `src/pages/admin/ministries.astro`** (columns Name/Order/Status using `listAllMinistries`).

```astro
---
import AdminLayout from '../../layouts/AdminLayout.astro';
import { env } from '../../lib/runtime';
import { getAdminEmail } from '../../lib/admin-auth';
import { listAllMinistries } from '../../lib/db/admin';

const email = getAdminEmail(Astro.request, env);
if (!email) return Astro.redirect('/admin/denied');
const ministries = await listAllMinistries(env.DB).catch(() => []);
---
<AdminLayout title="Ministries" email={email} active="ministries">
  <table class="w-full text-sm">
    <thead><tr class="text-left text-on-surface-variant border-b border-champagne">
      <th class="py-2">Name</th><th>Order</th><th>Status</th>
    </tr></thead>
    <tbody>
      {ministries.map((m) => (
        <tr class="border-b border-champagne/50">
          <td class="py-3 text-primary">{m.name}</td>
          <td>{m.sort_order}</td>
          <td>{m.published ? 'Published' : 'Draft'}</td>
        </tr>
      ))}
    </tbody>
  </table>
  {ministries.length === 0 && <p class="text-on-surface-variant mt-4">No ministries yet.</p>}
</AdminLayout>
```

- [ ] **Step 5: Create `src/pages/admin/people.astro`** (visitors, columns Name/Email/Service/Status/When using `listVisitors`).

```astro
---
import AdminLayout from '../../layouts/AdminLayout.astro';
import { env } from '../../lib/runtime';
import { getAdminEmail } from '../../lib/admin-auth';
import { listVisitors } from '../../lib/db/admin';

const email = getAdminEmail(Astro.request, env);
if (!email) return Astro.redirect('/admin/denied');
const people = await listVisitors(env.DB).catch(() => []);
---
<AdminLayout title="People" email={email} active="people">
  <table class="w-full text-sm">
    <thead><tr class="text-left text-on-surface-variant border-b border-champagne">
      <th class="py-2">Name</th><th>Email</th><th>Service</th><th>Status</th><th>When</th>
    </tr></thead>
    <tbody>
      {people.map((p) => (
        <tr class="border-b border-champagne/50">
          <td class="py-3 text-primary">{p.name}</td>
          <td>{p.email}</td>
          <td>{p.visiting_service}</td>
          <td>{p.status}</td>
          <td>{p.created_at?.slice(0, 10)}</td>
        </tr>
      ))}
    </tbody>
  </table>
  {people.length === 0 && <p class="text-on-surface-variant mt-4">No visitors yet.</p>}
</AdminLayout>
```

- [ ] **Step 6: Build + verify the gate and the dashboard (dev, with DEV_ADMIN_EMAIL set)**

```bash
npm run build
# dev (DEV_ADMIN_EMAIL in .dev.vars):
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4321/admin          # 200 (dev email present)
curl -s http://localhost:4321/admin | grep -o "Dashboard"
curl -s http://localhost:4321/admin/people | grep -o "Email"
```
Expected: `/admin` returns 200 and shows Dashboard with counts; `/admin/people` lists the visitor table. (To confirm the gate, temporarily remove DEV_ADMIN_EMAIL from `.dev.vars`, restart dev, and confirm `/admin` 302-redirects to `/admin/denied`; then restore it.)

- [ ] **Step 7: Commit**

```bash
git add src/pages/admin/
git commit -m "feat: admin dashboard and read-only list views (sermons, events, ministries, people)"
```

---

## Task 5: Full gate + review

- [ ] **Step 1: Run the full suite**

```bash
npx vitest run
```
Expected: 31 (prior) + admin-auth (4) + admin db (3) = 38 passing.

- [ ] **Step 2: Build**

```bash
npm run build
```
Expected: succeeds.

- [ ] **Step 3: Smoke the admin (dev)**

`npm run dev`; confirm `/admin`, `/admin/sermons`, `/admin/events`, `/admin/ministries`, `/admin/people` all 200 and show their tables/counts; `/admin/denied` renders. Stop dev.

- [ ] **Step 4: Clean tree**

```bash
git status --short
```

---

## Phase 4A Done — Definition of Done
- `getAdminEmail` resolves Access header / dev fallback / null, unit-tested.
- Admin D1 reads (counts + list-all incl. unpublished) implemented and Miniflare-tested.
- `/admin` Dashboard shows live counts; read-only lists for sermons, events, ministries, people render; every admin page redirects to `/admin/denied` without an identity.
- `npx vitest run` (38 tests) and `npm run build` pass.

**Next:** Phase 4B — admin mutations: create/edit/delete + publish toggles for sermons/events/ministries, settings editor, view event registrations per event, and R2 image uploads (with `Cf-Access-Authenticated-User-Email` recorded as `updated_by`). Requires CSRF-safe admin POST routes (also gated) and the Cloudflare Access application live before production use.

---

## Open Questions (non-blocking)
- Full JWT verification of the `Cf-Access-Jwt-Assertion` (defense against direct-to-worker bypass of Access) — deferred to Phase 6 hardening; for now Access on the domain is the gate + header identity.
- Whether `/admin` should be excluded from the public sitemap/robots (added `noindex` meta; full robots.txt is Phase 6).
