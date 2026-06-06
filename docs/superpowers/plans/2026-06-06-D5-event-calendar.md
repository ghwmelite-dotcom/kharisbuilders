# D5: Event Add-to-Calendar (.ics + Google) + Spots-Left Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make published events savable to a personal calendar (downloadable `.ics` + Google Calendar link) on each event detail page and in the post-registration confirmation, and show remaining capacity ("N spots left").

**Architecture:** One pure, unit-tested module (`src/lib/events/calendar.ts`) builds RFC-5545 `.ics` text and a Google Calendar URL, anchoring the church's naive local event times to UTC via `CHURCH.timezoneOffsetMin`. A `GET` endpoint streams the `.ics`; the existing event detail page gains the calendar buttons (two places) and a spots-left count. No migrations, no admin, no new feature flag — builds on the existing `events` feature.

**Tech Stack:** Astro 6 SSR, Cloudflare D1 (read-only here), Vitest. Spec: `docs/superpowers/specs/2026-06-06-D5-event-calendar-design.md`.

**Working dir:** `C:\dev\Projects\KharisBuilders Project\stitch_kharisbuilders_church_web_design`.

---

## File Structure

```
src/lib/events/calendar.ts          # CREATE — .ics + Google URL builders (Task 1)
tests/events/calendar.test.ts       # CREATE — pure unit tests (Task 1)
src/pages/events/[slug].ics.ts      # CREATE — GET endpoint streaming text/calendar (Task 2)
src/pages/events/[slug].astro       # MODIFY — calendar block x2 + spots-left (Task 3)
```

Existing types/functions reused (do not redefine): `EventRow` from `src/lib/db/events.ts`; `getEventBySlug(db, slug)` (returns published-only or null); `countRegistrations(db, eventId)` from `src/lib/db/registrations.ts`; `CHURCH` + `feature` from `src/config/church.ts`; `SITE` from `src/lib/seo.ts`.

---

## Task 1: Calendar module (pure core)

**Files:** Create `src/lib/events/calendar.ts`, `tests/events/calendar.test.ts`.

- [ ] **Step 1: Branch**

Run: `git status --short && git rev-parse --abbrev-ref HEAD` → empty, `main`. Then `git checkout -b feat/D5-event-calendar`.

- [ ] **Step 2: Write the failing test** `tests/events/calendar.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { toIcsUtc, icsEscape, buildIcs, googleCalendarUrl } from '../../src/lib/events/calendar';
import type { EventRow } from '../../src/lib/db/events';

const ev = (over: Partial<EventRow> = {}): EventRow => ({
  id: 1,
  title: 'Summer Conference',
  slug: 'summer-conference',
  category: 'Conference',
  description: 'A great time.',
  start_at: '2026-07-01T18:00',
  end_at: '2026-07-01T20:30',
  location: 'Main Hall',
  image_key: null,
  registration_enabled: 1,
  capacity: 100,
  ...over,
});

describe('toIcsUtc', () => {
  it('converts naive local time to UTC using the offset', () => {
    expect(toIcsUtc('2026-07-01T18:00', 0)).toBe('20260701T180000Z');
    expect(toIcsUtc('2026-07-01T18:00', 60)).toBe('20260701T170000Z'); // local is +60min ahead of UTC
    expect(toIcsUtc('2026-07-01T18:00:45', 0)).toBe('20260701T180045Z'); // tolerates seconds
  });
});

describe('icsEscape', () => {
  it('escapes commas, semicolons, backslashes, and newlines', () => {
    expect(icsEscape('a, b; c\\d\ne')).toBe('a\\, b\\; c\\\\d\\ne');
  });
});

describe('buildIcs', () => {
  it('builds a valid VEVENT with escaped fields and a stable UID', () => {
    const out = buildIcs(ev({ title: 'Praise, Worship\nNight' }), 'https://church.example', 0);
    expect(out).toContain('BEGIN:VCALENDAR');
    expect(out).toContain('BEGIN:VEVENT');
    expect(out).toContain('UID:event-1@church.example');
    expect(out).toContain('DTSTART:20260701T180000Z');
    expect(out).toContain('DTEND:20260701T203000Z');
    expect(out).toContain('SUMMARY:Praise\\, Worship\\nNight');
    expect(out).toContain('URL:https://church.example/events/summer-conference');
    expect(out).toContain('END:VCALENDAR');
  });
  it('defaults DTEND to start + 2h when end_at is null', () => {
    const out = buildIcs(ev({ end_at: null }), 'https://church.example', 0);
    expect(out).toContain('DTSTART:20260701T180000Z');
    expect(out).toContain('DTEND:20260701T200000Z');
  });
});

describe('googleCalendarUrl', () => {
  it('builds a render URL with UTC dates and the title', () => {
    const url = googleCalendarUrl(ev(), 'https://church.example', 0);
    expect(url.startsWith('https://calendar.google.com/calendar/render?')).toBe(true);
    expect(url).toContain('dates=');
    expect(url).toContain('20260701T180000Z');
    expect(url).toContain('20260701T203000Z');
    expect(url).toContain('text=Summer+Conference');
  });
});
```

- [ ] **Step 3: Run → fail**

Run: `npx vitest run tests/events/calendar.test.ts`
Expected: FAIL (cannot import).

- [ ] **Step 4: Create `src/lib/events/calendar.ts`**

```ts
import type { EventRow } from '../db/events';

const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours when no end_at

/** Parse a naive "YYYY-MM-DDTHH:MM(:SS)?" local wall-clock string into a UTC instant (ms). */
function toUtcMs(naive: string, tzOffsetMin: number): number {
  const m = naive.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return NaN;
  const [, y, mo, d, h, mi, s] = m;
  return Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), s ? Number(s) : 0) - tzOffsetMin * 60000;
}

function fmtUtc(ms: number): string {
  const dt = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dt.getUTCFullYear()}${p(dt.getUTCMonth() + 1)}${p(dt.getUTCDate())}T${p(dt.getUTCHours())}${p(dt.getUTCMinutes())}${p(dt.getUTCSeconds())}Z`;
}

/** Naive local datetime -> "YYYYMMDDTHHMMSSZ" (UTC). */
export function toIcsUtc(naive: string, tzOffsetMin: number): string {
  return fmtUtc(toUtcMs(naive, tzOffsetMin));
}

/** RFC-5545 text escaping. */
export function icsEscape(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function startEndUtc(event: EventRow, tzOffsetMin: number): { start: string; end: string } {
  const startMs = toUtcMs(event.start_at, tzOffsetMin);
  const endMs = event.end_at ? toUtcMs(event.end_at, tzOffsetMin) : startMs + DEFAULT_DURATION_MS;
  return { start: fmtUtc(startMs), end: fmtUtc(endMs) };
}

/** Build a single-event VCALENDAR string (CRLF line endings). */
export function buildIcs(event: EventRow, origin: string, tzOffsetMin: number): string {
  const host = new URL(origin).host;
  const { start, end } = startEndUtc(event, tzOffsetMin);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${host}//Events//EN`,
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:event-${event.id}@${host}`,
    `DTSTAMP:${start}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${icsEscape(event.title)}`,
    `DESCRIPTION:${icsEscape(event.description ?? '')}`,
    `LOCATION:${icsEscape(event.location ?? '')}`,
    `URL:${origin}/events/${event.slug}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}

/** Build a Google Calendar "render" template URL with UTC dates. */
export function googleCalendarUrl(event: EventRow, origin: string, tzOffsetMin: number): string {
  const { start, end } = startEndUtc(event, tzOffsetMin);
  const eventUrl = `${origin}/events/${event.slug}`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${start}/${end}`,
    details: `${event.description ?? ''}\n\n${eventUrl}`.trim(),
    location: event.location ?? '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
```

- [ ] **Step 5: Run → pass**

Run: `npx vitest run tests/events/calendar.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/events/calendar.ts tests/events/calendar.test.ts
git commit -m "feat: event calendar module (.ics + Google URL, UTC-anchored)"
```

---

## Task 2: `.ics` endpoint

**Files:** Create `src/pages/events/[slug].ics.ts`.

- [ ] **Step 1: Create `src/pages/events/[slug].ics.ts`**

```ts
import type { APIRoute } from 'astro';
import { env } from '../../lib/runtime';
import { getEventBySlug } from '../../lib/db/events';
import { buildIcs } from '../../lib/events/calendar';
import { CHURCH, feature } from '../../config/church';
import { SITE } from '../../lib/seo';

export const GET: APIRoute = async ({ params, url, site }) => {
  if (!feature('events')) return new Response('Not found', { status: 404 });
  const slug = params.slug;
  if (!slug) return new Response('Not found', { status: 404 });

  const event = await getEventBySlug(env.DB, slug).catch(() => null);
  if (!event) return new Response('Not found', { status: 404 });

  const origin = (site ?? new URL(SITE.url)).origin || url.origin;
  const body = buildIcs(event, origin, CHURCH.timezoneOffsetMin);
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}.ics"`,
      'Cache-Control': 'public, max-age=300',
    },
  });
};
```

- [ ] **Step 2: Build**

Run: `npx astro build`
Expected: `Complete!` (the new route `/events/[slug].ics` is registered).

- [ ] **Step 3: Commit**

```bash
git add "src/pages/events/[slug].ics.ts"
git commit -m "feat: /events/<slug>.ics calendar download endpoint"
```

---

## Task 3: Event detail page — calendar buttons + spots-left

**Files:** Modify `src/pages/events/[slug].astro`.

The current file (read it first to match exact text) has this frontmatter tail and registration block. Make three edits.

- [ ] **Step 1: Add imports + computed values to the frontmatter.** In `src/pages/events/[slug].astro`, the import block currently ends with `import { feature } from '../../config/church';`. Change that line to also import `CHURCH`, and add the calendar import:

```ts
import { feature, CHURCH } from '../../config/church';
import { googleCalendarUrl } from '../../lib/events/calendar';
```

- [ ] **Step 2: Replace the `isFull` computation with a `remaining` count.** Find this block:

```ts
let isFull = false;
if (event.registration_enabled && event.capacity != null) {
  try {
    isFull = (await countRegistrations(env.DB, event.id)) >= event.capacity;
  } catch {
    isFull = false;
  }
}
```

Replace it with:

```ts
let remaining: number | null = null; // null = unlimited / not tracked
if (event.registration_enabled && event.capacity != null) {
  try {
    remaining = Math.max(0, event.capacity - (await countRegistrations(env.DB, event.id)));
  } catch {
    remaining = null;
  }
}
const isFull = remaining === 0;
```

- [ ] **Step 3: Add the calendar href + Google URL after the existing `heroImg`/`eventNode` lines.** Find:

```ts
const origin = (Astro.site ?? new URL(SITE.url)).origin;
const eventNode = eventJsonLd(origin, event);
```

Immediately after, add:

```ts
const icsHref = `/events/${event.slug}.ics`;
const gcalUrl = googleCalendarUrl(event, origin, CHURCH.timezoneOffsetMin);
```

- [ ] **Step 4: Insert the reusable calendar block markup + wire it into the sidebar card and confirmation.** Replace the entire sidebar `<div class="md:col-span-5">…</div>` block (currently lines ~62–89, from `<div class="md:col-span-5">` through its closing `</div>` before `</section>`) with this version (adds an Add-to-Calendar panel above the registration card, the spots-left line, and the calendar links inside the registered confirmation):

```astro
    <div class="md:col-span-5 space-y-6">
      <div class="bg-surface-container-lowest border border-champagne p-6">
        <p class="font-label-sm uppercase tracking-widest text-heritage-gold mb-3">Add to calendar</p>
        <div class="flex flex-wrap gap-3">
          <a href={icsHref} class="font-body text-body-md text-primary border border-champagne px-4 py-2 hover:border-heritage-gold transition-colors">Apple / Outlook (.ics)</a>
          <a href={gcalUrl} target="_blank" rel="noopener" class="font-body text-body-md text-primary border border-champagne px-4 py-2 hover:border-heritage-gold transition-colors">Google Calendar</a>
        </div>
      </div>
      <div class="bg-surface-container p-8 md:p-10 elev-2">
        {
          !event.registration_enabled ? (
            <p class="font-body text-body-md text-stone-gray">Registration isn't required for this event — just come along!</p>
          ) : registered ? (
            <div class="space-y-4">
              <p class="font-display text-headline-md text-primary">You're registered — see you there!</p>
              <p class="font-body text-body-md text-stone-gray">Save the date:</p>
              <div class="flex flex-wrap gap-3">
                <a href={icsHref} class="font-body text-body-md text-primary border border-champagne px-4 py-2 hover:border-heritage-gold transition-colors">Apple / Outlook (.ics)</a>
                <a href={gcalUrl} target="_blank" rel="noopener" class="font-body text-body-md text-primary border border-champagne px-4 py-2 hover:border-heritage-gold transition-colors">Google Calendar</a>
              </div>
            </div>
          ) : isFull || fullParam ? (
            <p class="font-display text-headline-md text-primary">This event is full. Please contact us to join the waitlist.</p>
          ) : (
            <div class="space-y-6">
              <h2 class="font-display text-headline-md text-primary">Reserve your place</h2>
              {remaining != null && (
                <p class="font-body text-body-md text-heritage-gold">{remaining} {remaining === 1 ? 'spot' : 'spots'} left</p>
              )}
              <form method="POST" action="/api/forms/register" class="space-y-6">
                <input type="hidden" name="event_id" value={String(event.id)} />
                <Field label="Full Name" name="name" required />
                <Field label="Email Address" name="email" type="email" required />
                <Field label="Phone (optional)" name="phone" type="tel" />
                <Field label="Number of guests" name="guests" type="number" min={0} max={20} />
                <div class="cf-turnstile" data-sitekey={siteKey} />
                <button type="submit" class="w-full bg-midnight-blue text-white font-label-md uppercase tracking-widest py-4 border-b-2 border-transparent hover:border-heritage-gold transition-all">
                  Register
                </button>
              </form>
            </div>
          )
        }
      </div>
    </div>
```

- [ ] **Step 5: Build**

Run: `npx astro build`
Expected: `Complete!`.

- [ ] **Step 6: Commit**

```bash
git add "src/pages/events/[slug].astro"
git commit -m "feat: event page add-to-calendar buttons + spots-left count"
```

---

## Task 4: Final gate

- [ ] **Step 1: Full suite**

Run: `npx vitest run`
Expected: PASS — prior 258 + 5 new = 263, all green.

> Note: the spec estimated ~261; the calendar test file holds 5 cases (toIcsUtc, icsEscape, buildIcs ×2, googleCalendarUrl), so the real total is 263. Either way, all green is the gate.

- [ ] **Step 2: Build**

Run: `npx astro build`
Expected: `Complete!`.

- [ ] **Step 3: Clean tree**

Run: `git status --short`
Expected: empty.

---

## Task 5: Finish

- [ ] **Step 1:** Announce: "I'm using the finishing-a-development-branch skill to complete this work."
- [ ] **Step 2:** REQUIRED SUB-SKILL: superpowers:finishing-a-development-branch → merge `feat/D5-event-calendar` → `main`.

> **Ship-to-Kharis follow-up:** `git checkout kharis && git merge main`; `npm run build && npx wrangler deploy` (wrangler is authed to the Missdiasporagh account that owns Kharis); verify a published event's calendar download: `curl -sI https://kharisbuilders.missdiasporagh.workers.dev/events/<slug>.ics` returns `content-type: text/calendar`. **No migrations** for D5.
>
> To find a real slug for the smoke test: `curl -s https://kharisbuilders.missdiasporagh.workers.dev/events | grep -o '/events/[a-z0-9-]\+' | head -1`.

---

## Definition of Done
- `/events/<slug>.ics` returns a valid `text/calendar` attachment for a published event (404 for unknown/unpublished or when `events` is off).
- The event detail page shows an Add-to-Calendar panel (.ics + Google) for every event, and again inside the registered-confirmation state.
- When registration is enabled with a capacity, the page shows "N spots left" (0 → the full message).
- `npx vitest run` green (263); `npx astro build` passes.
- Merges to `main`; ships to Kharis via the follow-up above. No migrations.

**Next:** D5 completes roadmap D. Standing items: live-Kharis AI reindex + Turnstile key check; `docs/GO-LIVE.md` runbook; or roadmap F (member accounts) / G (PWA + push).
```
