# Phase 2A: Data Layer & Foundation Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the D1 data layer (migrations, seed, tested data-access modules) for the three content domains the public site reads/writes — site settings, ministries, visitors — and finish the two Phase-1 deferrals (self-hosted fonts, functional mobile menu) that the public pages depend on.

**Architecture:** D1 schema is managed with `wrangler d1 migrations` (numbered SQL in `migrations/`). Each domain gets a focused data-access module under `src/lib/db/` exposing small, prepared-statement functions that take the `D1Database` binding as their first argument (pure, testable, no Astro coupling). Zod schemas validate all writes. D1-backed logic is tested with `@cloudflare/vitest-pool-workers`, which runs tests inside a Workers runtime with a real local D1 — kept as a SEPARATE vitest project so the existing fast node-environment unit tests are untouched.

**Tech Stack:** Cloudflare D1 + `wrangler d1 migrations`, `@cloudflare/vitest-pool-workers`, Zod, Astro 6.

**Working directory:** `C:\dev\Projects\KharisBuilders Project\stitch_kharisbuilders_church_web_design` (git repo, branch off `main`).

**Prerequisites already done (Phase 1 + setup):** D1 `kharisbuilders` (binding `DB`, id `1f3056ca-a44d-4a63-bfbf-c38ba9fb957b`) and R2 `kharisbuilders-media` (binding `MEDIA`) exist; `wrangler.jsonc` declares them; `getBindings(locals)` returns the typed `Env`. Wrangler is authenticated as `missdiasporagh@gmail.com`.

> **Reference while building:** `visit_us_kharisbuilders/code.html` (service times, address, the visit form fields: Full Name / Email / "I'm coming on..." service select), `ministries_kharisbuilders/code.html` (ministry card shape), and the data model in `docs/superpowers/specs/2026-06-02-kharisbuilders-fullstack-design.md` §5.

---

## File Structure (created in this phase)

```
migrations/0001_site_settings.sql      # site_settings table
migrations/0002_ministries.sql         # ministries table
migrations/0003_visitors.sql           # visitors table
db/seed.sql                            # seed: settings + sample ministries (NOT a migration —
                                       # kept out of migrations/ so D1 tests don't load seed data)
src/lib/db/settings.ts                 # getAllSettings, getSetting, type SettingsMap
src/lib/db/ministries.ts               # listPublishedMinistries, type Ministry
src/lib/db/visitors.ts                 # createVisitor, type VisitorInput; zod schema
src/lib/db/schemas.ts                  # shared zod schemas (VisitorInputSchema, ...)
public/fonts/                          # self-hosted woff2 (Playfair Display, Manrope)
vitest.workers.config.ts               # @cloudflare/vitest-pool-workers project (D1 tests)
tests/workers/settings.test.ts         # D1 integration tests
tests/workers/ministries.test.ts
tests/workers/visitors.test.ts
src/components/Nav.astro               # MODIFY: functional mobile menu
src/styles/global.css                  # MODIFY: real @font-face (woff2)
```

---

## Task 1: Self-hosted webfonts

**Files:**
- Create: `public/fonts/playfair-display-600.woff2`, `public/fonts/playfair-display-700.woff2`, `public/fonts/manrope-400.woff2`, `public/fonts/manrope-500.woff2`, `public/fonts/manrope-600.woff2`, `public/fonts/manrope-700.woff2`
- Modify: `src/styles/global.css`, `src/layouts/PublicLayout.astro`

- [ ] **Step 1: Download the woff2 files into `public/fonts/`**

Use the Google Fonts CSS API to resolve current woff2 URLs, then download. Run (bash):
```bash
mkdir -p public/fonts
# Playfair Display 600, 700 and Manrope 400,500,600,700 — fetch the CSS, extract woff2 URLs, download.
curl -s "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Manrope:wght@400;500;600;700&display=swap" -H "User-Agent: Mozilla/5.0" -o /tmp/fonts.css
grep -oE "https://[^)]+\.woff2" /tmp/fonts.css
```
Download each URL to the matching filename above. If the CSS returns multiple unicode-range subsets, take the `latin` subset (the first block per family/weight). Verify each file is non-empty (`ls -l public/fonts`).

- [ ] **Step 2: Replace the `local()`-only @font-face blocks in `src/styles/global.css`**

Replace the two existing `@font-face` blocks with weight-specific blocks that load the woff2:
```css
@font-face {
  font-family: 'Playfair Display';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: local('Playfair Display'), url('/fonts/playfair-display-600.woff2') format('woff2');
}
@font-face {
  font-family: 'Playfair Display';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: local('Playfair Display'), url('/fonts/playfair-display-700.woff2') format('woff2');
}
@font-face {
  font-family: 'Manrope';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: local('Manrope'), url('/fonts/manrope-400.woff2') format('woff2');
}
@font-face {
  font-family: 'Manrope';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: local('Manrope'), url('/fonts/manrope-500.woff2') format('woff2');
}
@font-face {
  font-family: 'Manrope';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: local('Manrope'), url('/fonts/manrope-600.woff2') format('woff2');
}
@font-face {
  font-family: 'Manrope';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: local('Manrope'), url('/fonts/manrope-700.woff2') format('woff2');
}
```

- [ ] **Step 3: Preload the two most critical fonts in `PublicLayout.astro`**

In the `<head>` (after the `<meta name="description">`), add:
```astro
<link rel="preload" href="/fonts/playfair-display-700.woff2" as="font" type="font/woff2" crossorigin />
<link rel="preload" href="/fonts/manrope-400.woff2" as="font" type="font/woff2" crossorigin />
```

- [ ] **Step 4: Build to verify fonts are emitted and CSS compiles**

Run:
```bash
npm run build
```
Expected: build succeeds; `dist` contains the font files under the assets/public path (Astro copies `public/` verbatim).

- [ ] **Step 5: Commit**

```bash
git add public/fonts src/styles/global.css src/layouts/PublicLayout.astro
git commit -m "feat: self-host Playfair Display and Manrope webfonts"
```

---

## Task 2: Functional mobile menu

**Files:**
- Modify: `src/components/Nav.astro`

- [ ] **Step 1: Replace the placeholder mobile button with a real toggle + panel**

Replace the existing mobile `<button>` and add a slide-down panel. The full updated `Nav.astro`:
```astro
---
import Icon from './Icon.astro';
const links = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Ministries', href: '/ministries' },
  { label: 'Visit', href: '/visit' },
];
---
<header
  id="site-header"
  class="sticky top-0 z-50 border-b border-accent/20 transition-all duration-300"
>
  <nav class="mx-auto flex h-20 max-w-[var(--container-max)] items-center justify-between px-6 md:px-16">
    <a href="/" class="font-[var(--font-display)] text-2xl text-primary">Kharisbuilders</a>
    <div class="hidden items-center gap-10 md:flex">
      {
        links.map((l) => (
          <a
            href={l.href}
            class="text-sm uppercase tracking-wider text-on-surface-variant hover:text-primary transition-colors"
          >
            {l.label}
          </a>
        ))
      }
      <a
        href="/visit"
        class="bg-primary text-on-primary px-6 py-3 text-sm uppercase tracking-wider border-b-2 border-transparent hover:border-accent transition-all"
      >
        New Here?
      </a>
    </div>
    <button
      id="mobile-menu-toggle"
      class="md:hidden text-primary p-2 -mr-2"
      aria-label="Open menu"
      aria-expanded="false"
      aria-controls="mobile-menu"
    >
      <Icon name="menu" />
    </button>
  </nav>
  <div
    id="mobile-menu"
    class="md:hidden hidden border-t border-accent/20 bg-surface px-6 py-4"
  >
    <div class="flex flex-col gap-1">
      {
        links.map((l) => (
          <a
            href={l.href}
            class="py-3 text-sm uppercase tracking-wider text-on-surface-variant hover:text-primary transition-colors"
          >
            {l.label}
          </a>
        ))
      }
      <a
        href="/visit"
        class="mt-2 bg-primary text-on-primary text-center px-6 py-3 text-sm uppercase tracking-wider"
      >
        New Here?
      </a>
    </div>
  </div>
</header>
<script>
  const header = document.getElementById('site-header');
  const onScroll = () => header?.classList.toggle('backdrop-blur-xl', window.scrollY > 50);
  document.addEventListener('scroll', onScroll, { passive: true });

  const toggle = document.getElementById('mobile-menu-toggle');
  const menu = document.getElementById('mobile-menu');
  toggle?.addEventListener('click', () => {
    const open = menu?.classList.toggle('hidden') === false;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
</script>
```

- [ ] **Step 2: Build and verify in preview**

Run `npm run build`, then `npm run preview`. In the browser at a narrow width (<768px via devtools), confirm the menu button toggles the panel open/closed and `aria-expanded` flips. Stop preview.

- [ ] **Step 3: Commit**

```bash
git add src/components/Nav.astro
git commit -m "feat: functional mobile navigation menu"
```

---

## Task 3: D1 test harness (@cloudflare/vitest-pool-workers)

**Files:**
- Create: `vitest.workers.config.ts`, `tests/workers/.gitkeep`
- Modify: `package.json`, `vitest.config.ts`

- [ ] **Step 1: Install the workers test pool**

Run:
```bash
npm install -D @cloudflare/vitest-pool-workers
```

- [ ] **Step 2: Scope the existing node-environment config to exclude the workers tests**

In `vitest.config.ts`, set the include to only the top-level tests (not `tests/workers`):
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/*.test.ts'],
    exclude: ['tests/workers/**'],
  },
});
```

- [ ] **Step 3: Create the workers-pool config bound to wrangler.jsonc**

Create `vitest.workers.config.ts`:
```ts
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    include: ['tests/workers/**/*.test.ts'],
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          // Apply migrations to the local test D1 before tests run (set in Task 4+).
          d1Databases: ['DB'],
        },
      },
    },
  },
});
```

- [ ] **Step 4: Add test scripts**

In `package.json` scripts, add:
```json
"test:workers": "vitest run --config vitest.workers.config.ts",
"test:all": "vitest run && vitest run --config vitest.workers.config.ts"
```
Keep the existing `"test": "vitest run"` (node unit tests).

- [ ] **Step 5: Create the workers test dir and a smoke test proving the DB binding is reachable**

Create `tests/workers/smoke.test.ts`:
```ts
import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';

describe('workers pool', () => {
  it('exposes the DB binding', async () => {
    const { results } = await env.DB.prepare('SELECT 1 as ok').all();
    expect(results[0]).toEqual({ ok: 1 });
  });
});
```

- [ ] **Step 6: Run the workers test to verify the harness works**

Run:
```bash
npm run test:workers
```
Expected: PASS (1 test). If it complains about types for `cloudflare:test`, add `"types": ["@cloudflare/vitest-pool-workers"]` reference — create `tests/workers/env.d.ts` with `/// <reference types="@cloudflare/vitest-pool-workers" />`. Re-run.

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts vitest.workers.config.ts package.json package-lock.json tests/workers
git commit -m "test: add Cloudflare workers-pool vitest harness for D1 tests"
```

---

## Task 4: site_settings — migration, seed, data access (TDD)

**Files:**
- Create: `migrations/0001_site_settings.sql`, `src/lib/db/settings.ts`, `tests/workers/settings.test.ts`

- [ ] **Step 1: Create the migration**

Create `migrations/0001_site_settings.sql`:
```sql
-- Key/value site settings editable by staff (service times, address, socials, contact, default theme).
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- [ ] **Step 2: Apply the migration locally**

Run:
```bash
npx wrangler d1 migrations apply kharisbuilders --local
```
Expected: applies `0001_site_settings.sql` to the local D1. (If wrangler asks for a `migrations_dir`, it defaults to `./migrations`; that matches.)

- [ ] **Step 3: Write the failing D1 test**

Create `tests/workers/settings.test.ts`:
```ts
import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, describe, it, expect } from 'vitest';
import { getAllSettings, getSetting } from '../../src/lib/db/settings';

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe('settings data access', () => {
  it('returns a value for a known key after seeding', async () => {
    await env.DB.prepare("INSERT OR REPLACE INTO site_settings (key, value) VALUES ('contact_email', 'hello@example.com')").run();
    expect(await getSetting(env.DB, 'contact_email')).toBe('hello@example.com');
  });

  it('returns null for a missing key', async () => {
    expect(await getSetting(env.DB, 'does_not_exist')).toBeNull();
  });

  it('returns all settings as a key->value map', async () => {
    await env.DB.prepare("INSERT OR REPLACE INTO site_settings (key, value) VALUES ('phone', '+44 20 7946 0000')").run();
    const all = await getAllSettings(env.DB);
    expect(all.phone).toBe('+44 20 7946 0000');
    expect(all.contact_email).toBe('hello@example.com');
  });
});
```

- [ ] **Step 4: Wire migrations into the workers test config**

In `vitest.workers.config.ts`, inside `miniflare`, add a binding that points the test runtime at the migrations directory so `applyD1Migrations` works. Replace the `miniflare` block:
```ts
miniflare: {
  d1Databases: ['DB'],
  bindings: {
    // Read migration SQL at config-eval time and expose to tests.
    TEST_MIGRATIONS: await (async () => {
      const { readD1Migrations } = await import('@cloudflare/vitest-pool-workers/config');
      return readD1Migrations('./migrations');
    })(),
  },
},
```
> Note: `readD1Migrations` is provided by the pool's config module. If the import path differs in the installed version, check the package's exported `config` entry; the function reads numbered `.sql` files into the array `applyD1Migrations` expects.

- [ ] **Step 5: Run the test to verify it fails**

Run:
```bash
npm run test:workers
```
Expected: FAIL — cannot find module `../../src/lib/db/settings`.

- [ ] **Step 6: Implement `src/lib/db/settings.ts`**

```ts
export type SettingsMap = Record<string, string>;

export async function getSetting(db: D1Database, key: string): Promise<string | null> {
  const row = await db
    .prepare('SELECT value FROM site_settings WHERE key = ?')
    .bind(key)
    .first<{ value: string }>();
  return row?.value ?? null;
}

export async function getAllSettings(db: D1Database): Promise<SettingsMap> {
  const { results } = await db
    .prepare('SELECT key, value FROM site_settings')
    .all<{ key: string; value: string }>();
  const map: SettingsMap = {};
  for (const row of results) map[row.key] = row.value;
  return map;
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run:
```bash
npm run test:workers
```
Expected: PASS (3 tests).

- [ ] **Step 8: Commit**

```bash
git add migrations/0001_site_settings.sql src/lib/db/settings.ts tests/workers/settings.test.ts vitest.workers.config.ts
git commit -m "feat: site_settings table and data access with D1 tests"
```

---

## Task 5: ministries — migration, data access (TDD)

**Files:**
- Create: `migrations/0002_ministries.sql`, `src/lib/db/ministries.ts`, `tests/workers/ministries.test.ts`

- [ ] **Step 1: Create the migration**

Create `migrations/0002_ministries.sql`:
```sql
CREATE TABLE IF NOT EXISTS ministries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  image_key TEXT,
  leader TEXT,
  meeting_time TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
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
Expected: applies `0002_ministries.sql`.

- [ ] **Step 3: Write the failing test**

Create `tests/workers/ministries.test.ts`:
```ts
import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, describe, it, expect } from 'vitest';
import { listPublishedMinistries } from '../../src/lib/db/ministries';

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe('ministries data access', () => {
  it('returns only published ministries, ordered by sort_order', async () => {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO ministries (name, slug, description, sort_order, published) VALUES ('Youth', 'youth', 'Teens', 2, 1)"),
      env.DB.prepare("INSERT INTO ministries (name, slug, description, sort_order, published) VALUES ('Worship', 'worship', 'Music', 1, 1)"),
      env.DB.prepare("INSERT INTO ministries (name, slug, description, sort_order, published) VALUES ('Hidden', 'hidden', 'Draft', 0, 0)"),
    ]);
    const list = await listPublishedMinistries(env.DB);
    expect(list.map((m) => m.slug)).toEqual(['worship', 'youth']);
    expect(list.find((m) => m.slug === 'hidden')).toBeUndefined();
  });
});
```

- [ ] **Step 4: Run to verify it fails**

```bash
npm run test:workers
```
Expected: FAIL — module not found.

- [ ] **Step 5: Implement `src/lib/db/ministries.ts`**

```ts
export interface Ministry {
  id: number;
  name: string;
  slug: string;
  description: string;
  image_key: string | null;
  leader: string | null;
  meeting_time: string | null;
  sort_order: number;
}

export async function listPublishedMinistries(db: D1Database): Promise<Ministry[]> {
  const { results } = await db
    .prepare(
      `SELECT id, name, slug, description, image_key, leader, meeting_time, sort_order
       FROM ministries WHERE published = 1 ORDER BY sort_order ASC, name ASC`,
    )
    .all<Ministry>();
  return results;
}
```

- [ ] **Step 6: Run to verify it passes**

```bash
npm run test:workers
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add migrations/0002_ministries.sql src/lib/db/ministries.ts tests/workers/ministries.test.ts
git commit -m "feat: ministries table and data access with D1 tests"
```

---

## Task 6: visitors — migration, zod schema, data access (TDD)

**Files:**
- Create: `migrations/0003_visitors.sql`, `src/lib/db/schemas.ts`, `src/lib/db/visitors.ts`, `tests/workers/visitors.test.ts`

- [ ] **Step 1: Create the migration**

Create `migrations/0003_visitors.sql`:
```sql
CREATE TABLE IF NOT EXISTS visitors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  visiting_service TEXT,
  type TEXT NOT NULL DEFAULT 'visitor',
  status TEXT NOT NULL DEFAULT 'new',
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'visit_form',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- [ ] **Step 2: Apply locally**

```bash
npx wrangler d1 migrations apply kharisbuilders --local
```

- [ ] **Step 3: Create the shared zod schema**

Create `src/lib/db/schemas.ts`:
```ts
import { z } from 'zod';

export const VisitorInputSchema = z.object({
  name: z.string().trim().min(1, 'Please enter your name').max(120),
  email: z.string().trim().email('Please enter a valid email').max(200),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  visiting_service: z.string().trim().max(120).optional().or(z.literal('')),
});

export type VisitorInput = z.infer<typeof VisitorInputSchema>;
```
(Install zod first if not present: `npm install zod`.)

- [ ] **Step 4: Write the failing test**

Create `tests/workers/visitors.test.ts`:
```ts
import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, describe, it, expect } from 'vitest';
import { createVisitor } from '../../src/lib/db/visitors';

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe('createVisitor', () => {
  it('inserts a visitor and returns the new id', async () => {
    const id = await createVisitor(env.DB, {
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '',
      visiting_service: 'Sunday 09:00 AM',
    });
    expect(id).toBeGreaterThan(0);
    const row = await env.DB.prepare('SELECT name, email, visiting_service, source, status FROM visitors WHERE id = ?')
      .bind(id)
      .first();
    expect(row).toMatchObject({
      name: 'Jane Doe',
      email: 'jane@example.com',
      visiting_service: 'Sunday 09:00 AM',
      source: 'visit_form',
      status: 'new',
    });
  });
});
```

- [ ] **Step 5: Run to verify it fails**

```bash
npm run test:workers
```
Expected: FAIL — module not found.

- [ ] **Step 6: Implement `src/lib/db/visitors.ts`**

```ts
import type { VisitorInput } from './schemas';

export async function createVisitor(db: D1Database, input: VisitorInput): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO visitors (name, email, phone, visiting_service, source)
       VALUES (?, ?, ?, ?, 'visit_form')`,
    )
    .bind(input.name, input.email, input.phone || null, input.visiting_service || null)
    .run();
  return Number(result.meta.last_row_id);
}
```

- [ ] **Step 7: Run to verify it passes**

```bash
npm run test:workers
```
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add migrations/0003_visitors.sql src/lib/db/schemas.ts src/lib/db/visitors.ts tests/workers/visitors.test.ts package.json package-lock.json
git commit -m "feat: visitors table, zod schema, and createVisitor with D1 tests"
```

---

## Task 7: Seed data + apply schema/seed to remote D1

**Files:**
- Create: `db/seed.sql`

> Seed lives OUTSIDE `migrations/` on purpose: the D1 test harness applies every file in `migrations/`, so putting seed rows there would pollute the test DB and break the exact-match assertions in Tasks 5–6. Seed is applied manually with `d1 execute --file`.

- [ ] **Step 1: Create the seed file**

Create `db/seed.sql` (values from `visit_us_kharisbuilders/code.html` + `home_kharisbuilders`):
```sql
INSERT OR REPLACE INTO site_settings (key, value) VALUES
  ('contact_email', 'hello@kharisbuilders.org'),
  ('phone', '+44 20 7946 0000'),
  ('address', '12 Cathedral Way, West End, London, SW1E 5RS'),
  ('service_times', '[{"name":"Sunday Morning","time":"09:00 AM","note":"Traditional"},{"name":"Sunday Evening","time":"05:30 PM","note":"Contemporary"},{"name":"Midweek Communion","time":"07:00 PM","note":"Wednesday"}]'),
  ('socials', '{"facebook":"","instagram":"","youtube":""}'),
  ('default_theme', 'sacred');

INSERT OR IGNORE INTO ministries (name, slug, description, leader, meeting_time, sort_order, published) VALUES
  ('Worship & Arts', 'worship-arts', 'Soulful music and creative expression that lifts the congregation in adoration.', 'Grace Adeyemi', 'Sundays', 1, 1),
  ('Kharis Kids', 'kharis-kids', 'A safe, fun, spiritually enriching environment for ages 2–11 during the 09:00 AM service.', 'Sarah Bello', 'Sundays 09:00 AM', 2, 1),
  ('Youth & Young Adults', 'youth', 'Building the next generation of leaders rooted in faith and purpose.', 'David Okafor', 'Fridays 07:00 PM', 3, 1),
  ('Community Outreach', 'outreach', 'Serving our city through compassion, generosity, and practical care.', 'Ruth Mensah', 'Monthly', 4, 1);
```

- [ ] **Step 2: Apply schema migrations + seed locally and verify counts**

Run:
```bash
npx wrangler d1 migrations apply kharisbuilders --local
npx wrangler d1 execute kharisbuilders --local --file db/seed.sql
npx wrangler d1 execute kharisbuilders --local --command "SELECT (SELECT COUNT(*) FROM site_settings) AS settings, (SELECT COUNT(*) FROM ministries) AS ministries;"
```
Expected: `settings` = 6, `ministries` = 4.

- [ ] **Step 3: Apply migrations + seed to REMOTE D1**

Run:
```bash
npx wrangler d1 migrations apply kharisbuilders --remote
npx wrangler d1 execute kharisbuilders --remote --file db/seed.sql
```
Expected: applies `0001`–`0003` schema + seed to the live database. Confirm:
```bash
npx wrangler d1 execute kharisbuilders --remote --command "SELECT COUNT(*) AS ministries FROM ministries;"
```
Expected: 4.

- [ ] **Step 4: Commit**

```bash
git add db/seed.sql
git commit -m "feat: seed site settings and sample ministries; apply to remote D1"
```

---

## Task 8: Full gate

- [ ] **Step 1: Run both test suites**

Run:
```bash
npm run test:all
```
Expected: node unit tests pass (5) AND workers D1 tests pass (settings 3 + ministries 1 + visitors 1 + smoke 1).

- [ ] **Step 2: Build**

```bash
npm run build
```
Expected: succeeds.

- [ ] **Step 3: Final commit if anything is uncommitted**

```bash
git status --short
```
Expected: clean.

---

## Phase 2A Done — Definition of Done
- `migrations/` holds 3 schema migrations + `db/seed.sql`; migrations + seed applied to BOTH local and remote D1; local counts verified (6 settings, 4 ministries).
- `src/lib/db/{settings,ministries,visitors}.ts` exist, each with focused prepared-statement functions, covered by `@cloudflare/vitest-pool-workers` D1 tests.
- `npm run test:all` and `npm run build` both pass.
- Self-hosted fonts load; mobile menu toggles with correct `aria-expanded`.

**Next:** Phase 2B (Public Pages + Visit Form) — Home/About/Ministries/Visit rendering from these data-access modules, plus the visit form API (zod + Turnstile + `createVisitor` + staff email notification). Written against this real codebase once 2A is executed.

---

## Open Questions (non-blocking)
- Real church address/contact/service times for the seed (placeholders from the mockup used for now; staff edit later via admin in Phase 4).
- Whether `service_times` and `socials` stay as JSON-in-a-setting (simple, current choice) or become their own tables (only if staff need structured editing UI sooner).
