# D2: Connect / Next-Steps Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development). Steps use checkbox (`- [ ]`) syntax.

**Goal:** A public `/connect` page where a visitor picks one or more next steps + leaves contact details, captured for staff follow-up, with admin review + CSV export.

**Architecture:** A dedicated `connections` table + a next-steps registry (single source of truth) + the standard `handleX` pipeline (zod → Turnstile → insert → notifyStaff). Reuses the existing `community` feature flag (no config-structure change). Pure logic unit-tested; pages/routes verified by build.

**Tech Stack:** Astro 6 SSR, Cloudflare D1 (wrangler migrations), Vitest + Miniflare, Turnstile. Spec: `docs/superpowers/specs/2026-06-05-D2-connect-next-steps-design.md`.

**Working dir:** `C:\dev\Projects\KharisBuilders Project\stitch_kharisbuilders_church_web_design`.

---

## File Structure

```
migrations/0021_connections.sql        # CREATE (Task 1)
src/lib/connect/steps.ts               # CREATE — next-steps registry (Task 2)
tests/connect/steps.test.ts            # CREATE (Task 2)
src/lib/db/schemas.ts                  # MODIFY — ConnectInputSchema (Task 3)
src/lib/db/connections.ts              # CREATE — data access (Task 3)
tests/db/connections.test.ts           # CREATE (Task 3)
src/lib/connect/connect-handler.ts     # CREATE — pipeline (Task 4)
tests/connect/connect-handler.test.ts  # CREATE (Task 4)
src/pages/api/forms/connect.ts         # CREATE — form route (Task 5)
src/pages/connect.astro                # CREATE — the card (Task 5)
src/pages/index.astro                  # MODIFY — home CTA band (Task 5)
src/components/Footer.astro            # MODIFY — Next Steps footer link (Task 5)
src/pages/api/admin/connect.ts         # CREATE — status/delete (Task 6)
src/pages/admin/connect.astro          # CREATE — review hub (Task 6)
src/pages/admin/connect.csv.ts         # CREATE — CSV export (Task 6)
src/layouts/AdminLayout.astro          # MODIFY — admin Connect nav (Task 6)
```

---

## Task 1: Migration — `connections` table

**Files:** Create `migrations/0021_connections.sql`.

- [ ] **Step 1: Confirm clean tree + branch**

Run: `git status --short && git rev-parse --abbrev-ref HEAD`
Expected: empty, `main`. Then: `git checkout -b feat/D2-connect`

- [ ] **Step 2: Create `migrations/0021_connections.sql`**

```sql
-- Connect / Next-Steps cards: people choosing a next step, for staff follow-up.
CREATE TABLE IF NOT EXISTS connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  steps TEXT NOT NULL DEFAULT '[]',
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- [ ] **Step 3: Apply locally**

Run: `npx wrangler d1 migrations apply church-template --local`
Expected: applies `0021`. No error.

- [ ] **Step 4: Commit**

```bash
git add migrations/0021_connections.sql
git commit -m "feat(d1): connections table (migration 0021)"
```

---

## Task 2: Next-steps registry

**Files:** Create `src/lib/connect/steps.ts`, `tests/connect/steps.test.ts`.

- [ ] **Step 1: Write the failing test** `tests/connect/steps.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { NEXT_STEPS, STEP_KEYS, stepLabel } from '../../src/lib/connect/steps';

describe('next-steps registry', () => {
  it('has unique keys and labels', () => {
    expect(STEP_KEYS.length).toBe(NEXT_STEPS.length);
    expect(new Set(STEP_KEYS).size).toBe(STEP_KEYS.length);
    for (const s of NEXT_STEPS) expect(s.label.length).toBeGreaterThan(0);
    expect(STEP_KEYS).toContain('decision');
    expect(STEP_KEYS).toContain('serve');
  });
  it('stepLabel returns the label, or the key when unknown', () => {
    expect(stepLabel('serve')).toBe('I want to serve / volunteer');
    expect(stepLabel('zzz')).toBe('zzz');
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/connect/steps.test.ts`
Expected: FAIL (cannot import).

- [ ] **Step 3: Create `src/lib/connect/steps.ts`**

```ts
export interface NextStep {
  key: string;
  label: string;
}

/** The canonical "next step" options shown on the connect card. One source of truth. */
export const NEXT_STEPS: NextStep[] = [
  { key: 'new', label: "I'm new here" },
  { key: 'decision', label: 'I made a decision to follow Jesus' },
  { key: 'rededicate', label: 'I recommitted my life' },
  { key: 'baptism', label: "I'd like to be baptized" },
  { key: 'membership', label: 'I want to become a member' },
  { key: 'group', label: "I'd like to join a group" },
  { key: 'serve', label: 'I want to serve / volunteer' },
  { key: 'prayer', label: 'I'd like prayer or a call from a pastor' },
];

export const STEP_KEYS: string[] = NEXT_STEPS.map((s) => s.key);

export function stepLabel(key: string): string {
  return NEXT_STEPS.find((s) => s.key === key)?.label ?? key;
}
```

- [ ] **Step 4: Run → pass**

Run: `npx vitest run tests/connect/steps.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/connect/steps.ts tests/connect/steps.test.ts
git commit -m "feat: next-steps registry (single source of truth)"
```

---

## Task 3: Schema + data access

**Files:** Modify `src/lib/db/schemas.ts`; Create `src/lib/db/connections.ts`, `tests/db/connections.test.ts`.

- [ ] **Step 1: Add `ConnectInputSchema` to the end of `src/lib/db/schemas.ts`**

```ts

export const ConnectInputSchema = z.object({
  name: z.string().trim().min(1, 'Please add your name').max(120),
  email: z.string().trim().email('Please add a valid email').max(200),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  steps: z.array(z.string()).default([]),
  message: z.string().trim().max(2000).optional().or(z.literal('')),
});
export type ConnectInput = z.infer<typeof ConnectInputSchema>;
```

- [ ] **Step 2: Write the failing test** `tests/db/connections.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import {
  createConnection,
  listConnections,
  setConnectionStatus,
  deleteConnection,
} from '../../src/lib/db/connections';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
  await createConnection(ctx.db, { name: 'Ada', email: 'a@x.com', phone: '', steps: ['serve', 'group'], message: '' });
  await createConnection(ctx.db, { name: 'Ben', email: 'b@x.com', phone: '123', steps: [], message: 'Just saying hi' });
});
afterAll(async () => {
  await ctx.dispose();
});

describe('connections', () => {
  it('stores steps as JSON and reads them back as an array, newest first', async () => {
    const rows = await listConnections(ctx.db);
    expect(rows.map((r) => r.name)).toEqual(['Ben', 'Ada']);
    expect(rows[1].steps).toEqual(['serve', 'group']);
    expect(rows[0].steps).toEqual([]);
    expect(rows[0].message).toBe('Just saying hi');
    expect(rows[0].status).toBe('new');
  });
  it('setConnectionStatus + deleteConnection work', async () => {
    await setConnectionStatus(ctx.db, 1, 'done');
    expect((await listConnections(ctx.db)).find((r) => r.id === 1)?.status).toBe('done');
    await deleteConnection(ctx.db, 2);
    expect((await listConnections(ctx.db)).some((r) => r.id === 2)).toBe(false);
  });
});
```

- [ ] **Step 3: Run → fail**

Run: `npx vitest run tests/db/connections.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 4: Create `src/lib/db/connections.ts`**

```ts
import type { ConnectInput } from './schemas';

export type ConnectionStatus = 'new' | 'in_progress' | 'done';

export interface Connection {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  steps: string[];
  message: string | null;
  status: string;
  created_at: string;
}

interface ConnectionRow {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  steps: string;
  message: string | null;
  status: string;
  created_at: string;
}

function parseSteps(s: string): string[] {
  try {
    const a = JSON.parse(s);
    return Array.isArray(a) ? a.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function createConnection(db: D1Database, input: ConnectInput): Promise<void> {
  await db
    .prepare('INSERT INTO connections (name, email, phone, steps, message) VALUES (?, ?, ?, ?, ?)')
    .bind(input.name, input.email, input.phone || null, JSON.stringify(input.steps ?? []), input.message || null)
    .run();
}

export async function listConnections(db: D1Database, limit = 200): Promise<Connection[]> {
  const { results } = await db
    .prepare(
      'SELECT id, name, email, phone, steps, message, status, created_at FROM connections ORDER BY id DESC LIMIT ?',
    )
    .bind(limit)
    .all<ConnectionRow>();
  return results.map((r) => ({ ...r, steps: parseSteps(r.steps) }));
}

export async function setConnectionStatus(db: D1Database, id: number, status: ConnectionStatus): Promise<void> {
  await db.prepare('UPDATE connections SET status = ? WHERE id = ?').bind(status, id).run();
}

export async function deleteConnection(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM connections WHERE id = ?').bind(id).run();
}
```

- [ ] **Step 5: Run → pass**

Run: `npx vitest run tests/db/connections.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/schemas.ts src/lib/db/connections.ts tests/db/connections.test.ts
git commit -m "feat(d1): connections data access + ConnectInputSchema"
```

---

## Task 4: Handler

**Files:** Create `src/lib/connect/connect-handler.ts`, `tests/connect/connect-handler.test.ts`.

- [ ] **Step 1: Write the failing test** `tests/connect/connect-handler.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { handleConnect } from '../../src/lib/connect/connect-handler';
import { listConnections } from '../../src/lib/db/connections';

let ctx: TestDb;
beforeAll(async () => { ctx = await createTestDb(); });
afterAll(async () => { await ctx.dispose(); });

function form(fields: Record<string, string>, steps: string[] = []): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  for (const s of steps) fd.append('steps', s);
  return fd;
}
const okFetch = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
const env = () => ({ DB: ctx.db, TURNSTILE_SECRET_KEY: 'x' }) as unknown as Parameters<typeof handleConnect>[0];

describe('handleConnect', () => {
  it('stores a connection with the chosen steps and redirects ok', async () => {
    vi.stubGlobal('fetch', okFetch);
    const r = await handleConnect(env(), form({ name: 'Ada', email: 'a@x.com', 'cf-turnstile-response': 't' }, ['serve', 'group']), '1.1.1.1');
    expect(r).toEqual({ status: 303, redirect: '/connect?connect=ok' });
    const rows = await listConnections(ctx.db);
    expect(rows[0].steps).toEqual(['serve', 'group']);
    vi.unstubAllGlobals();
  });
  it('drops unknown step keys', async () => {
    vi.stubGlobal('fetch', okFetch);
    await handleConnect(env(), form({ name: 'Bo', email: 'b@x.com', 'cf-turnstile-response': 't' }, ['serve', 'hacker']), undefined);
    expect((await listConnections(ctx.db))[0].steps).toEqual(['serve']);
    vi.unstubAllGlobals();
  });
  it('rejects an empty submission (no steps, no message) without storing', async () => {
    const before = (await listConnections(ctx.db)).length;
    const r = await handleConnect(env(), form({ name: 'Cy', email: 'c@x.com', 'cf-turnstile-response': 't' }, []), undefined);
    expect(r.redirect).toBe('/connect?connect=err');
    expect((await listConnections(ctx.db)).length).toBe(before);
  });
  it('accepts a message-only submission', async () => {
    vi.stubGlobal('fetch', okFetch);
    const r = await handleConnect(env(), form({ name: 'Di', email: 'd@x.com', message: 'Hello!', 'cf-turnstile-response': 't' }, []), undefined);
    expect(r.redirect).toBe('/connect?connect=ok');
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/connect/connect-handler.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Create `src/lib/connect/connect-handler.ts`**

```ts
import { ConnectInputSchema } from '../db/schemas';
import { createConnection } from '../db/connections';
import { STEP_KEYS, stepLabel } from './steps';
import { verifyTurnstile } from '../turnstile';
import { notifyStaff, type NotifyEnv } from '../notify';

export type ConnectEnv = NotifyEnv & { DB: D1Database; TURNSTILE_SECRET_KEY?: string };
export interface FormResult {
  status: number;
  redirect?: string;
}

/** Pure connect-card pipeline: validate -> Turnstile -> insert -> best-effort notify. */
export async function handleConnect(env: ConnectEnv, form: FormData, ip?: string): Promise<FormResult> {
  const steps = form.getAll('steps').map(String).filter((k) => STEP_KEYS.includes(k));
  const parsed = ConnectInputSchema.safeParse({
    name: form.get('name'),
    email: form.get('email'),
    phone: form.get('phone') ?? '',
    steps,
    message: form.get('message') ?? '',
  });
  if (!parsed.success) return { status: 303, redirect: '/connect?connect=err' };
  if (parsed.data.steps.length === 0 && !parsed.data.message) return { status: 303, redirect: '/connect?connect=err' };

  const ok = await verifyTurnstile(env.TURNSTILE_SECRET_KEY ?? '', String(form.get('cf-turnstile-response') ?? ''), ip);
  if (!ok) return { status: 303, redirect: '/connect?connect=err' };

  await createConnection(env.DB, parsed.data);
  const labels = parsed.data.steps.map(stepLabel).join(', ');
  await notifyStaff(env, 'New connect card', `${parsed.data.name} (${parsed.data.email}) — ${labels || 'message only'}`);
  return { status: 303, redirect: '/connect?connect=ok' };
}
```

- [ ] **Step 4: Run → pass**

Run: `npx vitest run tests/connect/connect-handler.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/connect/connect-handler.ts tests/connect/connect-handler.test.ts
git commit -m "feat: handleConnect pipeline (filter steps, require step-or-message)"
```

---

## Task 5: Public page + route + discovery

**Files:** Create `src/pages/api/forms/connect.ts`, `src/pages/connect.astro`; Modify `src/pages/index.astro`, `src/components/Footer.astro`.

- [ ] **Step 1: Create `src/pages/api/forms/connect.ts`**

```ts
import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { handleConnect } from '../../../lib/connect/connect-handler';

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const ip = request.headers.get('cf-connecting-ip') ?? undefined;
  const r = await handleConnect(env, form, ip);
  return new Response(null, { status: r.status, headers: { Location: r.redirect ?? '/connect' } });
};
```

- [ ] **Step 2: Create `src/pages/connect.astro`**

```astro
---
import PublicLayout from '../layouts/PublicLayout.astro';
import PageHero from '../components/PageHero.astro';
import { env } from '../lib/runtime';
import { getAllSettings } from '../lib/db/settings';
import { getAllContent } from '../lib/db/content';
import { makeImage } from '../lib/content/content';
import { NEXT_STEPS } from '../lib/connect/steps';
import { SITE } from '../lib/seo';
import { feature } from '../config/church';

if (!feature('community')) return Astro.redirect('/');

let siteKey = '1x00000000000000000000AA';
let cimg = makeImage({});
try {
  const settings = await getAllSettings(env.DB);
  siteKey = settings.turnstile_site_key ?? siteKey;
  cimg = makeImage(await getAllContent(env.DB).catch(() => ({})));
} catch {
  // settings/content unavailable in some envs — keep defaults
}
const status = Astro.url.searchParams.get('connect');
---
<PublicLayout title={`Next Steps | ${SITE.name}`} description={`Take your next step at ${SITE.name} — we'd love to help.`}>
  <PageHero image={cimg('pages.events_hero')} height="h-[300px] md:h-[380px]">
    <span class="font-label-sm uppercase tracking-[0.3em] text-heritage-gold mb-4 block hero-shadow">Next Steps</span>
    <h1 class="font-display text-display-mobile md:text-display-lg text-white hero-shadow">Take Your Next Step</h1>
    <p class="font-body text-body-lg text-white/85 max-w-2xl mx-auto mt-4 hero-shadow">Tell us where you are — we'll help you take the next step.</p>
  </PageHero>

  <section class="py-16 md:py-24 px-margin-mobile md:px-margin-desktop max-w-2xl mx-auto">
    {status === 'ok' && (
      <div class="mb-10 border-t-2 border-heritage-gold bg-surface-container-lowest p-5 text-center font-body text-body-md text-primary">
        Thank you — we've received this and someone from our team will be in touch.
      </div>
    )}
    {status === 'err' && (
      <div class="mb-10 border-t-2 border-accent-deep bg-surface-container-lowest p-5 text-center font-body text-body-md text-primary">
        Please choose at least one step or leave a message, and check your details.
      </div>
    )}

    <div class="bg-surface-container-lowest border-t-2 border-heritage-gold elev-2 p-8 md:p-10">
      <form method="POST" action="/api/forms/connect" class="space-y-6">
        <div>
          <p class="font-label-sm uppercase tracking-widest text-heritage-gold mb-3">I'd like to…</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {NEXT_STEPS.map((s) => (
              <label class="flex items-start gap-3 border border-champagne p-3 cursor-pointer hover:border-heritage-gold transition-colors font-body text-body-md text-primary">
                <input type="checkbox" name="steps" value={s.key} class="mt-1" /> {s.label}
              </label>
            ))}
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input name="name" required maxlength="120" placeholder="Your name" class="border border-champagne bg-surface px-4 py-3 font-body text-body-md text-primary" />
          <input name="email" type="email" required maxlength="200" placeholder="Email" class="border border-champagne bg-surface px-4 py-3 font-body text-body-md text-primary" />
        </div>
        <input name="phone" maxlength="40" placeholder="Phone (optional)" class="w-full border border-champagne bg-surface px-4 py-3 font-body text-body-md text-primary" />
        <textarea name="message" rows="3" maxlength="2000" placeholder="Anything you'd like to add? (optional)" class="w-full border border-champagne bg-surface px-4 py-3 font-body text-body-md text-primary"></textarea>
        <div class="cf-turnstile" data-sitekey={siteKey}></div>
        <button type="submit" class="bg-heritage-gold text-primary font-label-md uppercase tracking-widest px-8 py-3 hover:bg-secondary transition-all">Send</button>
      </form>
    </div>
  </section>
  <script is:inline src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
</PublicLayout>
```

- [ ] **Step 3: Add the home CTA band to `src/pages/index.astro`** — insert immediately before the closing `</PublicLayout>` tag (a gated "Next Steps" band above the footer):

```astro
  {
    feature('community') && (
      <section class="py-20 md:py-28 px-margin-mobile md:px-margin-desktop bg-primary-container text-on-primary">
        <div class="max-w-3xl mx-auto text-center">
          <span class="font-label-sm uppercase tracking-[0.3em] text-heritage-gold mb-4 block">Next Steps</span>
          <h2 class="font-display text-headline-lg md:text-display-mobile text-white mb-5">Not sure where to start?</h2>
          <p class="font-body text-body-lg text-white/80 max-w-xl mx-auto mb-9">Whether you're new, exploring faith, or ready to go deeper — tell us, and we'll help you take your next step.</p>
          <a href="/connect" class="inline-block bg-heritage-gold text-primary font-label-md uppercase tracking-widest px-10 py-4 hover:bg-secondary transition-colors">Take your next step</a>
        </div>
      </section>
    )
  }
```
(`index.astro` already imports `feature` from `../config/church`.)

- [ ] **Step 4: Add the footer link in `src/components/Footer.astro`** — change the import line `import { CHURCH } from '../config/church';` to `import { CHURCH, feature } from '../config/church';`, then change the `explore` array to insert a gated Next Steps link before Visit:

```ts
const explore = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Ministries', href: '/ministries' },
  { label: 'Sermons', href: '/sermons' },
  { label: 'Events', href: '/events' },
  ...(feature('community') ? [{ label: 'Next Steps', href: '/connect' }] : []),
  { label: 'Visit', href: '/visit' },
];
```

- [ ] **Step 5: Build**

Run: `npx astro build`
Expected: `Complete!`.

- [ ] **Step 6: Commit**

```bash
git add src/pages/connect.astro src/pages/api/forms/connect.ts src/pages/index.astro src/components/Footer.astro
git commit -m "feat: /connect next-steps card + home CTA + footer link"
```

---

## Task 6: Admin review + CSV

**Files:** Create `src/pages/api/admin/connect.ts`, `src/pages/admin/connect.astro`, `src/pages/admin/connect.csv.ts`; Modify `src/layouts/AdminLayout.astro`.

- [ ] **Step 1: Create `src/pages/api/admin/connect.ts`**

```ts
import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { requireAdmin } from '../../../lib/admin-auth';
import { setConnectionStatus, deleteConnection, type ConnectionStatus } from '../../../lib/db/connections';

const STATUSES = new Set<ConnectionStatus>(['new', 'in_progress', 'done']);

export const POST: APIRoute = async ({ request }) => {
  const auth = requireAdmin(request, env, import.meta.env.DEV);
  if ('response' in auth) return auth.response;
  const form = await request.formData();
  const id = Number(form.get('id'));
  const action = String(form.get('action') ?? '');
  if (Number.isInteger(id) && id > 0) {
    if (action === 'delete') await deleteConnection(env.DB, id);
    else if (action === 'status') {
      const value = String(form.get('value') ?? '') as ConnectionStatus;
      if (STATUSES.has(value)) await setConnectionStatus(env.DB, id, value);
    }
  }
  return new Response(null, { status: 303, headers: { Location: '/admin/connect' } });
};
```

- [ ] **Step 2: Create `src/pages/admin/connect.csv.ts`**

```ts
import type { APIRoute } from 'astro';
import { env } from '../../lib/runtime';
import { getAdminEmail } from '../../lib/admin-auth';
import { listConnections } from '../../lib/db/connections';

function csvCell(v: string | number | null): string {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const GET: APIRoute = async ({ request }) => {
  const email = getAdminEmail(request, env, import.meta.env.DEV);
  if (!email) return new Response('Forbidden', { status: 403 });
  const rows = await listConnections(env.DB, 10000).catch(() => []);
  const header = ['created_at', 'name', 'email', 'phone', 'steps', 'message', 'status'];
  const lines = [header.join(',')];
  for (const c of rows) {
    lines.push([c.created_at, c.name, c.email, c.phone ?? '', c.steps.join('; '), c.message ?? '', c.status].map(csvCell).join(','));
  }
  return new Response(lines.join('\n'), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="connections.csv"',
    },
  });
};
```

- [ ] **Step 3: Create `src/pages/admin/connect.astro`**

```astro
---
import AdminLayout from '../../layouts/AdminLayout.astro';
import { env } from '../../lib/runtime';
import { getAdminEmail } from '../../lib/admin-auth';
import { listConnections } from '../../lib/db/connections';
import { stepLabel } from '../../lib/connect/steps';
import { feature } from '../../config/church';

if (!feature('community')) return Astro.redirect('/');
const email = getAdminEmail(Astro.request, env, import.meta.env.DEV);
if (!email) return Astro.redirect('/admin/denied');

const rows = await listConnections(env.DB).catch(() => []);
const statusStyle = (s: string) =>
  s === 'done' ? 'background:#dcfce7;color:#166534' : s === 'in_progress' ? 'background:#dbeafe;color:#1e40af' : 'background:#fef3c7;color:#92400e';
---
<AdminLayout title="Connect" email={email} active="connect">
  <div class="flex items-center justify-between mb-2">
    <h1 class="text-2xl font-semibold text-primary">Connect / Next Steps</h1>
    <a href="/admin/connect.csv" class="text-sm px-3 py-1.5 border border-champagne rounded text-primary">Export CSV</a>
  </div>
  <p class="text-on-surface-variant mb-6">People who shared a next step. Mark each as you follow up.</p>
  {rows.length === 0 ? (
    <p class="text-on-surface-variant">No connect cards yet.</p>
  ) : (
    <div class="space-y-3">
      {rows.map((c) => (
        <div class="border border-champagne rounded-lg p-4 bg-surface-container-lowest">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <p class="text-primary font-medium">{c.name} · <span class="font-normal text-on-surface-variant">{c.email}{c.phone ? ` · ${c.phone}` : ''}</span></p>
              {c.steps.length > 0 && (
                <div class="flex flex-wrap gap-1.5 mt-2">
                  {c.steps.map((k) => (<span class="text-xs px-2 py-0.5 rounded-full border border-champagne text-primary">{stepLabel(k)}</span>))}
                </div>
              )}
              {c.message && <p class="text-sm text-on-surface-variant mt-2 whitespace-pre-line">{c.message}</p>}
              <p class="text-xs text-on-surface-variant mt-2">{c.created_at?.slice(0, 16)}</p>
            </div>
            <span class="text-xs px-2 py-0.5 rounded-full flex-none" style={statusStyle(c.status)}>{c.status.replace('_', ' ')}</span>
          </div>
          <div class="flex gap-2 mt-3">
            {c.status !== 'in_progress' && (<form method="POST" action="/api/admin/connect"><input type="hidden" name="id" value={c.id} /><input type="hidden" name="action" value="status" /><input type="hidden" name="value" value="in_progress" /><button class="text-sm px-3 py-1.5 border border-champagne rounded text-primary">In progress</button></form>)}
            {c.status !== 'done' && (<form method="POST" action="/api/admin/connect"><input type="hidden" name="id" value={c.id} /><input type="hidden" name="action" value="status" /><input type="hidden" name="value" value="done" /><button class="text-sm px-3 py-1.5 bg-primary text-on-primary rounded">Done</button></form>)}
            {c.status !== 'new' && (<form method="POST" action="/api/admin/connect"><input type="hidden" name="id" value={c.id} /><input type="hidden" name="action" value="status" /><input type="hidden" name="value" value="new" /><button class="text-sm px-3 py-1.5 border border-champagne rounded text-primary">Reopen</button></form>)}
            <form method="POST" action="/api/admin/connect" onsubmit="return confirm('Delete this card?')"><input type="hidden" name="id" value={c.id} /><input type="hidden" name="action" value="delete" /><button class="text-sm px-3 py-1.5 text-accent-deep">Delete</button></form>
          </div>
        </div>
      ))}
    </div>
  )}
</AdminLayout>
```

- [ ] **Step 4: Add admin nav entry in `src/layouts/AdminLayout.astro`** — after the Prayer entry, add:
```ts
  { label: 'Connect', href: '/admin/connect', key: 'connect', gate: 'community' },
```

- [ ] **Step 5: Build**

Run: `npx astro build`
Expected: `Complete!`.

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin/connect.astro src/pages/api/admin/connect.ts src/pages/admin/connect.csv.ts src/layouts/AdminLayout.astro
git commit -m "feat: admin connect review + CSV export + nav"
```

---

## Task 7: Final gate

- [ ] **Step 1: Full suite**

Run: `npx vitest run`
Expected: PASS — prior 226 + new (steps 2, connections 2, handler 4) = 234, all green.

- [ ] **Step 2: Build**

Run: `npx astro build`
Expected: `Complete!`.

- [ ] **Step 3: Clean tree**

Run: `git status --short`
Expected: empty.

---

## Task 8: Finish

- [ ] **Step 1:** Announce: "I'm using the finishing-a-development-branch skill to complete this work."
- [ ] **Step 2:** REQUIRED SUB-SKILL: superpowers:finishing-a-development-branch → merge `feat/D2-connect` → `main`.

> **Ship-to-Kharis follow-up:** `git checkout kharis && git merge main` (no config-structure change — `community` already on `kharis`); apply migration `0021` remote (`npx wrangler d1 migrations apply kharisbuilders --remote`); `npm run build && CLOUDFLARE_ACCOUNT_ID=233d917842862e30ed5207cf7b95bc33 npx wrangler deploy`; verify `/connect` 200.

---

## Definition of Done
- `/connect` renders when `feature('community')` (redirects when off); a submission with at least one step or a message is captured + notifies staff; empty submissions are rejected.
- Home CTA + footer "Next Steps" appear only when `community` is on.
- Admin can review, change status (new/in_progress/done), delete, and export CSV.
- Migration `0021` applied locally; `npx vitest run` green (~234); `npx astro build` passes.
- Merges to `main`; ships to Kharis via the follow-up above.

**Next:** D3 (small-group finder), then D4–D5.
```
