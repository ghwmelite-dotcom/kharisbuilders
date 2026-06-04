# Live / Online Campus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/live` Online Campus page that auto-shows the stream during services (with embedded chat, connect card, Give/Prayer, bulletin) and a "next gathering" hub otherwise — controlled from an Admin → Live page.

**Architecture:** Pure, tested logic — `computeLiveStatus` (override OR scheduled window, in church time) and `toLiveEmbed` (stream + chat URLs). The page renders server-side and polls `/api/live/status` to flip live↔offline. Connect + prayer are Turnstile-protected form pipelines (like `visit-handler`) writing to two small tables. Live config lives in `site_settings` (allowlisted), edited from Admin → Live.

**Tech Stack:** Astro 6 SSR, Cloudflare D1, zod v4, Vitest + Miniflare. Spec: `docs/superpowers/specs/2026-06-04-live-online-campus-design.md`.

**Working dir:** `C:\dev\Projects\KharisBuilders Project\stitch_kharisbuilders_church_web_design` (branch `feat/live-online-campus` off `main`).

> **Conventions:** form pipeline pattern = `src/lib/visit-handler.ts` (zod → `verifyTurnstile` → insert → `notifyStaff`; route reads IP from `cf-connecting-ip`, `cf-turnstile-response` field). Settings: `getAllSettings`/`setSettings`. Content: `getAllContent`/`makeContent` (the editable `home.gathering_schedule` JSON). `getSermonBySlug`/`listPublishedSermons` for the latest message. PageHero/SectionIntro for styling. Nav links array in `src/components/Nav.astro`. Admin gated by `requireAdmin`/`getAdminEmail`.

---

## File Structure (created/modified)

```
migrations/0018_online_attendances.sql 0019_prayer_requests.sql
src/lib/live/status.ts          # computeLiveStatus (pure)
src/lib/live/embed.ts           # toLiveEmbed (pure)
src/lib/live/online-connect-handler.ts  src/lib/live/prayer-handler.ts
src/lib/db/online-attendances.ts  src/lib/db/prayer-requests.ts
src/lib/db/schemas.ts           # + OnlineConnectInputSchema, PrayerInputSchema
src/pages/api/live/status.ts
src/pages/api/forms/online-connect.ts  src/pages/api/forms/prayer.ts
src/pages/api/admin/live.ts
src/pages/live.astro
src/pages/admin/live.astro
src/layouts/AdminLayout.astro    # + Live nav
src/components/Nav.astro         # + Watch link
tests/live/status.test.ts tests/live/embed.test.ts tests/live/handlers.test.ts tests/db/live-tables.test.ts
```

---

## Task 1: migrations

**Files:** Create `migrations/0018_online_attendances.sql`, `migrations/0019_prayer_requests.sql`.

- [ ] **Step 1:** `0018_online_attendances.sql`
```sql
CREATE TABLE IF NOT EXISTS online_attendances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  location TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```
- [ ] **Step 2:** `0019_prayer_requests.sql`
```sql
CREATE TABLE IF NOT EXISTS prayer_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  email TEXT,
  request TEXT NOT NULL,
  is_private INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```
- [ ] **Step 3:** Apply + verify
```bash
npx wrangler d1 migrations apply kharisbuilders --local
npx wrangler d1 execute kharisbuilders --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('online_attendances','prayer_requests');"
```
- [ ] **Step 4: Commit** `feat: online_attendances + prayer_requests tables`.

---

## Task 2: live-status logic (TDD)

**Files:** Create `src/lib/live/status.ts`, `tests/live/status.test.ts`.

- [ ] **Step 1: Write the failing test**
```ts
import { describe, it, expect } from 'vitest';
import { computeLiveStatus, type ScheduleEntry } from '../../src/lib/live/status';

// Sunday 2026-06-07 is a Sunday (day 0). Use UTC dates (tzOffset 0 = Accra).
const sched: ScheduleEntry[] = [{ day: 0, hour: 9, min: 0, label: 'Sunday · 9:00 AM' }];

describe('computeLiveStatus', () => {
  it('state=live forces live', () => {
    expect(computeLiveStatus([], 90, 'live', 0, new Date('2026-06-03T00:00:00Z')).isLive).toBe(true);
  });
  it('state=off forces offline (still computes next)', () => {
    const r = computeLiveStatus(sched, 90, 'off', 0, new Date('2026-06-07T09:30:00Z'));
    expect(r.isLive).toBe(false);
    expect(r.next?.label).toBe('Sunday · 9:00 AM');
  });
  it('auto: inside the window is live with an end time', () => {
    const r = computeLiveStatus(sched, 90, 'auto', 0, new Date('2026-06-07T09:30:00Z')); // 30min into a 90min window
    expect(r.isLive).toBe(true);
    expect(r.endsAtMs).toBe(new Date('2026-06-07T10:30:00Z').getTime());
  });
  it('auto: outside the window is offline with the next start', () => {
    const r = computeLiveStatus(sched, 90, 'auto', 0, new Date('2026-06-07T12:00:00Z'));
    expect(r.isLive).toBe(false);
    expect(r.next?.atMs).toBe(new Date('2026-06-14T09:00:00Z').getTime()); // next Sunday
  });
  it('tz offset shifts the window (church UTC+1)', () => {
    // 08:30 UTC == 09:30 church (offset +60) => inside the 9am window
    expect(computeLiveStatus(sched, 90, 'auto', 60, new Date('2026-06-07T08:30:00Z')).isLive).toBe(true);
  });
  it('empty/garbage schedule -> offline', () => {
    expect(computeLiveStatus([], 90, 'auto', 0, new Date()).isLive).toBe(false);
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement `src/lib/live/status.ts`**
```ts
export interface ScheduleEntry {
  day: number; // 0=Sun .. 6=Sat
  hour: number;
  min?: number;
  label: string;
}
export interface LiveStatus {
  isLive: boolean;
  endsAtMs?: number;
  next?: { label: string; atMs: number };
}

const WEEK = 10080; // minutes in a week
const mod = (n: number, m: number) => ((n % m) + m) % m;

export function computeLiveStatus(
  schedule: ScheduleEntry[],
  durationMin: number,
  state: string,
  tzOffsetMin: number,
  now: Date,
): LiveStatus {
  if (state === 'live') return { isLive: true };
  const nowMs = now.getTime();
  const church = new Date(nowMs + tzOffsetMin * 60000); // shift so UTC getters read church-local wall clock
  const mow = church.getUTCDay() * 1440 + church.getUTCHours() * 60 + church.getUTCMinutes();

  let bestUntil = Infinity;
  let next: { label: string; atMs: number } | undefined;
  for (const e of schedule) {
    if (!e || typeof e.day !== 'number' || typeof e.hour !== 'number') continue;
    const start = mod(e.day * 1440 + e.hour * 60 + (e.min ?? 0), WEEK);
    const into = mod(mow - start, WEEK);
    if (state === 'auto' && into < durationMin) {
      return { isLive: true, endsAtMs: nowMs + (durationMin - into) * 60000 };
    }
    const until = mod(start - mow, WEEK);
    if (until < bestUntil) {
      bestUntil = until;
      next = { label: e.label, atMs: nowMs + until * 60000 };
    }
  }
  return { isLive: false, next };
}
```

- [ ] **Step 4: Run → pass. Commit** `feat: computeLiveStatus (override + scheduled windows, church time) with tests`.

---

## Task 3: stream embed (TDD)

**Files:** Create `src/lib/live/embed.ts`, `tests/live/embed.test.ts`.

- [ ] **Step 1: Write the failing test**
```ts
import { describe, it, expect } from 'vitest';
import { toLiveEmbed } from '../../src/lib/live/embed';

describe('toLiveEmbed', () => {
  it('YouTube video -> embed + chat with embed_domain', () => {
    const r = toLiveEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'kharis.org');
    expect(r.embedUrl).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0');
    expect(r.chatUrl).toBe('https://www.youtube.com/live_chat?v=dQw4w9WgXcQ&embed_domain=kharis.org');
  });
  it('youtu.be and /live/ forms', () => {
    expect(toLiveEmbed('https://youtu.be/dQw4w9WgXcQ', 'h').embedUrl).toContain('/embed/dQw4w9WgXcQ');
    expect(toLiveEmbed('https://www.youtube.com/live/dQw4w9WgXcQ', 'h').embedUrl).toContain('/embed/dQw4w9WgXcQ');
  });
  it('YouTube channel-live -> embed, no chat', () => {
    const r = toLiveEmbed('https://www.youtube.com/embed/live_stream?channel=UC123abc', 'h');
    expect(r.embedUrl).toContain('live_stream?channel=UC123abc');
    expect(r.chatUrl).toBeNull();
  });
  it('Vimeo -> player embed, no chat', () => {
    expect(toLiveEmbed('https://vimeo.com/76979871', 'h').embedUrl).toBe('https://player.vimeo.com/video/76979871');
  });
  it('generic https url -> raw iframe', () => {
    expect(toLiveEmbed('https://stream.example.com/x', 'h').embedUrl).toBe('https://stream.example.com/x');
  });
  it('empty/junk -> nulls', () => {
    expect(toLiveEmbed('', 'h')).toEqual({ embedUrl: null, chatUrl: null });
    expect(toLiveEmbed('not a url', 'h')).toEqual({ embedUrl: null, chatUrl: null });
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement `src/lib/live/embed.ts`** (channel-live checked BEFORE the 11-char video regex — "live_stream" is 11 chars)
```ts
export interface LiveEmbed {
  embedUrl: string | null;
  chatUrl: string | null;
}

export function toLiveEmbed(url: string, originHost: string): LiveEmbed {
  const u = (url ?? '').trim();
  if (!u) return { embedUrl: null, chatUrl: null };

  const channel = u.match(/youtube\.com\/embed\/live_stream\?channel=([A-Za-z0-9_-]+)/);
  if (channel) return { embedUrl: `https://www.youtube.com/embed/live_stream?channel=${channel[1]}`, chatUrl: null };

  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|live\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (yt) {
    const id = yt[1];
    return {
      embedUrl: `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`,
      chatUrl: `https://www.youtube.com/live_chat?v=${id}&embed_domain=${originHost}`,
    };
  }

  const vimeo = u.match(/vimeo\.com\/(?:event\/)?(\d+)/);
  if (vimeo) return { embedUrl: `https://player.vimeo.com/video/${vimeo[1]}`, chatUrl: null };

  if (/facebook\.com/.test(u)) {
    return { embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(u)}&autoplay=true`, chatUrl: null };
  }

  if (/^https?:\/\//i.test(u)) return { embedUrl: u, chatUrl: null };
  return { embedUrl: null, chatUrl: null };
}
```

- [ ] **Step 4: Run → pass. Commit** `feat: toLiveEmbed (YouTube/Vimeo/FB/generic + chat) with tests`.

---

## Task 4: schemas + data access (TDD)

**Files:** Modify `src/lib/db/schemas.ts`; create `src/lib/db/online-attendances.ts`, `src/lib/db/prayer-requests.ts`, `tests/db/live-tables.test.ts`.

- [ ] **Step 1: Schemas** (append to `schemas.ts`)
```ts
export const OnlineConnectInputSchema = z.object({
  name: z.string().trim().min(1, 'Please enter your name').max(120),
  email: z.string().trim().email('Please enter a valid email').max(200),
  location: z.string().trim().max(120).optional().or(z.literal('')),
});
export type OnlineConnectInput = z.infer<typeof OnlineConnectInputSchema>;

export const PrayerInputSchema = z.object({
  name: z.string().trim().max(120).optional().or(z.literal('')),
  email: z.string().trim().email().max(200).optional().or(z.literal('')),
  request: z.string().trim().min(1, 'Please share your request').max(2000),
  is_private: z.coerce.boolean().default(true),
});
export type PrayerInput = z.infer<typeof PrayerInputSchema>;
```

- [ ] **Step 2: Data access** — `src/lib/db/online-attendances.ts`
```ts
import type { OnlineConnectInput } from './schemas';
export interface OnlineAttendance { id: number; name: string; email: string; location: string | null; created_at: string }
export async function createOnlineAttendance(db: D1Database, input: OnlineConnectInput): Promise<void> {
  await db.prepare('INSERT INTO online_attendances (name, email, location) VALUES (?, ?, ?)')
    .bind(input.name, input.email, input.location || null).run();
}
export async function listOnlineAttendances(db: D1Database, limit = 100): Promise<OnlineAttendance[]> {
  const { results } = await db.prepare('SELECT id, name, email, location, created_at FROM online_attendances ORDER BY id DESC LIMIT ?').bind(limit).all<OnlineAttendance>();
  return results;
}
```
`src/lib/db/prayer-requests.ts`
```ts
import type { PrayerInput } from './schemas';
export interface PrayerRequest { id: number; name: string | null; email: string | null; request: string; is_private: number; status: string; created_at: string }
export async function createPrayerRequest(db: D1Database, input: PrayerInput): Promise<void> {
  await db.prepare('INSERT INTO prayer_requests (name, email, request, is_private) VALUES (?, ?, ?, ?)')
    .bind(input.name || null, input.email || null, input.request, input.is_private ? 1 : 0).run();
}
export async function listPrayerRequests(db: D1Database, limit = 100): Promise<PrayerRequest[]> {
  const { results } = await db.prepare('SELECT id, name, email, request, is_private, status, created_at FROM prayer_requests ORDER BY id DESC LIMIT ?').bind(limit).all<PrayerRequest>();
  return results;
}
```

- [ ] **Step 3: Test** (`tests/db/live-tables.test.ts`)
```ts
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { createOnlineAttendance, listOnlineAttendances } from '../../src/lib/db/online-attendances';
import { createPrayerRequest, listPrayerRequests } from '../../src/lib/db/prayer-requests';

let ctx: TestDb;
beforeAll(async () => { ctx = await createTestDb(); });
afterAll(async () => { await ctx.dispose(); });

describe('live tables', () => {
  it('online attendance create + list', async () => {
    await createOnlineAttendance(ctx.db, { name: 'A', email: 'a@x.com', location: 'Accra' });
    const rows = await listOnlineAttendances(ctx.db);
    expect(rows[0].name).toBe('A');
    expect(rows[0].location).toBe('Accra');
  });
  it('prayer request create + list (private default)', async () => {
    await createPrayerRequest(ctx.db, { name: '', email: '', request: 'Please pray', is_private: true });
    const rows = await listPrayerRequests(ctx.db);
    expect(rows[0].request).toBe('Please pray');
    expect(rows[0].is_private).toBe(1);
  });
});
```
Run → pass.

- [ ] **Step 4: Commit** `feat: online-attendance + prayer-request schemas and data access with tests`.

---

## Task 5: form handlers (TDD)

**Files:** Create `src/lib/live/online-connect-handler.ts`, `src/lib/live/prayer-handler.ts`, `tests/live/handlers.test.ts`.

- [ ] **Step 1: Implement** (mirror `src/lib/visit-handler.ts`; use the same `NotifyEnv`/`verifyTurnstile`)

`online-connect-handler.ts`:
```ts
import { OnlineConnectInputSchema } from '../db/schemas';
import { createOnlineAttendance } from '../db/online-attendances';
import { verifyTurnstile } from '../turnstile';
import { notifyStaff, type NotifyEnv } from '../notify';

export type OnlineConnectEnv = NotifyEnv & { DB: D1Database; TURNSTILE_SECRET_KEY?: string };
export interface FormResult { status: number; redirect?: string }

export async function handleOnlineConnect(env: OnlineConnectEnv, form: FormData, ip?: string): Promise<FormResult> {
  const parsed = OnlineConnectInputSchema.safeParse({
    name: form.get('name'), email: form.get('email'), location: form.get('location') ?? '',
  });
  if (!parsed.success) return { status: 303, redirect: '/live?connect=err' };
  const ok = await verifyTurnstile(env.TURNSTILE_SECRET_KEY ?? '', String(form.get('cf-turnstile-response') ?? ''), ip);
  if (!ok) return { status: 303, redirect: '/live?connect=err' };
  await createOnlineAttendance(env.DB, parsed.data);
  await notifyStaff(env, 'New online attendee', `${parsed.data.name} (${parsed.data.email}) is watching from ${parsed.data.location || 'unknown'}.`);
  return { status: 303, redirect: '/live?connect=ok' };
}
```
`prayer-handler.ts` — same shape with `PrayerInputSchema` → `createPrayerRequest`, notify "New prayer request", redirects `/live?prayer=ok|err`.

- [ ] **Step 2: Test** (`tests/live/handlers.test.ts`) — like `tests/visit-handler.test.ts`: stub Turnstile via a global `fetch` returning `{success:true/false}`; assert invalid input → err redirect (no insert), valid+turnstile → ok redirect + row inserted (Miniflare DB). Cover both handlers.
> Note: `verifyTurnstile` uses the global `fetch`. In the test, set `globalThis.fetch` to a stub returning `{ json: async () => ({ success: true }) }` for siteverify (same approach as the existing `tests/visit-handler.test.ts` — follow that file exactly).

Run → pass.

- [ ] **Step 3: Commit** `feat: online-connect + prayer form handlers with tests`.

---

## Task 6: routes (forms, status, admin)

**Files:** Create `src/pages/api/forms/online-connect.ts`, `src/pages/api/forms/prayer.ts`, `src/pages/api/live/status.ts`, `src/pages/api/admin/live.ts`.

- [ ] **Step 1: Form routes** (mirror `src/pages/api/forms/visit.ts`)
```ts
// online-connect.ts
import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { handleOnlineConnect } from '../../../lib/live/online-connect-handler';
export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const ip = request.headers.get('cf-connecting-ip') ?? undefined;
  const r = await handleOnlineConnect(env, form, ip);
  return new Response(null, { status: r.status, headers: { Location: r.redirect ?? '/live' } });
};
```
`prayer.ts` — same with `handlePrayer`.

- [ ] **Step 2: `src/pages/api/live/status.ts`**
```ts
import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { getAllSettings } from '../../../lib/db/settings';
import { getAllContent } from '../../../lib/db/content';
import { makeContent } from '../../../lib/content/content';
import { computeLiveStatus, type ScheduleEntry } from '../../../lib/live/status';

export const GET: APIRoute = async () => {
  const json = (b: unknown) => new Response(JSON.stringify(b), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  try {
    const [settings, content] = await Promise.all([getAllSettings(env.DB), getAllContent(env.DB)]);
    const c = makeContent(content);
    let schedule: ScheduleEntry[] = [];
    try { schedule = JSON.parse(c('home.gathering_schedule')); } catch { schedule = []; }
    const status = computeLiveStatus(
      Array.isArray(schedule) ? schedule : [],
      Number(settings.live_duration_min ?? 90) || 90,
      settings.live_state ?? 'auto',
      Number(settings.live_tz_offset_min ?? 0) || 0,
      new Date(),
    );
    return json(status);
  } catch {
    return json({ isLive: false });
  }
};
```

- [ ] **Step 3: `src/pages/api/admin/live.ts`** (gated; allowlisted)
```ts
import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { requireAdmin } from '../../../lib/admin-auth';
import { setSettings } from '../../../lib/db/settings';

const LIVE_KEYS = ['live_stream_url', 'live_state', 'live_duration_min', 'live_tz_offset_min', 'live_chat_enabled', 'live_connect_enabled', 'live_bulletin_title', 'live_bulletin_body'];

export const POST: APIRoute = async ({ request }) => {
  const auth = requireAdmin(request, env, import.meta.env.DEV);
  if ('response' in auth) return auth.response;
  const form = await request.formData();
  const entries: Record<string, string> = {};
  for (const k of LIVE_KEYS) if (form.has(k)) entries[k] = String(form.get(k) ?? '');
  try { await setSettings(env.DB, entries); } catch { return new Response('Invalid', { status: 400 }); }
  return new Response(null, { status: 303, headers: { Location: '/admin/live?saved=1' } });
};
```
> Checkboxes (`live_chat_enabled`,`live_connect_enabled`): render hidden `value="false"` + checkbox is awkward; instead use a `<select>` true/false OR submit explicit values. Use `<select name="..."><option>true</option><option>false</option></select>` to avoid the checkbox-absent footgun. (Each LIVE key is always present in the form, so `form.has(k)` is true.)

- [ ] **Step 4: Build → succeeds. Commit** `feat: live form routes + status endpoint + admin live save`.

---

## Task 7: /live page, admin editor, nav

**Files:** Create `src/pages/live.astro`, `src/pages/admin/live.astro`; modify `src/layouts/AdminLayout.astro`, `src/components/Nav.astro`.

- [ ] **Step 1: `src/pages/live.astro`** — server-render Live or Offline

Frontmatter: load settings + content + latest sermon; compute status + embed.
```ts
const [settings, content] = await Promise.all([getAllSettings(env.DB).catch(()=>({})), getAllContent(env.DB).catch(()=>({}))]);
const c = makeContent(content);
let schedule = []; try { schedule = JSON.parse(c('home.gathering_schedule')); } catch {}
const status = computeLiveStatus(Array.isArray(schedule)?schedule:[], Number(settings.live_duration_min ?? 90)||90, settings.live_state ?? 'auto', Number(settings.live_tz_offset_min ?? 0)||0, new Date());
const host = (Astro.site ?? new URL(SITE.url)).host;
const embed = toLiveEmbed(settings.live_stream_url ?? '', host);
const chatOn = (settings.live_chat_enabled ?? 'true') === 'true' && !!embed.chatUrl;
const connectOn = (settings.live_connect_enabled ?? 'true') === 'true';
const latest = (await listPublishedSermons(env.DB, 1).catch(()=>[]))[0] ?? null;
const siteKey = settings.turnstile_site_key ?? '1x00000000000000000000AA';
const bulletinTitle = settings.live_bulletin_title ?? '';
const bulletinBody = settings.live_bulletin_body ?? '';
const connectMsg = Astro.url.searchParams.get('connect'); const prayerMsg = Astro.url.searchParams.get('prayer');
```
Layout (PublicLayout):
- **Live (`status.isLive`)**: a "● LIVE NOW" badge; a grid: main = `embed.embedUrl` in a 16:9 iframe (or a "stream will appear shortly" placeholder if null); aside = chat iframe (`chatUrl`) when `chatOn`. Below: the connect card (if `connectOn`) + Give (`/giving`) & Request Prayer buttons + the bulletin (`bulletinTitle`/`bulletinBody` with `whitespace-pre-line`).
- **Offline**: a PageHero/hero with a countdown to `status.next` (inline JS counting to `next.atMs`); a "Catch the latest message" card linking to `/sermons/<latest.slug>`; the schedule list; the same connect card + bulletin + Give/Prayer.
- **Connect card form**: `POST /api/forms/online-connect` with Field name/email/location + Turnstile + button. Show `connect=ok|err` flash.
- **Prayer form** (a small disclosure or inline): `POST /api/forms/prayer` with name (optional), email (optional), request (textarea, required), a "keep private" note, Turnstile. Show `prayer=ok|err` flash.
- Include the Turnstile script (`<script is:inline src=".../api.js" async defer>`).
- **Client poll** (`<script>`): every 30s `fetch('/api/live/status')`; if `data.isLive !== <serverIsLive>` → `location.reload()`. Embed `data-was-live` on a root element. Respect nothing special; this is a network poll only.

> Imports: `getAllSettings`, `getAllContent`, `makeContent`, `computeLiveStatus`, `toLiveEmbed`, `listPublishedSermons`, `SITE` (seo), `PublicLayout`, `Field`, `PageHero`/`SectionIntro`.

- [ ] **Step 2: `src/pages/admin/live.astro`** — gated editor + lists
```astro
---
import AdminLayout from '../../layouts/AdminLayout.astro';
import Button from '../../components/Button.astro';
import { env } from '../../lib/runtime';
import { getAdminEmail } from '../../lib/admin-auth';
import { getAllSettings } from '../../lib/db/settings';
import { listOnlineAttendances } from '../../lib/db/online-attendances';
import { listPrayerRequests } from '../../lib/db/prayer-requests';
const email = getAdminEmail(Astro.request, env, import.meta.env.DEV);
if (!email) return Astro.redirect('/admin/denied');
const s = await getAllSettings(env.DB).catch(() => ({}) as Record<string,string>);
const attendances = await listOnlineAttendances(env.DB, 50).catch(() => []);
const prayers = await listPrayerRequests(env.DB, 50).catch(() => []);
const saved = Astro.url.searchParams.get('saved') === '1';
const sel = (key: string, def: string) => s[key] ?? def;
---
<AdminLayout title="Live / Online Campus" email={email} active="live">
  {saved && <p class="mb-6 bg-accent/10 text-primary text-sm px-4 py-3">Saved. <a href="/live" target="_blank" class="underline">View the live page →</a></p>}
  <form method="POST" action="/api/admin/live" class="max-w-xl space-y-5 mb-12">
    <label class="block text-xs uppercase tracking-wider text-on-surface-variant">Status
      <select name="live_state" class="mt-1 w-full border border-champagne bg-surface px-4 py-2 text-sm">
        <option value="auto" selected={sel('live_state','auto')==='auto'}>Auto (follow schedule)</option>
        <option value="live" selected={sel('live_state','auto')==='live'}>Live now (force on)</option>
        <option value="off" selected={sel('live_state','auto')==='off'}>Off (force offline)</option>
      </select>
    </label>
    <label class="block text-xs uppercase tracking-wider text-on-surface-variant">Stream URL (YouTube / Vimeo / Facebook / embed)
      <input name="live_stream_url" value={sel('live_stream_url','')} class="mt-1 w-full border border-champagne bg-surface px-4 py-2 text-sm" />
    </label>
    <label class="block text-xs uppercase tracking-wider text-on-surface-variant">Service length (minutes)
      <input name="live_duration_min" type="number" min="15" value={sel('live_duration_min','90')} class="mt-1 w-full border border-champagne bg-surface px-4 py-2 text-sm" />
    </label>
    <label class="block text-xs uppercase tracking-wider text-on-surface-variant">Timezone offset from UTC (minutes; Accra = 0)
      <input name="live_tz_offset_min" type="number" value={sel('live_tz_offset_min','0')} class="mt-1 w-full border border-champagne bg-surface px-4 py-2 text-sm" />
    </label>
    <label class="block text-xs uppercase tracking-wider text-on-surface-variant">Show embedded chat
      <select name="live_chat_enabled" class="mt-1 w-full border border-champagne bg-surface px-4 py-2 text-sm"><option value="true" selected={sel('live_chat_enabled','true')==='true'}>Yes</option><option value="false" selected={sel('live_chat_enabled','true')==='false'}>No</option></select>
    </label>
    <label class="block text-xs uppercase tracking-wider text-on-surface-variant">Show connect card
      <select name="live_connect_enabled" class="mt-1 w-full border border-champagne bg-surface px-4 py-2 text-sm"><option value="true" selected={sel('live_connect_enabled','true')==='true'}>Yes</option><option value="false" selected={sel('live_connect_enabled','true')==='false'}>No</option></select>
    </label>
    <label class="block text-xs uppercase tracking-wider text-on-surface-variant">Bulletin title
      <input name="live_bulletin_title" value={sel('live_bulletin_title','')} class="mt-1 w-full border border-champagne bg-surface px-4 py-2 text-sm" />
    </label>
    <div class="flex flex-col gap-1"><label class="text-xs uppercase tracking-wider text-on-surface-variant">Bulletin body</label>
      <textarea name="live_bulletin_body" rows="5" class="border border-champagne bg-surface px-4 py-2 text-sm" set:text={sel('live_bulletin_body','')} /></div>
    <Button type="submit" variant="primary">Save</Button>
  </form>

  <h2 class="font-display text-lg text-primary mb-3">Online attendance ({attendances.length})</h2>
  <table class="w-full text-sm mb-10"><thead><tr class="text-left text-on-surface-variant border-b border-champagne"><th class="py-2">When</th><th>Name</th><th>Email</th><th>From</th></tr></thead>
    <tbody>{attendances.map((a) => <tr class="border-b border-champagne/50"><td class="py-2">{a.created_at}</td><td>{a.name}</td><td>{a.email}</td><td>{a.location}</td></tr>)}</tbody></table>

  <h2 class="font-display text-lg text-primary mb-3">Prayer requests ({prayers.length})</h2>
  <table class="w-full text-sm"><thead><tr class="text-left text-on-surface-variant border-b border-champagne"><th class="py-2">When</th><th>Name</th><th>Request</th><th>Private</th></tr></thead>
    <tbody>{prayers.map((p) => <tr class="border-b border-champagne/50"><td class="py-2">{p.created_at}</td><td>{p.name ?? '—'}</td><td>{p.request}</td><td>{p.is_private ? 'Yes' : 'No'}</td></tr>)}</tbody></table>
</AdminLayout>
```

- [ ] **Step 3: AdminLayout nav** — add after `content`: `{ label: 'Live', href: '/admin/live', key: 'live' },`.

- [ ] **Step 4: `src/components/Nav.astro`** — add `{ label: 'Watch', href: '/live' }` to the `links` array (after `Sermons`).

- [ ] **Step 5: Build → succeeds. Commit** `feat: /live online-campus page + admin live editor + nav`.

---

## Task 8: full gate + dev verify

- [ ] **Step 1: Full suite** (`npx vitest run`) — prior 159 + new (~16) pass.
- [ ] **Step 2: Build.**
- [ ] **Step 3: Apply migrations remote + dev verify** (`npm run dev`)
```bash
# offline hub renders by default (no stream, state auto)
curl -s -o /dev/null -w "live page: %{http_code}\n" http://localhost:4321/live
# status endpoint returns JSON
curl -s http://localhost:4321/api/live/status
# force live + set a YouTube stream, confirm the embed appears
curl -s -o /dev/null -X POST http://localhost:4321/api/admin/live -H "Origin: http://localhost:4321" -F "live_state=live" -F "live_stream_url=https://youtu.be/dQw4w9WgXcQ" -F "live_duration_min=90" -F "live_tz_offset_min=0" -F "live_chat_enabled=true" -F "live_connect_enabled=true" -F "live_bulletin_title=Order of Service" -F "live_bulletin_body=Welcome"
curl -s http://localhost:4321/api/live/status | grep -o '"isLive":true'
curl -s http://localhost:4321/live | grep -o 'youtube.com/embed/dQw4w9WgXcQ' | head -1
# connect + prayer submit (dev turnstile passes)
curl -s -o /dev/null -X POST http://localhost:4321/api/forms/online-connect -H "Origin: http://localhost:4321" -F "name=Test" -F "email=t@x.com" -F "location=Accra" -F "cf-turnstile-response=x"
curl -s -o /dev/null -X POST http://localhost:4321/api/forms/prayer -H "Origin: http://localhost:4321" -F "request=Please pray" -F "cf-turnstile-response=x"
curl -s http://localhost:4321/admin/live | grep -o 'Accra\|Please pray' | head -2
# reset + cleanup
npx wrangler d1 execute kharisbuilders --local --command "DELETE FROM online_attendances; DELETE FROM prayer_requests; DELETE FROM site_settings WHERE key LIKE 'live_%';"
```
Expected: live page 200; status JSON; forcing live + a stream URL shows the embed and `isLive:true`; connect + prayer submissions appear in Admin → Live.
- [ ] **Step 4: Clean tree.**

---

## Done — Definition of Done
- `/live` shows the stream + chat + connect + Give/Prayer + bulletin when live (override or scheduled window in church time), and a countdown + latest message + the same actions when offline; it polls and flips automatically.
- Online connect + prayer capture work (Turnstile-protected) and appear in Admin → Live, where staff set the stream, Auto/Live/Off, duration, bulletin, and toggles.
- "Watch" in the public nav.
- `npx vitest run` + `npm run build` pass; dev round-trip verified.

**Next (optional):** native real-time chat (Durable Objects), then Community & Care (public prayer wall + groups + serve), Member Accounts, PWA + push.

---

## Open Questions (resolved defaults)
- Church time via `live_tz_offset_min` (default 0 = Accra). Stream in settings; YouTube-first; generic iframe fallback. Prayer is private capture (public wall later). Page freshness via 30s poll → reload on change.
