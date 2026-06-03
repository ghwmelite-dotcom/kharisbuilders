# Phase 3A: Sermons & Events Data Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the D1 data layer for sermons, events, and event registrations — migrations, tested data-access modules, a tested YouTube/Vimeo embed helper, and seed data — so Phase 3B can build the public Sermons/Events pages and registration form on top.

**Architecture:** Same proven pattern as Phase 2A. Each domain gets a focused module under `src/lib/db/` taking `D1Database` as the first arg (pure, prepared-statements-only, Miniflare-tested). Sermons and events carry a unique `slug` for SEO-friendly detail routes. A pure `src/lib/video.ts` converts a watch URL + provider into an embeddable player URL (unit-tested, no network). Seed reuses `db/seed.sql` conventions but in a new `db/seed_sermons_events.sql` applied via `wrangler d1 execute --file`.

**Tech Stack:** Cloudflare D1, `wrangler d1 migrations`, Zod, Vitest + Miniflare harness (`tests/helpers/d1.ts`).

**Working directory:** `C:\dev\Projects\KharisBuilders Project\stitch_kharisbuilders_church_web_design` (git repo, branch off `main`).

> **Binding rule (Astro 6):** data-access modules take `db` as a param and are tested with Miniflare — they NEVER import `cloudflare:workers`. Only .astro pages/routes import `env` from `src/lib/runtime.ts` (Phase 3B). Reference the data model in `docs/superpowers/specs/2026-06-02-kharisbuilders-fullstack-design.md` §5; sermon/event mockups for fields (`manage_sermons_admin_portal/code.html`, `manage_events_admin_portal/code.html`, `home_kharisbuilders/code.html`).

---

## File Structure (created in this phase)

```
migrations/0004_sermons.sql            # sermons table (with slug)
migrations/0005_events.sql             # events table (with slug)
migrations/0006_event_registrations.sql
db/seed_sermons_events.sql             # seed sermons + events (NOT a migration)
src/lib/video.ts                       # toEmbedUrl(provider, url) -> string | null
src/lib/db/sermons.ts                  # listPublishedSermons, getSermonBySlug, type Sermon
src/lib/db/events.ts                   # listUpcomingEvents, getEventBySlug, type EventRow
src/lib/db/registrations.ts            # createRegistration, countRegistrations
src/lib/db/schemas.ts                  # MODIFY: add RegistrationInputSchema
tests/video.test.ts
tests/db/sermons.test.ts
tests/db/events.test.ts
tests/db/registrations.test.ts
```

---

## Task 1: Video embed helper (TDD)

**Files:**
- Create: `src/lib/video.ts`, `tests/video.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/video.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { toEmbedUrl } from '../src/lib/video';

describe('toEmbedUrl', () => {
  it('builds a YouTube embed URL from watch and short links', () => {
    expect(toEmbedUrl('youtube', 'https://www.youtube.com/watch?v=abc123XYZ_-')).toBe('https://www.youtube.com/embed/abc123XYZ_-');
    expect(toEmbedUrl('youtube', 'https://youtu.be/abc123XYZ_-')).toBe('https://www.youtube.com/embed/abc123XYZ_-');
  });

  it('builds a Vimeo embed URL', () => {
    expect(toEmbedUrl('vimeo', 'https://vimeo.com/123456789')).toBe('https://player.vimeo.com/video/123456789');
  });

  it('returns null for an unparseable URL', () => {
    expect(toEmbedUrl('youtube', 'https://example.com/nope')).toBeNull();
    expect(toEmbedUrl('vimeo', 'not a url')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run tests/video.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/video.ts`**

```ts
export type VideoProvider = 'youtube' | 'vimeo';

export function toEmbedUrl(provider: VideoProvider, url: string): string | null {
  if (provider === 'youtube') {
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return m ? `https://www.youtube.com/embed/${m[1]}` : null;
  }
  if (provider === 'vimeo') {
    const m = url.match(/vimeo\.com\/(\d+)/);
    return m ? `https://player.vimeo.com/video/${m[1]}` : null;
  }
  return null;
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
npx vitest run tests/video.test.ts
```
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/video.ts tests/video.test.ts
git commit -m "feat: YouTube/Vimeo embed URL helper with tests"
```

---

## Task 2: sermons — migration + data access (TDD)

**Files:**
- Create: `migrations/0004_sermons.sql`, `src/lib/db/sermons.ts`, `tests/db/sermons.test.ts`

- [ ] **Step 1: Create the migration**

Create `migrations/0004_sermons.sql`:
```sql
CREATE TABLE IF NOT EXISTS sermons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  speaker TEXT,
  series TEXT,
  scripture_ref TEXT,
  video_url TEXT NOT NULL,
  video_provider TEXT NOT NULL DEFAULT 'youtube',
  thumbnail_key TEXT,
  description TEXT,
  sermon_date TEXT,
  published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);
```

- [ ] **Step 2: Apply locally**

```bash
npx wrangler d1 migrations apply kharisbuilders --local
```

- [ ] **Step 3: Write the failing test**

Create `tests/db/sermons.test.ts`:
```ts
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { listPublishedSermons, getSermonBySlug } from '../../src/lib/db/sermons';

let ctx: TestDb;
beforeAll(async () => { ctx = await createTestDb(); });
afterAll(async () => { await ctx.dispose(); });

describe('sermons data access', () => {
  it('lists only published sermons, newest first', async () => {
    await ctx.db.batch([
      ctx.db.prepare("INSERT INTO sermons (title, slug, video_url, sermon_date, published) VALUES ('Old', 'old', 'u', '2024-01-01', 1)"),
      ctx.db.prepare("INSERT INTO sermons (title, slug, video_url, sermon_date, published) VALUES ('New', 'new', 'u', '2024-06-01', 1)"),
      ctx.db.prepare("INSERT INTO sermons (title, slug, video_url, sermon_date, published) VALUES ('Draft', 'draft', 'u', '2024-07-01', 0)"),
    ]);
    const list = await listPublishedSermons(ctx.db);
    expect(list.map((s) => s.slug)).toEqual(['new', 'old']);
  });

  it('fetches a published sermon by slug, and null for missing/unpublished', async () => {
    expect((await getSermonBySlug(ctx.db, 'new'))?.title).toBe('New');
    expect(await getSermonBySlug(ctx.db, 'draft')).toBeNull();
    expect(await getSermonBySlug(ctx.db, 'missing')).toBeNull();
  });
});
```

- [ ] **Step 4: Run to verify it fails**

```bash
npx vitest run tests/db/sermons.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 5: Implement `src/lib/db/sermons.ts`**

```ts
import type { VideoProvider } from '../video';

export interface Sermon {
  id: number;
  title: string;
  slug: string;
  speaker: string | null;
  series: string | null;
  scripture_ref: string | null;
  video_url: string;
  video_provider: VideoProvider;
  thumbnail_key: string | null;
  description: string | null;
  sermon_date: string | null;
}

const COLS =
  'id, title, slug, speaker, series, scripture_ref, video_url, video_provider, thumbnail_key, description, sermon_date';

export async function listPublishedSermons(db: D1Database, limit = 50): Promise<Sermon[]> {
  const { results } = await db
    .prepare(`SELECT ${COLS} FROM sermons WHERE published = 1 ORDER BY sermon_date DESC, id DESC LIMIT ?`)
    .bind(limit)
    .all<Sermon>();
  return results;
}

export async function getSermonBySlug(db: D1Database, slug: string): Promise<Sermon | null> {
  const row = await db
    .prepare(`SELECT ${COLS} FROM sermons WHERE slug = ? AND published = 1`)
    .bind(slug)
    .first<Sermon>();
  return row ?? null;
}
```

- [ ] **Step 6: Run to verify it passes**

```bash
npx vitest run tests/db/sermons.test.ts
```
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add migrations/0004_sermons.sql src/lib/db/sermons.ts tests/db/sermons.test.ts
git commit -m "feat: sermons table and data access with D1 tests"
```

---

## Task 3: events — migration + data access (TDD)

**Files:**
- Create: `migrations/0005_events.sql`, `src/lib/db/events.ts`, `tests/db/events.test.ts`

- [ ] **Step 1: Create the migration**

Create `migrations/0005_events.sql`:
```sql
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT,
  description TEXT,
  start_at TEXT NOT NULL,
  end_at TEXT,
  location TEXT,
  image_key TEXT,
  registration_enabled INTEGER NOT NULL DEFAULT 0,
  capacity INTEGER,
  published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);
```

- [ ] **Step 2: Apply locally**

```bash
npx wrangler d1 migrations apply kharisbuilders --local
```

- [ ] **Step 3: Write the failing test**

Create `tests/db/events.test.ts`:
```ts
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { listUpcomingEvents, getEventBySlug } from '../../src/lib/db/events';

let ctx: TestDb;
beforeAll(async () => { ctx = await createTestDb(); });
afterAll(async () => { await ctx.dispose(); });

describe('events data access', () => {
  it('lists only published, upcoming events soonest-first', async () => {
    await ctx.db.batch([
      ctx.db.prepare("INSERT INTO events (title, slug, start_at, published) VALUES ('Past', 'past', '2000-01-01 10:00:00', 1)"),
      ctx.db.prepare("INSERT INTO events (title, slug, start_at, published) VALUES ('Soon', 'soon', '2999-01-01 10:00:00', 1)"),
      ctx.db.prepare("INSERT INTO events (title, slug, start_at, published) VALUES ('Later', 'later', '2999-06-01 10:00:00', 1)"),
      ctx.db.prepare("INSERT INTO events (title, slug, start_at, published) VALUES ('Draft', 'draft', '2999-02-01 10:00:00', 0)"),
    ]);
    const list = await listUpcomingEvents(ctx.db);
    expect(list.map((e) => e.slug)).toEqual(['soon', 'later']);
  });

  it('fetches a published event by slug, null for missing/unpublished', async () => {
    expect((await getEventBySlug(ctx.db, 'soon'))?.title).toBe('Soon');
    expect(await getEventBySlug(ctx.db, 'draft')).toBeNull();
  });
});
```

- [ ] **Step 4: Run to verify it fails**

```bash
npx vitest run tests/db/events.test.ts
```
Expected: FAIL.

- [ ] **Step 5: Implement `src/lib/db/events.ts`**

```ts
export interface EventRow {
  id: number;
  title: string;
  slug: string;
  category: string | null;
  description: string | null;
  start_at: string;
  end_at: string | null;
  location: string | null;
  image_key: string | null;
  registration_enabled: number;
  capacity: number | null;
}

const COLS =
  'id, title, slug, category, description, start_at, end_at, location, image_key, registration_enabled, capacity';

export async function listUpcomingEvents(db: D1Database, limit = 50): Promise<EventRow[]> {
  const { results } = await db
    .prepare(
      `SELECT ${COLS} FROM events
       WHERE published = 1 AND start_at >= datetime('now')
       ORDER BY start_at ASC LIMIT ?`,
    )
    .bind(limit)
    .all<EventRow>();
  return results;
}

export async function getEventBySlug(db: D1Database, slug: string): Promise<EventRow | null> {
  const row = await db
    .prepare(`SELECT ${COLS} FROM events WHERE slug = ? AND published = 1`)
    .bind(slug)
    .first<EventRow>();
  return row ?? null;
}
```

- [ ] **Step 6: Run to verify it passes**

```bash
npx vitest run tests/db/events.test.ts
```
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add migrations/0005_events.sql src/lib/db/events.ts tests/db/events.test.ts
git commit -m "feat: events table and data access with D1 tests"
```

---

## Task 4: event_registrations — migration + schema + data access (TDD)

**Files:**
- Create: `migrations/0006_event_registrations.sql`, `src/lib/db/registrations.ts`, `tests/db/registrations.test.ts`
- Modify: `src/lib/db/schemas.ts`

- [ ] **Step 1: Create the migration**

Create `migrations/0006_event_registrations.sql`:
```sql
CREATE TABLE IF NOT EXISTS event_registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  guests INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_event_registrations_event ON event_registrations(event_id);
```

- [ ] **Step 2: Apply locally**

```bash
npx wrangler d1 migrations apply kharisbuilders --local
```

- [ ] **Step 3: Add `RegistrationInputSchema` to `src/lib/db/schemas.ts`**

Append:
```ts
export const RegistrationInputSchema = z.object({
  event_id: z.coerce.number().int().positive(),
  name: z.string().trim().min(1, 'Please enter your name').max(120),
  email: z.string().trim().email('Please enter a valid email').max(200),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  guests: z.coerce.number().int().min(0).max(20).default(0),
});

export type RegistrationInput = z.infer<typeof RegistrationInputSchema>;
```

- [ ] **Step 4: Write the failing test**

Create `tests/db/registrations.test.ts`:
```ts
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { createRegistration, countRegistrations } from '../../src/lib/db/registrations';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
  await ctx.db.prepare("INSERT INTO events (id, title, slug, start_at, published, registration_enabled) VALUES (1, 'Gala', 'gala', '2999-01-01 10:00:00', 1, 1)").run();
});
afterAll(async () => { await ctx.dispose(); });

describe('registrations data access', () => {
  it('creates a registration and counts guests + registrations', async () => {
    const id = await createRegistration(ctx.db, { event_id: 1, name: 'Ada', email: 'ada@x.org', phone: '', guests: 2 });
    expect(id).toBeGreaterThan(0);
    expect(await countRegistrations(ctx.db, 1)).toBe(3); // 1 registrant + 2 guests
  });
});
```

- [ ] **Step 5: Run to verify it fails**

```bash
npx vitest run tests/db/registrations.test.ts
```
Expected: FAIL.

- [ ] **Step 6: Implement `src/lib/db/registrations.ts`**

```ts
import type { RegistrationInput } from './schemas';

export async function createRegistration(db: D1Database, input: RegistrationInput): Promise<number> {
  const result = await db
    .prepare('INSERT INTO event_registrations (event_id, name, email, phone, guests) VALUES (?, ?, ?, ?, ?)')
    .bind(input.event_id, input.name, input.email, input.phone || null, input.guests)
    .run();
  return Number(result.meta.last_row_id);
}

/** Total seats taken for an event: one per registrant plus their guests. */
export async function countRegistrations(db: D1Database, eventId: number): Promise<number> {
  const row = await db
    .prepare('SELECT COUNT(*) + COALESCE(SUM(guests), 0) AS taken FROM event_registrations WHERE event_id = ?')
    .bind(eventId)
    .first<{ taken: number }>();
  return Number(row?.taken ?? 0);
}
```

- [ ] **Step 7: Run to verify it passes**

```bash
npx vitest run tests/db/registrations.test.ts
```
Expected: PASS (1 test).

- [ ] **Step 8: Commit**

```bash
git add migrations/0006_event_registrations.sql src/lib/db/registrations.ts src/lib/db/schemas.ts tests/db/registrations.test.ts
git commit -m "feat: event_registrations table, schema, and data access with D1 tests"
```

---

## Task 5: Seed sermons + events; apply to remote D1

**Files:**
- Create: `db/seed_sermons_events.sql`

- [ ] **Step 1: Create the seed file**

Create `db/seed_sermons_events.sql` (placeholder content; staff edit via admin in Phase 4):
```sql
INSERT OR IGNORE INTO sermons (title, slug, speaker, series, scripture_ref, video_url, video_provider, description, sermon_date, published) VALUES
  ('The Architecture of Faith: Part IV', 'architecture-of-faith-4', 'Lead Pastor', 'Architecture of Faith', 'Hebrews 11', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube', 'Building a life that lasts on an unshakeable foundation.', '2024-10-27', 1),
  ('A Place to Belong', 'a-place-to-belong', 'Lead Pastor', 'Foundations', 'Psalm 133', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube', 'Why community is the heart of the church.', '2024-10-20', 1),
  ('Grace That Builds', 'grace-that-builds', 'Guest Speaker', 'Foundations', 'Ephesians 2', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube', 'Grace is the foundation every destiny is built on.', '2024-10-13', 1);

INSERT OR IGNORE INTO events (title, slug, category, description, start_at, location, registration_enabled, capacity, published) VALUES
  ('First Steps Luncheon', 'first-steps-luncheon', 'Community', 'For our new members to meet the leadership team and understand our vision.', '2999-11-03 12:30:00', 'The Glass Atrium', 1, 60, 1),
  ('Night of Adoration', 'night-of-adoration', 'Worship', 'An immersive acoustic worship experience designed for deep spiritual renewal.', '2999-11-08 19:00:00', 'Main Auditorium', 1, 200, 1),
  ('Builders Masterclass', 'builders-masterclass', 'Leadership', 'Developing practical leadership skills rooted in eternal biblical principles.', '2999-11-15 10:00:00', 'Chapel', 0, NULL, 1);
```

- [ ] **Step 2: Apply locally + remote, verify**

Local tables already exist (Tasks 2–4 applied migrations `--local`). Remote migrations have NOT been applied yet, so apply them to remote BEFORE seeding remote:
```bash
# Local: seed (schema already applied locally)
npx wrangler d1 execute kharisbuilders --local --file db/seed_sermons_events.sql
# Remote: migrations FIRST, then seed
npx wrangler d1 migrations apply kharisbuilders --remote
npx wrangler d1 execute kharisbuilders --remote --file db/seed_sermons_events.sql
# Verify remote
npx wrangler d1 execute kharisbuilders --remote --command "SELECT (SELECT COUNT(*) FROM sermons) AS sermons, (SELECT COUNT(*) FROM events) AS events;"
```
Expected: `sermons` = 3, `events` = 3.

- [ ] **Step 3: Commit**

```bash
git add db/seed_sermons_events.sql
git commit -m "feat: seed sermons and events; apply to remote D1"
```

---

## Task 6: Full gate

- [ ] **Step 1: Run the full suite**

```bash
npx vitest run
```
Expected: prior 18 + video (3) + sermons (2) + events (2) + registrations (1) = 26 passing.

- [ ] **Step 2: Build**

```bash
npm run build
```
Expected: succeeds.

- [ ] **Step 3: Confirm clean tree**

```bash
git status --short
```

---

## Phase 3A Done — Definition of Done
- `migrations/0004–0006` create sermons, events, event_registrations; applied local + remote; remote counts verified (3 sermons, 3 events).
- `src/lib/db/{sermons,events,registrations}.ts` + `src/lib/video.ts` implemented and Miniflare/unit-tested.
- `npx vitest run` (26 tests) and `npm run build` pass.

**Next:** Phase 3B — public Sermons (list + detail with embedded player), Events (list + detail), and the event registration form (reusing the Phase-2B Turnstile + handler pattern, plus capacity check via `countRegistrations`).

---

## Open Questions (non-blocking)
- Slug generation strategy for admin-created sermons/events (Phase 4): slugify(title) + uniqueness suffix. For now slugs are hand-set in seed.
- Whether to also expose past sermons via pagination (Phase 3B uses a simple `limit`; pagination can come later).
