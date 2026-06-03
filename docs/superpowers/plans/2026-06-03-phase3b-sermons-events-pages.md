# Phase 3B: Sermons & Events Pages + Registration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the public Sermons (list + detail with embedded player) and Events (list + detail) pages from the Phase-3A data layer, and wire a working event registration form (validation → Turnstile → event/capacity checks → insert → notify), plus add Sermons/Events to the nav.

**Architecture:** Astro SSR pages read D1 via `import { env } from 'cloudflare:workers'` (`src/lib/runtime.ts`) + the Phase-3A modules. Detail pages use slugs (`/sermons/[slug]`, `/events/[slug]`). The sermon player uses `toEmbedUrl` with a graceful fallback link when it returns null. Registration mirrors the proven Phase-2B visit pipeline: a pure `handleRegister(env, form, ip)` in `src/lib/register-handler.ts` (unit-tested, no `cloudflare:workers` import) validates with `RegistrationInputSchema`, verifies Turnstile, **validates the event in app code** (exists, published, registration enabled, capacity not exceeded — because D1's FK isn't enforced at runtime), inserts via `createRegistration`, then best-effort `notifyStaff`. The Astro route `src/pages/api/forms/register.ts` is a thin wrapper.

**Tech Stack:** Astro 6 SSR, Cloudflare D1, Turnstile, Zod, Vitest + Miniflare harness.

**Working directory:** `C:\dev\Projects\KharisBuilders Project\stitch_kharisbuilders_church_web_design` (git repo, branch off `main`).

> **Reminders from Phase 2B/3A reviews:** only use DEFINED theme tokens (surface, on-surface, on-surface-variant, primary, on-primary, primary-container, accent, accent-deep, muted, champagne — plus opacity variants); NEVER `surface-container-*`/`stone-gray`/`midnight-blue`. Pages read D1 with try/catch fallback. Client IP via `request.headers.get('cf-connecting-ip')` (no `Astro.clientAddress`). Form POST needs CSRF Origin (browsers send it; curl tests use `-H "Origin: http://localhost:PORT"`). Verify D1-backed pages with `npm run dev` (not preview). Reference: `home_kharisbuilders/code.html` ("Latest Sermon", "Upcoming Gatherings" cards), `visit_us_kharisbuilders/code.html` (form pattern).

---

## File Structure (created/modified)

```
src/components/SermonCard.astro
src/components/EventCard.astro
src/pages/sermons/index.astro          # sermons list
src/pages/sermons/[slug].astro         # sermon detail (embedded player + fallback)
src/pages/events/index.astro           # events list
src/pages/events/[slug].astro          # event detail + registration form
src/lib/db/events.ts                   # MODIFY: add getEventForRegistration(db, id)
src/lib/register-handler.ts            # handleRegister(env, form, ip)
src/pages/api/forms/register.ts        # thin Astro POST wrapper
src/components/Nav.astro               # MODIFY: add Sermons + Events links
tests/register-handler.test.ts
```

---

## Task 1: SermonCard + Sermons list page

**Files:**
- Create: `src/components/SermonCard.astro`, `src/pages/sermons/index.astro`

- [ ] **Step 1: Create `SermonCard.astro`**

```astro
---
import type { Sermon } from '../lib/db/sermons';
interface Props { sermon: Sermon; }
const { sermon } = Astro.props;
---
<a href={`/sermons/${sermon.slug}`} class="group bg-surface border border-champagne rounded-lg overflow-hidden flex flex-col">
  <div class="aspect-video bg-primary-container relative flex items-center justify-center">
    <span class="text-on-primary/70 text-sm uppercase tracking-widest">Watch</span>
  </div>
  <div class="p-6 flex flex-col gap-2 grow">
    {sermon.series && <span class="text-xs uppercase tracking-widest text-accent">{sermon.series}</span>}
    <h2 class="font-[var(--font-display)] text-xl text-primary group-hover:text-accent transition-colors">{sermon.title}</h2>
    <p class="text-on-surface-variant text-sm grow">{sermon.description}</p>
    <p class="text-on-surface-variant text-xs">
      {sermon.speaker}{sermon.speaker && sermon.sermon_date ? ' · ' : ''}{sermon.sermon_date}
    </p>
  </div>
</a>
```

- [ ] **Step 2: Create `src/pages/sermons/index.astro`**

```astro
---
import PublicLayout from '../../layouts/PublicLayout.astro';
import SermonCard from '../../components/SermonCard.astro';
import { env } from '../../lib/runtime';
import { listPublishedSermons, type Sermon } from '../../lib/db/sermons';

let sermons: Sermon[] = [];
try { sermons = await listPublishedSermons(env.DB); } catch { sermons = []; }
---
<PublicLayout title="Sermons | Kharisbuilders" description="Watch the latest messages from Kharisbuilders.">
  <section class="mx-auto max-w-[var(--container-max)] px-6 md:px-16 py-20">
    <div class="text-center mb-16">
      <span class="text-xs uppercase tracking-[0.3em] text-accent">Messages</span>
      <h1 class="font-[var(--font-display)] text-4xl md:text-5xl text-primary mt-3">Sermons</h1>
    </div>
    {sermons.length === 0 ? (
      <p class="text-center text-on-surface-variant">No sermons published yet — check back soon.</p>
    ) : (
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {sermons.map((s) => <SermonCard sermon={s} />)}
      </div>
    )}
  </section>
</PublicLayout>
```

- [ ] **Step 3: Build + verify**

Run `npm run build`; then verify with dev (kill stale servers on 4321-4323 first):
```bash
npm run dev   # then in another shell, or background + curl
curl -s http://localhost:4321/sermons | grep -o "Architecture of Faith"
```
Expected: matches a seeded sermon title.

- [ ] **Step 4: Commit**

```bash
git add src/components/SermonCard.astro src/pages/sermons/index.astro
git commit -m "feat: sermons list page from D1"
```

---

## Task 2: Sermon detail page (embedded player + fallback)

**Files:**
- Create: `src/pages/sermons/[slug].astro`

- [ ] **Step 1: Create `src/pages/sermons/[slug].astro`**

```astro
---
import PublicLayout from '../../layouts/PublicLayout.astro';
import { env } from '../../lib/runtime';
import { getSermonBySlug } from '../../lib/db/sermons';
import { toEmbedUrl } from '../../lib/video';

const { slug } = Astro.params;
const sermon = slug ? await getSermonBySlug(env.DB, slug).catch(() => null) : null;
if (!sermon) return Astro.redirect('/sermons');
const embed = toEmbedUrl(sermon.video_provider, sermon.video_url);
---
<PublicLayout title={`${sermon.title} | Sermons`} description={sermon.description ?? 'Sermon'}>
  <article class="mx-auto max-w-3xl px-6 md:px-16 py-20">
    {sermon.series && <span class="text-xs uppercase tracking-[0.3em] text-accent">{sermon.series}</span>}
    <h1 class="font-[var(--font-display)] text-3xl md:text-4xl text-primary mt-3 mb-2">{sermon.title}</h1>
    <p class="text-on-surface-variant text-sm mb-8">
      {sermon.speaker}{sermon.speaker && sermon.sermon_date ? ' · ' : ''}{sermon.sermon_date}
      {sermon.scripture_ref && <span> · {sermon.scripture_ref}</span>}
    </p>
    <div class="aspect-video bg-primary-container rounded-lg overflow-hidden mb-8">
      {embed ? (
        <iframe class="w-full h-full" src={embed} title={sermon.title} loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen></iframe>
      ) : (
        <a href={sermon.video_url} class="w-full h-full flex items-center justify-center text-on-primary underline" target="_blank" rel="noopener">
          Watch this sermon
        </a>
      )}
    </div>
    {sermon.description && <p class="text-on-surface-variant leading-relaxed">{sermon.description}</p>}
    <a href="/sermons" class="inline-block mt-10 text-accent text-sm uppercase tracking-widest">← All sermons</a>
  </article>
</PublicLayout>
```

- [ ] **Step 2: Build + verify (valid slug renders an iframe; bad slug redirects)**

```bash
npm run build
# dev:
curl -s http://localhost:4321/sermons/architecture-of-faith-4 | grep -o "youtube.com/embed"
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:4321/sermons/nope
```
Expected: the embed URL matches; the bad slug returns a 3xx redirect to `/sermons` (or 200 after following — confirm it does not 500).

- [ ] **Step 3: Commit**

```bash
git add src/pages/sermons/[slug].astro
git commit -m "feat: sermon detail page with embedded player and fallback"
```

---

## Task 3: EventCard + Events list page

**Files:**
- Create: `src/components/EventCard.astro`, `src/pages/events/index.astro`

- [ ] **Step 1: Create `EventCard.astro`**

```astro
---
import type { EventRow } from '../lib/db/events';
interface Props { event: EventRow; }
const { event } = Astro.props;
const date = event.start_at?.slice(0, 10) ?? '';
---
<a href={`/events/${event.slug}`} class="group bg-surface border border-champagne rounded-lg overflow-hidden flex flex-col">
  <div class="aspect-[4/3] bg-primary-container"></div>
  <div class="p-6 flex flex-col gap-2 grow">
    <div class="flex justify-between items-start">
      {event.category && <span class="text-xs uppercase tracking-widest text-accent">{event.category}</span>}
      <span class="text-on-surface-variant text-xs">{date}</span>
    </div>
    <h2 class="font-[var(--font-display)] text-xl text-primary group-hover:text-accent transition-colors">{event.title}</h2>
    <p class="text-on-surface-variant text-sm grow">{event.description}</p>
    {event.location && <p class="text-on-surface-variant text-xs">{event.location}</p>}
  </div>
</a>
```

- [ ] **Step 2: Create `src/pages/events/index.astro`**

```astro
---
import PublicLayout from '../../layouts/PublicLayout.astro';
import EventCard from '../../components/EventCard.astro';
import { env } from '../../lib/runtime';
import { listUpcomingEvents, type EventRow } from '../../lib/db/events';

let events: EventRow[] = [];
try { events = await listUpcomingEvents(env.DB); } catch { events = []; }
---
<PublicLayout title="Events | Kharisbuilders" description="Upcoming gatherings at Kharisbuilders.">
  <section class="mx-auto max-w-[var(--container-max)] px-6 md:px-16 py-20">
    <div class="text-center mb-16">
      <span class="text-xs uppercase tracking-[0.3em] text-accent">What's On</span>
      <h1 class="font-[var(--font-display)] text-4xl md:text-5xl text-primary mt-3">Upcoming Events</h1>
    </div>
    {events.length === 0 ? (
      <p class="text-center text-on-surface-variant">No upcoming events right now — check back soon.</p>
    ) : (
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        {events.map((e) => <EventCard event={e} />)}
      </div>
    )}
  </section>
</PublicLayout>
```

- [ ] **Step 3: Build + verify**

```bash
npm run build
curl -s http://localhost:4321/events | grep -o "Night of Adoration"
```
Expected: matches a seeded event.

- [ ] **Step 4: Commit**

```bash
git add src/components/EventCard.astro src/pages/events/index.astro
git commit -m "feat: events list page from D1"
```

---

## Task 4: Event registration handler (TDD)

**Files:**
- Modify: `src/lib/db/events.ts`
- Create: `src/lib/register-handler.ts`, `src/pages/api/forms/register.ts`, `tests/register-handler.test.ts`

- [ ] **Step 1: Add `getEventForRegistration` to `src/lib/db/events.ts`**

Append:
```ts
export interface EventForRegistration {
  id: number;
  slug: string;
  published: number;
  registration_enabled: number;
  capacity: number | null;
}

export async function getEventForRegistration(db: D1Database, id: number): Promise<EventForRegistration | null> {
  const row = await db
    .prepare('SELECT id, slug, published, registration_enabled, capacity FROM events WHERE id = ?')
    .bind(id)
    .first<EventForRegistration>();
  return row ?? null;
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/register-handler.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll, vi, afterEach } from 'vitest';
import { createTestDb, type TestDb } from './helpers/d1';
import { handleRegister } from '../src/lib/register-handler';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
  await ctx.db.batch([
    ctx.db.prepare("INSERT INTO events (id, title, slug, start_at, published, registration_enabled, capacity) VALUES (1, 'Gala', 'gala', '2999-01-01 10:00:00', 1, 1, 3)"),
    ctx.db.prepare("INSERT INTO events (id, title, slug, start_at, published, registration_enabled, capacity) VALUES (2, 'Closed', 'closed', '2999-01-01 10:00:00', 1, 0, NULL)"),
  ]);
});
afterAll(async () => { await ctx.dispose(); });
afterEach(() => vi.restoreAllMocks());

const pass = () => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: true }))));
function env() { return { DB: ctx.db, TURNSTILE_SECRET_KEY: 'secret' }; }
function fd(f: Record<string, string>) { const x = new FormData(); for (const [k, v] of Object.entries(f)) x.append(k, v); return x; }

describe('handleRegister', () => {
  it('400 on invalid input', async () => {
    pass();
    expect((await handleRegister(env(), fd({ event_id: '1', name: '', email: 'bad', 'cf-turnstile-response': 't' }))).status).toBe(400);
  });
  it('400 when registration is disabled', async () => {
    pass();
    expect((await handleRegister(env(), fd({ event_id: '2', name: 'A', email: 'a@x.org', 'cf-turnstile-response': 't' }))).status).toBe(400);
  });
  it('400 when Turnstile fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: false }))));
    expect((await handleRegister(env(), fd({ event_id: '1', name: 'A', email: 'a@x.org', 'cf-turnstile-response': 't' }))).status).toBe(400);
  });
  it('303 + redirect on success and inserts the registration', async () => {
    pass();
    const res = await handleRegister(env(), fd({ event_id: '1', name: 'Ada', email: 'ada@x.org', guests: '1', 'cf-turnstile-response': 't' }));
    expect(res.status).toBe(303);
    expect(res.redirect).toBe('/events/gala?registered=1');
    const row = await ctx.db.prepare("SELECT name FROM event_registrations WHERE email='ada@x.org'").first<{ name: string }>();
    expect(row?.name).toBe('Ada');
  });
  it('409 + full redirect when capacity is exceeded', async () => {
    pass();
    // event 1 capacity 3; already 2 seats taken (Ada + 1 guest). Requesting 2 more seats (self + 1 guest) -> 4 > 3.
    const res = await handleRegister(env(), fd({ event_id: '1', name: 'Bob', email: 'bob@x.org', guests: '1', 'cf-turnstile-response': 't' }));
    expect(res.status).toBe(409);
    expect(res.redirect).toBe('/events/gala?full=1');
  });
});
```

- [ ] **Step 3: Run to verify it fails**

```bash
npx vitest run tests/register-handler.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `src/lib/register-handler.ts`**

```ts
import { RegistrationInputSchema } from './db/schemas';
import { createRegistration, countRegistrations } from './db/registrations';
import { getEventForRegistration } from './db/events';
import { verifyTurnstile } from './turnstile';
import { notifyStaff, type NotifyEnv } from './notify';

export interface RegisterResult {
  status: number;
  redirect?: string;
}

export type RegisterHandlerEnv = NotifyEnv & {
  DB: D1Database;
  TURNSTILE_SECRET_KEY?: string;
};

export async function handleRegister(env: RegisterHandlerEnv, form: FormData, ip?: string): Promise<RegisterResult> {
  const parsed = RegistrationInputSchema.safeParse({
    event_id: form.get('event_id'),
    name: form.get('name'),
    email: form.get('email'),
    phone: form.get('phone') ?? '',
    guests: form.get('guests') ?? '0',
  });
  if (!parsed.success) return { status: 400 };

  const ev = await getEventForRegistration(env.DB, parsed.data.event_id);
  if (!ev || !ev.published || !ev.registration_enabled) return { status: 400 };

  const ok = await verifyTurnstile(env.TURNSTILE_SECRET_KEY ?? '', String(form.get('cf-turnstile-response') ?? ''), ip);
  if (!ok) return { status: 400 };

  if (ev.capacity != null) {
    const taken = await countRegistrations(env.DB, ev.id);
    const requested = parsed.data.guests + 1;
    if (taken + requested > ev.capacity) return { status: 409, redirect: `/events/${ev.slug}?full=1` };
  }

  await createRegistration(env.DB, parsed.data);
  await notifyStaff(
    env,
    'New event registration',
    `${parsed.data.name} (${parsed.data.email}) registered for event #${ev.id} with ${parsed.data.guests} guest(s).`,
  );
  return { status: 303, redirect: `/events/${ev.slug}?registered=1` };
}
```

- [ ] **Step 5: Create the Astro route `src/pages/api/forms/register.ts`**

```ts
import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { handleRegister, type RegisterHandlerEnv } from '../../../lib/register-handler';

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const ip = request.headers.get('cf-connecting-ip') ?? undefined;
  const result = await handleRegister(env as unknown as RegisterHandlerEnv, form, ip);
  if (result.redirect) {
    return new Response(null, { status: result.status, headers: { Location: result.redirect } });
  }
  return new Response('Please check your details and try again.', { status: result.status });
};
```

- [ ] **Step 6: Run to verify it passes**

```bash
npx vitest run tests/register-handler.test.ts
```
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add src/lib/db/events.ts src/lib/register-handler.ts src/pages/api/forms/register.ts tests/register-handler.test.ts
git commit -m "feat: event registration handler with event/capacity validation and tests"
```

---

## Task 5: Event detail page + registration form

**Files:**
- Create: `src/pages/events/[slug].astro`

- [ ] **Step 1: Create `src/pages/events/[slug].astro`**

```astro
---
import PublicLayout from '../../layouts/PublicLayout.astro';
import Button from '../../components/Button.astro';
import Field from '../../components/Field.astro';
import { env } from '../../lib/runtime';
import { getEventBySlug } from '../../lib/db/events';
import { countRegistrations } from '../../lib/db/registrations';
import { getAllSettings } from '../../lib/db/settings';

const { slug } = Astro.params;
const event = slug ? await getEventBySlug(env.DB, slug).catch(() => null) : null;
if (!event) return Astro.redirect('/events');

let siteKey = '1x00000000000000000000AA';
try { siteKey = (await getAllSettings(env.DB)).turnstile_site_key ?? siteKey; } catch { /* default */ }

let isFull = false;
if (event.registration_enabled && event.capacity != null) {
  try { isFull = (await countRegistrations(env.DB, event.id)) >= event.capacity; } catch { isFull = false; }
}
const registered = Astro.url.searchParams.get('registered') === '1';
const fullParam = Astro.url.searchParams.get('full') === '1';
const date = event.start_at?.slice(0, 16).replace('T', ' ') ?? '';
---
<PublicLayout title={`${event.title} | Events`} description={event.description ?? 'Event'}>
  <article class="mx-auto max-w-[var(--container-max)] px-6 md:px-16 py-20 grid md:grid-cols-2 gap-16">
    <div>
      {event.category && <span class="text-xs uppercase tracking-[0.3em] text-accent">{event.category}</span>}
      <h1 class="font-[var(--font-display)] text-3xl md:text-4xl text-primary mt-3 mb-4">{event.title}</h1>
      <p class="text-on-surface-variant text-sm mb-2">{date}</p>
      {event.location && <p class="text-on-surface-variant text-sm mb-8">{event.location}</p>}
      {event.description && <p class="text-on-surface-variant leading-relaxed">{event.description}</p>}
      <a href="/events" class="inline-block mt-10 text-accent text-sm uppercase tracking-widest">← All events</a>
    </div>

    <div class="bg-surface border border-champagne rounded-lg p-8">
      {!event.registration_enabled ? (
        <p class="text-on-surface-variant">Registration isn't required for this event — just come along!</p>
      ) : registered ? (
        <p class="font-[var(--font-display)] text-2xl text-primary">You're registered — see you there!</p>
      ) : isFull || fullParam ? (
        <p class="font-[var(--font-display)] text-2xl text-primary">This event is full. Please contact us to join the waitlist.</p>
      ) : (
        <form method="POST" action="/api/forms/register" class="flex flex-col gap-6">
          <input type="hidden" name="event_id" value={String(event.id)} />
          <Field label="Full Name" name="name" required />
          <Field label="Email Address" name="email" type="email" required />
          <Field label="Phone (optional)" name="phone" type="tel" />
          <Field label="Number of guests" name="guests" type="number" />
          <div class="cf-turnstile" data-sitekey={siteKey}></div>
          <Button type="submit" variant="primary">Register</Button>
        </form>
      )}
    </div>
  </article>
  <script is:inline src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
</PublicLayout>
```

- [ ] **Step 2: Build + verify the registration flow end-to-end (dev)**

```bash
npm run build
# dev on a clean port; then:
curl -s http://localhost:4321/events/first-steps-luncheon | grep -o "Register"
# Submit (Origin required for CSRF; dev Turnstile test secret in .dev.vars):
curl -s -i -X POST http://localhost:4321/api/forms/register -H "Origin: http://localhost:4321" \
  --data "event_id=1&name=Test Reg&email=testreg@example.com&guests=0&cf-turnstile-response=dummy" | grep -i "location:"
npx wrangler d1 execute kharisbuilders --local --command "SELECT name FROM event_registrations WHERE email='testreg@example.com';"
```
Expected: GET shows "Register"; POST returns `Location: /events/<slug>?registered=1` (event id 1's slug); the row exists. (If event id 1 locally is not registration-enabled, use an id/slug that is — `first-steps-luncheon` is seeded with registration_enabled=1.)

- [ ] **Step 3: Commit**

```bash
git add src/pages/events/[slug].astro
git commit -m "feat: event detail page with registration form"
```

---

## Task 6: Add Sermons + Events to the nav

**Files:**
- Modify: `src/components/Nav.astro`

- [ ] **Step 1: Add the two links to the `links` array in `Nav.astro`**

Change the array to:
```ts
const links = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Ministries', href: '/ministries' },
  { label: 'Sermons', href: '/sermons' },
  { label: 'Events', href: '/events' },
  { label: 'Visit', href: '/visit' },
];
```
(Both the desktop and mobile menus map over `links`, so they update together.)

- [ ] **Step 2: Build + verify both nav variants include the links**

```bash
npm run build
curl -s http://localhost:4321/ | grep -oE 'href="/sermons"|href="/events"' | sort -u
```
Expected: both hrefs present.

- [ ] **Step 3: Commit**

```bash
git add src/components/Nav.astro
git commit -m "feat: add Sermons and Events to navigation"
```

---

## Task 7: Full gate + review

- [ ] **Step 1: Run the full suite**

```bash
npx vitest run
```
Expected: 26 (Phase 3A) + register-handler (5) = 31 passing.

- [ ] **Step 2: Build**

```bash
npm run build
```
Expected: succeeds.

- [ ] **Step 3: Smoke all new routes (dev)**

`npm run dev`; curl and confirm 200 + expected content: `/sermons`, `/sermons/architecture-of-faith-4`, `/events`, `/events/first-steps-luncheon`. Confirm a bad slug (`/sermons/nope`) redirects rather than 500s. Stop dev.

- [ ] **Step 4: Clean tree**

```bash
git status --short
```

---

## Phase 3B Done — Definition of Done
- `/sermons` + `/sermons/[slug]` (embedded player w/ fallback) and `/events` + `/events/[slug]` (with registration form) render from D1.
- Event registration works end-to-end with event existence, `registration_enabled`, capacity, Turnstile, and zod validation; success/full/registered states render.
- Sermons + Events in the nav.
- `npx vitest run` (31 tests) and `npm run build` pass.

**Next:** Phase 4 — Admin core behind Cloudflare Access (Dashboard + CRUD for sermons, events, ministries, visitors, settings; view registrations; R2 image uploads).

---

## Open Questions (non-blocking)
- Past-sermon pagination (current: simple `limit`).
- Whether to show past events (current: upcoming only).
- Real imagery for sermon thumbnails/event images (R2, a later phase) — placeholders for now.
