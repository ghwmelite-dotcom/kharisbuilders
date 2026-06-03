# Phase 2B: Public Pages & Visit Form — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the four public pages (Home, About, Ministries, Visit) rendering real content from the Phase-2A D1 data layer, and wire the Visit "Plan Your Visit" form end-to-end: client → API endpoint → zod validation → Turnstile spam check → `createVisitor` → best-effort staff email notification.

**Architecture:** Astro SSR pages read D1 through `getBindings(Astro.locals)` (Phase 1) + the `src/lib/db/*` modules (Phase 2A). `PublicLayout` loads `site_settings` once and feeds the data-driven `Footer`. The visit form is a progressively-enhanced HTML POST to an Astro API route (`src/pages/api/forms/visit.ts`); the route validates with the existing `VisitorInputSchema`, verifies a Cloudflare Turnstile token server-side, inserts via `createVisitor`, then calls a best-effort `notifyStaff` (never blocks the user). Pure logic (Turnstile verify, the request handler, email payload) is unit-tested by mocking `fetch`; D1 paths reuse the Miniflare harness.

**Tech Stack:** Astro 6 SSR, Cloudflare D1 (Phase 2A modules), Cloudflare Turnstile, Zod (installed), Vitest + Miniflare harness.

**Working directory:** `C:\dev\Projects\KharisBuilders Project\stitch_kharisbuilders_church_web_design` (git repo, branch off `main`).

> **Reference (port markup/content, swap hardcoded values for D1 data):** `home_kharisbuilders/code.html`, `about_us_kharisbuilders/code.html`, `ministries_kharisbuilders/code.html`, `visit_us_kharisbuilders/code.html`. Use existing components (`Button`, `Card`, `Nav`, `Footer`, `Icon`) and theme utilities (`bg-primary`, `text-on-surface`, etc.) — NEVER raw hex or `var(--color-*)`.

> **Prereqs:** Turnstile keys. For dev, use Cloudflare's always-pass TEST keys — site key `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA`. Put the secret in `.dev.vars` as `TURNSTILE_SECRET_KEY` and the site key in `site_settings` (`turnstile_site_key`) or a public env. Real keys (from a Turnstile widget the church creates) go in prod via `wrangler secret put` + settings. Email: a real provider (Resend, etc.) is wired later; `notifyStaff` is best-effort and a no-op when unconfigured.

---

## File Structure (created/modified in this phase)

```
src/lib/turnstile.ts                   # verifyTurnstile(secret, token, ip?) -> boolean
src/lib/notify.ts                      # notifyStaff(env, subject, body) -> best-effort, never throws
src/components/MinistryCard.astro      # one ministry card
src/components/Field.astro             # ledger-style labeled input/select (visit form)
src/layouts/PublicLayout.astro         # MODIFY: load settings, pass to Footer
src/components/Footer.astro            # MODIFY: data-driven (service times, address, contact)
src/pages/index.astro                  # MODIFY: real Home (hero, welcome, service times, giving CTA)
src/pages/about.astro                  # About (static content ported)
src/pages/ministries.astro            # Ministries (lists published ministries from D1)
src/pages/visit.astro                  # Visit (service times + address from D1; the form + Turnstile)
src/pages/api/forms/visit.ts           # POST handler
tests/turnstile.test.ts                # verifyTurnstile (mock fetch)
tests/visit-handler.test.ts            # handler validation/turnstile/insert (mock fetch + Miniflare D1)
tests/notify.test.ts                   # notifyStaff guard/payload (mock fetch)
```

---

## Task 1: Data-driven Footer + settings in PublicLayout

**Files:**
- Modify: `src/layouts/PublicLayout.astro`, `src/components/Footer.astro`

- [ ] **Step 1: Load settings in `PublicLayout.astro` and pass to Footer**

In the frontmatter, after computing `theme`, load settings (guard so a DB miss never crashes the page):
```astro
import { getBindings } from '../lib/env';
import { getAllSettings, type SettingsMap } from '../lib/db/settings';

let settings: SettingsMap = {};
try {
  settings = await getAllSettings(getBindings(Astro.locals).DB);
} catch {
  settings = {};
}
```
Change the Footer usage to `<Footer settings={settings} />`.

- [ ] **Step 2: Make `Footer.astro` consume settings with fallbacks**

Replace the frontmatter and the dynamic bits:
```astro
---
import type { SettingsMap } from '../lib/db/settings';
interface Props { settings?: SettingsMap; }
const { settings = {} } = Astro.props;
const year = new Date().getFullYear();
const address = settings.address ?? '12 Cathedral Way, West End, London';
const email = settings.contact_email ?? 'hello@kharisbuilders.org';
let serviceTimes: Array<{ name: string; time: string; note?: string }> = [];
try {
  serviceTimes = settings.service_times ? JSON.parse(settings.service_times) : [];
} catch {
  serviceTimes = [];
}
---
```
In the "Service Times" footer column, render `serviceTimes` (fallback to a single static line if empty); in a contact area render `address` and `email`. Keep the existing theme utility classes.

- [ ] **Step 3: Build + verify the footer renders settings**

Run `npm run build`, then `npm run preview`; `curl -s http://localhost:4321/ | grep -o "Cathedral Way"` should match (seeded address). Stop preview.

- [ ] **Step 4: Commit**

```bash
git add src/layouts/PublicLayout.astro src/components/Footer.astro
git commit -m "feat: data-driven footer from site_settings"
```

---

## Task 2: Turnstile verification helper (TDD)

**Files:**
- Create: `src/lib/turnstile.ts`, `tests/turnstile.test.ts`

- [ ] **Step 1: Write the failing test (mock fetch)**

Create `tests/turnstile.test.ts`:
```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { verifyTurnstile } from '../src/lib/turnstile';

afterEach(() => vi.restoreAllMocks());

describe('verifyTurnstile', () => {
  it('returns true when siteverify succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: true }))));
    expect(await verifyTurnstile('secret', 'token')).toBe(true);
  });

  it('returns false when siteverify fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: false, 'error-codes': ['invalid-input-response'] }))));
    expect(await verifyTurnstile('secret', 'token')).toBe(false);
  });

  it('returns false when the token is empty (no network call)', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    expect(await verifyTurnstile('secret', '')).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  it('returns false when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network'); }));
    expect(await verifyTurnstile('secret', 'token')).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run tests/turnstile.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/turnstile.ts`**

```ts
const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstile(secret: string, token: string, ip?: string): Promise<boolean> {
  if (!token) return false;
  try {
    const body = new FormData();
    body.append('secret', secret);
    body.append('response', token);
    if (ip) body.append('remoteip', ip);
    const res = await fetch(SITEVERIFY_URL, { method: 'POST', body });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
npx vitest run tests/turnstile.test.ts
```
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/turnstile.ts tests/turnstile.test.ts
git commit -m "feat: Turnstile server-side verification helper with tests"
```

---

## Task 3: Best-effort staff notification (TDD)

**Files:**
- Create: `src/lib/notify.ts`, `tests/notify.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/notify.test.ts`:
```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { notifyStaff } from '../src/lib/notify';

afterEach(() => vi.restoreAllMocks());

describe('notifyStaff', () => {
  it('is a no-op (no fetch) when no provider is configured', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    await notifyStaff({} as App.Locals['runtime']['env'], 'subj', 'body');
    expect(f).not.toHaveBeenCalled();
  });

  it('posts to Resend when RESEND_API_KEY is set, and never throws on failure', async () => {
    const f = vi.fn(async () => { throw new Error('boom'); });
    vi.stubGlobal('fetch', f);
    const env = { RESEND_API_KEY: 'k', STAFF_EMAIL: 'staff@x.org', FROM_EMAIL: 'no-reply@x.org' } as unknown as App.Locals['runtime']['env'];
    await expect(notifyStaff(env, 'subj', 'body')).resolves.toBeUndefined();
    expect(f).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run tests/notify.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/notify.ts`**

```ts
type Env = App.Locals['runtime']['env'] & {
  RESEND_API_KEY?: string;
  STAFF_EMAIL?: string;
  FROM_EMAIL?: string;
};

/**
 * Best-effort staff email. No-ops when no provider is configured, and never
 * throws — a failed notification must never block a visitor submission.
 */
export async function notifyStaff(env: Env, subject: string, body: string): Promise<void> {
  const key = env.RESEND_API_KEY;
  const to = env.STAFF_EMAIL;
  const from = env.FROM_EMAIL ?? 'no-reply@kharisbuilders.org';
  if (!key || !to) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, text: body }),
    });
  } catch {
    // swallow — logged by the platform; submission already succeeded
  }
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
npx vitest run tests/notify.test.ts
```
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/notify.ts tests/notify.test.ts
git commit -m "feat: best-effort staff email notification with tests"
```

---

## Task 4: Visit form API endpoint (TDD)

**Files:**
- Create: `src/pages/api/forms/visit.ts`, `tests/visit-handler.test.ts`

> The handler logic is factored into a testable `handleVisit(env, formData, ip)` returning `{ status, redirect }`, so it can be tested without Astro. The Astro route is a thin wrapper.

- [ ] **Step 1: Write the failing test (Miniflare D1 + mock fetch for Turnstile)**

Create `tests/visit-handler.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll, vi, afterEach } from 'vitest';
import { createTestDb, type TestDb } from './helpers/d1';
import { handleVisit } from '../src/pages/api/forms/visit';

let ctx: TestDb;
beforeAll(async () => { ctx = await createTestDb(); });
afterAll(async () => { await ctx.dispose(); });
afterEach(() => vi.restoreAllMocks());

function env() {
  return { DB: ctx.db, TURNSTILE_SECRET_KEY: 'secret' } as unknown as App.Locals['runtime']['env'];
}
function fd(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

describe('handleVisit', () => {
  it('rejects invalid input with 400 (no DB write)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: true }))));
    const res = await handleVisit(env(), fd({ name: '', email: 'bad', 'cf-turnstile-response': 't' }));
    expect(res.status).toBe(400);
  });

  it('rejects when Turnstile fails with 400', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: false }))));
    const res = await handleVisit(env(), fd({ name: 'Jane', email: 'jane@x.org', 'cf-turnstile-response': 't' }));
    expect(res.status).toBe(400);
  });

  it('inserts and redirects on success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: true }))));
    const res = await handleVisit(env(), fd({ name: 'Jane', email: 'jane@x.org', visiting_service: 'Sunday 09:00 AM', 'cf-turnstile-response': 't' }));
    expect(res.status).toBe(303);
    expect(res.redirect).toBe('/visit?submitted=1');
    const row = await ctx.db.prepare("SELECT name FROM visitors WHERE email = 'jane@x.org'").first<{ name: string }>();
    expect(row?.name).toBe('Jane');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run tests/visit-handler.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/pages/api/forms/visit.ts`**

```ts
import type { APIRoute } from 'astro';
import { getBindings } from '../../../lib/env';
import { VisitorInputSchema } from '../../../lib/db/schemas';
import { createVisitor } from '../../../lib/db/visitors';
import { verifyTurnstile } from '../../../lib/turnstile';
import { notifyStaff } from '../../../lib/notify';

export interface VisitResult {
  status: number;
  redirect?: string;
}

type Env = App.Locals['runtime']['env'] & { TURNSTILE_SECRET_KEY?: string };

export async function handleVisit(env: Env, form: FormData, ip?: string): Promise<VisitResult> {
  const parsed = VisitorInputSchema.safeParse({
    name: form.get('name'),
    email: form.get('email'),
    phone: form.get('phone') ?? '',
    visiting_service: form.get('visiting_service') ?? '',
  });
  if (!parsed.success) return { status: 400 };

  const token = String(form.get('cf-turnstile-response') ?? '');
  const ok = await verifyTurnstile(env.TURNSTILE_SECRET_KEY ?? '', token, ip);
  if (!ok) return { status: 400 };

  await createVisitor(env.DB, parsed.data);
  await notifyStaff(
    env,
    'New visit planned',
    `${parsed.data.name} (${parsed.data.email}) is planning to visit: ${parsed.data.visiting_service || 'unspecified'}.`,
  );
  return { status: 303, redirect: '/visit?submitted=1' };
}

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  const env = getBindings(locals) as Env;
  const form = await request.formData();
  const result = await handleVisit(env, form, clientAddress);
  if (result.redirect) {
    return new Response(null, { status: result.status, headers: { Location: result.redirect } });
  }
  return new Response('Please check your details and try again.', { status: result.status });
};
```

- [ ] **Step 4: Run to verify it passes**

```bash
npx vitest run tests/visit-handler.test.ts
```
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/forms/visit.ts tests/visit-handler.test.ts
git commit -m "feat: visit form API handler (zod + Turnstile + createVisitor + notify) with tests"
```

---

## Task 5: MinistryCard + Ministries page

**Files:**
- Create: `src/components/MinistryCard.astro`, `src/pages/ministries.astro`

- [ ] **Step 1: Create `MinistryCard.astro`**

```astro
---
import type { Ministry } from '../lib/db/ministries';
interface Props { ministry: Ministry; }
const { ministry } = Astro.props;
---
<article class="bg-surface border border-champagne rounded-lg overflow-hidden flex flex-col">
  <div class="p-8 flex flex-col gap-3 grow">
    <h2 class="font-[var(--font-display)] text-2xl text-primary">{ministry.name}</h2>
    {ministry.meeting_time && (
      <p class="text-xs uppercase tracking-widest text-accent">{ministry.meeting_time}</p>
    )}
    <p class="text-on-surface-variant text-sm grow">{ministry.description}</p>
    {ministry.leader && (
      <p class="text-on-surface-variant text-sm">Led by <span class="text-primary">{ministry.leader}</span></p>
    )}
  </div>
</article>
```

- [ ] **Step 2: Create `src/pages/ministries.astro` (reads D1)**

```astro
---
import PublicLayout from '../layouts/PublicLayout.astro';
import MinistryCard from '../components/MinistryCard.astro';
import { getBindings } from '../lib/env';
import { listPublishedMinistries } from '../lib/db/ministries';

const ministries = await listPublishedMinistries(getBindings(Astro.locals).DB);
---
<PublicLayout title="Ministries | Kharisbuilders" description="Find your place in the body of Christ at Kharisbuilders.">
  <section class="mx-auto max-w-[var(--container-max)] px-6 md:px-16 py-20">
    <div class="text-center mb-16">
      <span class="text-xs uppercase tracking-[0.3em] text-accent">Our Community</span>
      <h1 class="font-[var(--font-display)] text-4xl md:text-5xl text-primary mt-3">Ministries</h1>
      <p class="text-on-surface-variant max-w-2xl mx-auto mt-4">
        Every individual has a unique calling and a part to play in building the Kingdom.
      </p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {ministries.map((m) => <MinistryCard ministry={m} />)}
    </div>
  </section>
</PublicLayout>
```

- [ ] **Step 3: Build + verify the seeded ministries render**

Run `npm run build`, `npm run preview`; `curl -s http://localhost:4321/ministries | grep -o "Worship & Arts"` should match. Stop preview.

- [ ] **Step 4: Commit**

```bash
git add src/components/MinistryCard.astro src/pages/ministries.astro
git commit -m "feat: ministries page rendering published ministries from D1"
```

---

## Task 6: About page (static content)

**Files:**
- Create: `src/pages/about.astro`

- [ ] **Step 1: Create `src/pages/about.astro`**

Port the content/structure from `about_us_kharisbuilders/code.html` (pastor's welcome, mission, story sections) into a `PublicLayout` page using existing components and theme utilities. Use placeholder `<div class="aspect-[4/3] bg-champagne">` blocks where the mockup used hosted images (real imagery comes with R2 uploads in a later phase). Skeleton:
```astro
---
import PublicLayout from '../layouts/PublicLayout.astro';
import Button from '../components/Button.astro';
---
<PublicLayout title="About Us | Kharisbuilders" description="Our story, mission, and the people building lives and shaping destinies.">
  <section class="mx-auto max-w-[var(--container-max)] px-6 md:px-16 py-20 space-y-24">
    <!-- Port: hero intro, mission, pastor's message, story. Use text-primary / text-on-surface-variant,
         font-[var(--font-display)] for headings, and <Button> for any CTAs. -->
  </section>
</PublicLayout>
```
Fill the section with the real copy from the mockup (mission, beliefs, leadership intro). Keep headings in Playfair via `font-[var(--font-display)]`.

- [ ] **Step 2: Build + verify**

Run `npm run build`; confirm `/about` builds. (Optional preview + curl for a known heading.)

- [ ] **Step 3: Commit**

```bash
git add src/pages/about.astro
git commit -m "feat: about page"
```

---

## Task 7: Home page (real content from settings)

**Files:**
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Replace the smoke page with the real Home**

Port the hero + "A Message from Our Pastor" welcome + service times + giving CTA from `home_kharisbuilders/code.html`. Read service times from settings. Skeleton:
```astro
---
import PublicLayout from '../layouts/PublicLayout.astro';
import Button from '../components/Button.astro';
import { getBindings } from '../lib/env';
import { getAllSettings } from '../lib/db/settings';

const settings = await getAllSettings(getBindings(Astro.locals).DB);
let serviceTimes: Array<{ name: string; time: string; note?: string }> = [];
try { serviceTimes = settings.service_times ? JSON.parse(settings.service_times) : []; } catch { serviceTimes = []; }
---
<PublicLayout title="Kharisbuilders | Building Lives, Shaping Destinies">
  <!-- Hero -->
  <section class="relative bg-primary text-on-primary">
    <div class="mx-auto max-w-[var(--container-max)] px-6 md:px-16 py-32 text-center">
      <h1 class="font-[var(--font-display)] text-4xl md:text-6xl mb-8">Building Lives, Shaping Destinies.</h1>
      <div class="flex flex-col md:flex-row gap-4 justify-center">
        <Button variant="primary" href="/visit">Join Us This Sunday</Button>
        <Button variant="secondary" href="/give">Give Online</Button>
      </div>
    </div>
  </section>
  <!-- Service Times (from settings) -->
  <section class="mx-auto max-w-[var(--container-max)] px-6 md:px-16 py-20">
    <h2 class="font-[var(--font-display)] text-3xl text-primary mb-8">Service Times</h2>
    <div class="divide-y divide-accent/20">
      {serviceTimes.map((s) => (
        <div class="flex justify-between items-center py-5">
          <div><p class="text-primary font-[var(--font-display)] text-xl">{s.name}</p>{s.note && <p class="text-on-surface-variant text-sm">{s.note}</p>}</div>
          <span class="text-accent font-[var(--font-display)] text-xl">{s.time}</span>
        </div>
      ))}
    </div>
  </section>
  <!-- Giving CTA -->
  <section class="bg-primary text-on-primary">
    <div class="mx-auto max-w-[var(--container-max)] px-6 md:px-16 py-20 text-center">
      <h2 class="font-[var(--font-display)] text-3xl mb-4">Invest in Destinies</h2>
      <p class="text-on-primary/80 mb-8 max-w-xl mx-auto">Your generosity fuels our mission to build lives and shape destinies.</p>
      <Button variant="secondary" href="/give">Give Online</Button>
    </div>
  </section>
</PublicLayout>
```
> Note: `/give` is a placeholder link until Phase 5 (Paystack). Sermon/event sections are intentionally omitted here — they arrive in Phase 3.

- [ ] **Step 2: Build + verify service times render**

Run `npm run build`, `npm run preview`; `curl -s http://localhost:4321/ | grep -o "Sunday Morning"` should match. Stop preview.

- [ ] **Step 3: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat: real home page with service times from settings"
```

---

## Task 8: Field component + Visit page with working form

**Files:**
- Create: `src/components/Field.astro`, `src/pages/visit.astro`

- [ ] **Step 1: Create `Field.astro` (ledger-style input/select)**

```astro
---
interface Props { label: string; name: string; type?: string; required?: boolean; options?: string[]; }
const { label, name, type = 'text', required = false, options } = Astro.props;
const id = `f-${name}`;
---
<div class="flex flex-col gap-1">
  <label for={id} class="text-xs uppercase tracking-wider text-on-surface-variant">{label}</label>
  {options ? (
    <select id={id} name={name} required={required}
      class="bg-transparent border-0 border-b border-on-surface-variant/30 focus:border-primary focus:ring-0 py-2 min-h-[44px]">
      {options.map((o) => <option value={o}>{o}</option>)}
    </select>
  ) : (
    <input id={id} name={name} type={type} required={required}
      class="bg-transparent border-0 border-b border-on-surface-variant/30 focus:border-primary focus:ring-0 py-2 min-h-[44px]" />
  )}
</div>
```

- [ ] **Step 2: Create `src/pages/visit.astro` (service times + address from D1; the form + Turnstile)**

```astro
---
import PublicLayout from '../layouts/PublicLayout.astro';
import Button from '../components/Button.astro';
import Field from '../components/Field.astro';
import { getBindings } from '../lib/env';
import { getAllSettings } from '../lib/db/settings';

const settings = await getAllSettings(getBindings(Astro.locals).DB);
const address = settings.address ?? '';
const siteKey = settings.turnstile_site_key ?? '1x00000000000000000000AA';
let serviceTimes: Array<{ name: string; time: string; note?: string }> = [];
try { serviceTimes = settings.service_times ? JSON.parse(settings.service_times) : []; } catch { serviceTimes = []; }
const submitted = Astro.url.searchParams.get('submitted') === '1';
const serviceOptions = serviceTimes.map((s) => `${s.name} ${s.time}`);
---
<PublicLayout title="Visit Us | Kharisbuilders" description="Plan your visit to Kharisbuilders.">
  <section class="mx-auto max-w-[var(--container-max)] px-6 md:px-16 py-20 grid md:grid-cols-2 gap-16">
    <div>
      <h1 class="font-[var(--font-display)] text-4xl text-primary mb-6">Plan Your Visit</h1>
      <p class="text-on-surface-variant mb-8">Let us know you're coming so we can have a welcome pack ready.</p>
      {address && <p class="text-on-surface-variant mb-2"><span class="text-primary">Address:</span> {address}</p>}
      <div class="divide-y divide-accent/20 mt-8">
        {serviceTimes.map((s) => (
          <div class="flex justify-between py-4"><span class="text-primary">{s.name}</span><span class="text-accent">{s.time}</span></div>
        ))}
      </div>
    </div>
    <div class="bg-surface border border-champagne rounded-lg p-8">
      {submitted ? (
        <p class="text-primary font-[var(--font-display)] text-2xl">Thank you — we'll see you soon!</p>
      ) : (
        <form method="POST" action="/api/forms/visit" class="flex flex-col gap-6">
          <Field label="Full Name" name="name" required />
          <Field label="Email Address" name="email" type="email" required />
          <Field label="Phone (optional)" name="phone" type="tel" />
          <Field label="I'm coming on..." name="visiting_service" options={serviceOptions} />
          <div class="cf-turnstile" data-sitekey={siteKey}></div>
          <Button type="submit" variant="primary">Confirm Attendance</Button>
        </form>
      )}
    </div>
  </section>
  <script is:inline src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
</PublicLayout>
```

- [ ] **Step 3: Add the dev Turnstile secret**

Append to `.dev.vars` (create from `.dev.vars.example` if missing):
```
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

- [ ] **Step 4: Build + verify the form + a live submission against local D1**

Run `npm run build`, then `npm run preview`. Verify:
```bash
curl -s http://localhost:4321/visit | grep -o "Plan Your Visit"
# Submit (dev Turnstile test secret always passes):
curl -s -i -X POST http://localhost:4321/api/forms/visit \
  --data "name=Test Visitor&email=test@example.com&visiting_service=Sunday Morning 09:00 AM&cf-turnstile-response=XXXX" | grep -i "location:"
```
Expected: the GET matches; the POST returns `Location: /visit?submitted=1`. Confirm the row landed:
```bash
npx wrangler d1 execute kharisbuilders --local --command "SELECT name,email FROM visitors WHERE email='test@example.com';"
```
Stop preview.

- [ ] **Step 5: Commit**

```bash
git add src/components/Field.astro src/pages/visit.astro .dev.vars.example
git commit -m "feat: visit page with working plan-your-visit form and Turnstile"
```

---

## Task 9: Full gate + review

- [ ] **Step 1: Run the full suite**

```bash
npx vitest run
```
Expected: all pass — Phase 1/2A tests (11) + turnstile (4) + notify (2) + visit-handler (3) = 20.

- [ ] **Step 2: Build**

```bash
npm run build
```
Expected: succeeds.

- [ ] **Step 3: Smoke the whole site in preview**

`npm run preview`; curl `/`, `/about`, `/ministries`, `/visit` and confirm each returns 200 with expected content (service times on `/`, "Worship & Arts" on `/ministries`, "Plan Your Visit" on `/visit`). Stop preview.

- [ ] **Step 4: Confirm clean tree**

```bash
git status --short
```
Expected: clean (`.dev.vars` is gitignored).

---

## Phase 2B Done — Definition of Done
- `/`, `/about`, `/ministries`, `/visit` render via SSR; Home service times, Footer (address/contact/service times), and Ministries list all come from D1.
- Visit form submits end-to-end: zod validation, Turnstile verification, `createVisitor`, best-effort `notifyStaff`; success redirect shows the thank-you state.
- `npx vitest run` (20 tests) and `npm run build` pass.

**Next:** Phase 3 (Sermons & Events) — public list/detail pages + their admin CRUD + event registration. Plus deploy this phase and (separately) connect real Turnstile + email provider keys.

---

## Open Questions (non-blocking)
- Email provider: Resend assumed in `notifyStaff`; swap if the church prefers another. Needs `RESEND_API_KEY`, `STAFF_EMAIL`, `FROM_EMAIL` (+ verified domain) before notifications send.
- Real Turnstile keys: church creates a Turnstile widget; prod secret via `wrangler secret put TURNSTILE_SECRET_KEY`, site key into `site_settings.turnstile_site_key`.
- About-page copy: ported from the mockup placeholder text; church supplies final copy later.
