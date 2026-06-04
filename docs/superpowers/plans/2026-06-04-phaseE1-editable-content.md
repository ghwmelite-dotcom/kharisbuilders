# Phase E1: Editable Page Text (Content CMS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all singleton page copy on Home/About/Visit editable from a clean per-page admin editor, with code-defined defaults so the site is unchanged until edited and never breaks on a missing key.

**Architecture:** A field registry (`content/fields.ts`) is the single source of truth — each field carries label/type/group/default. It derives the defaults map (for the `c(key)` helper), the key allowlist (for the save route), and the editor UI. Public pages render `c(key)` = stored value ?? default (blank → default). A `page_content` key/value table stores only edited values. Mirrors the existing settings editor/route patterns.

**Tech Stack:** Astro 6 SSR, Cloudflare D1, Vitest + Miniflare. Spec: `docs/superpowers/specs/2026-06-04-editable-content-e1-design.md`.

**Working dir:** `C:\dev\Projects\KharisBuilders Project\stitch_kharisbuilders_church_web_design` (branch `feat/phaseE1-content` off `main`).

> **Conventions (verified):** `env` from `src/lib/runtime` (never in tests). D1 enforces FKs under Miniflare; harness applies all `migrations/*.sql`. Settings pattern: `src/lib/db/settings.ts` (`getAllSettings`/`setSettings` upsert via `ON CONFLICT`), admin `src/pages/admin/settings.astro` + gated `src/pages/api/admin/settings.ts` (`requireAdmin`, allowlist `SETTINGS_KEYS`). Textarea uses `set:text` (whitespace gotcha). AdminLayout nav array at top of `src/layouts/AdminLayout.astro`.

---

## File Structure (created/modified)

```
migrations/0014_page_content.sql            # page_content table
src/lib/content/fields.ts                    # registry + derived helpers
src/lib/content/content.ts                   # makeContent(stored) -> c(key)
src/lib/db/content.ts                         # getAllContent / setContent
src/pages/api/admin/content.ts                # gated save (allowlisted)
src/pages/admin/content/index.astro           # links to the 3 page editors
src/pages/admin/content/[page].astro          # per-page editor (registry-driven)
src/layouts/AdminLayout.astro                 # + Content nav
src/pages/index.astro                         # use c() for home copy + countdown schedule
src/pages/about.astro                         # use c() for about copy
src/pages/visit.astro                         # use c() for visit copy
tests/content/fields.test.ts
tests/content/content.test.ts
tests/db/content.test.ts
```

---

## Task 1: migration

**Files:** Create `migrations/0014_page_content.sql`.

- [ ] **Step 1: Write it**

```sql
CREATE TABLE IF NOT EXISTS page_content (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);
```

- [ ] **Step 2: Apply + verify**

```bash
npx wrangler d1 migrations apply kharisbuilders --local
npx wrangler d1 execute kharisbuilders --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name='page_content';"
```
Expected: `page_content` listed.

- [ ] **Step 3: Commit** `feat: page_content table for editable copy`.

---

## Task 2: field registry (TDD)

**Files:** Create `src/lib/content/fields.ts`, `tests/content/fields.test.ts`.

- [ ] **Step 1: Write the failing test** (`tests/content/fields.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { CONTENT_PAGES, contentDefaults, contentKeySet, getContentPage } from '../../src/lib/content/fields';

describe('content registry', () => {
  it('every field has a namespaced key, label, and default; keys are unique', () => {
    const seen = new Set<string>();
    for (const page of CONTENT_PAGES) {
      for (const group of page.groups) {
        for (const f of group.fields) {
          expect(f.key).toMatch(/^[a-z]+\.[a-z0-9_]+$/);
          expect(f.label.length).toBeGreaterThan(0);
          expect(typeof f.default).toBe('string');
          expect(seen.has(f.key)).toBe(false);
          seen.add(f.key);
        }
      }
    }
    expect(seen.size).toBeGreaterThan(20);
  });
  it('derives defaults + allowlist consistently', () => {
    const defaults = contentDefaults();
    const keys = contentKeySet();
    expect(Object.keys(defaults).length).toBe(keys.size);
    expect(keys.has('home.hero_line1')).toBe(true);
    expect(defaults['home.hero_line1']).toBe('Building Lives,');
  });
  it('looks up a page by slug', () => {
    expect(getContentPage('about')?.title).toBeTruthy();
    expect(getContentPage('nope')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement `src/lib/content/fields.ts`** (defaults are the CURRENT copy, verbatim)

```ts
export type FieldType = 'text' | 'textarea' | 'url';
export interface ContentField {
  key: string;
  label: string;
  type: FieldType;
  default: string;
  help?: string;
}
export interface ContentGroup {
  title: string;
  fields: ContentField[];
}
export interface ContentPage {
  slug: 'home' | 'about' | 'visit';
  title: string;
  groups: ContentGroup[];
}

export const CONTENT_PAGES: ContentPage[] = [
  {
    slug: 'home',
    title: 'Home',
    groups: [
      {
        title: 'Hero',
        fields: [
          { key: 'home.hero_kicker', label: 'Eyebrow', type: 'text', default: 'Welcome Home' },
          { key: 'home.hero_line1', label: 'Headline line 1', type: 'text', default: 'Building Lives,' },
          { key: 'home.hero_line2', label: 'Headline line 2 (gold)', type: 'text', default: 'Shaping Destinies.' },
          { key: 'home.cta1_label', label: 'Button 1 label', type: 'text', default: 'Join Us This Sunday' },
          { key: 'home.cta1_href', label: 'Button 1 link', type: 'url', default: '/visit' },
          { key: 'home.cta2_label', label: 'Button 2 label', type: 'text', default: 'Watch Online' },
          { key: 'home.cta2_href', label: 'Button 2 link', type: 'url', default: '/sermons' },
          {
            key: 'home.gathering_schedule',
            label: 'Countdown schedule (JSON)',
            type: 'textarea',
            help: 'Array of {day:0-6 (0=Sun), hour:0-23, min, label}. The hero counts down to the soonest.',
            default:
              '[{"day":0,"hour":9,"min":0,"label":"Sunday · 9:00 AM"},{"day":0,"hour":17,"min":30,"label":"Sunday · 5:30 PM"},{"day":3,"hour":19,"min":0,"label":"Wednesday · 7:00 PM"}]',
          },
        ],
      },
      {
        title: 'Pastor welcome',
        fields: [
          { key: 'home.pastor_eyebrow', label: 'Eyebrow', type: 'text', default: 'A Word of Welcome' },
          { key: 'home.pastor_heading', label: 'Heading', type: 'text', default: 'A Message from Our Pastor' },
          {
            key: 'home.pastor_body1',
            label: 'Paragraph 1',
            type: 'textarea',
            default:
              'Welcome to Kharisbuilders. We believe that every individual has a divine blueprint — a destiny waiting to be realized. Our mission is to provide the spiritual foundation and community support needed to build that life.',
          },
          {
            key: 'home.pastor_body2',
            label: 'Paragraph 2',
            type: 'textarea',
            default:
              'Whether you are exploring faith for the first time or seeking a deeper connection with your Creator, there is a place for you in our sanctuary. We are more than a congregation; we are architects of hope.',
          },
          { key: 'home.pastor_name', label: 'Signature', type: 'text', default: 'Lead Pastor David Anderson' },
        ],
      },
      {
        title: 'Scripture band',
        fields: [
          {
            key: 'home.scripture_verse',
            label: 'Verse',
            type: 'textarea',
            help: 'Quotation marks are added automatically.',
            default: 'Now faith is the substance of things hoped for, the evidence of things not seen.',
          },
          { key: 'home.scripture_ref', label: 'Reference', type: 'text', default: 'Hebrews 11:1' },
        ],
      },
      {
        title: 'Giving banner',
        fields: [
          { key: 'home.giving_eyebrow', label: 'Eyebrow', type: 'text', default: 'Generosity' },
          { key: 'home.giving_heading', label: 'Heading', type: 'text', default: 'Invest in Destinies' },
          {
            key: 'home.giving_body',
            label: 'Body',
            type: 'textarea',
            default:
              'Your generosity fuels our mission to build lives and shape destinies. Together, we can make an eternal impact on our community and beyond.',
          },
          { key: 'home.giving_cta1_label', label: 'Button 1 label', type: 'text', default: 'Give Online' },
          { key: 'home.giving_cta2_label', label: 'Button 2 label', type: 'text', default: 'Plan a Visit' },
        ],
      },
    ],
  },
  {
    slug: 'about',
    title: 'About',
    groups: [
      {
        title: 'Hero',
        fields: [
          { key: 'about.hero_kicker', label: 'Eyebrow', type: 'text', default: 'Our Identity' },
          { key: 'about.hero_title', label: 'Title', type: 'text', default: 'Architects of Faith, Builders of Destinies' },
        ],
      },
      {
        title: 'Vision & Mission',
        fields: [
          { key: 'about.vision_heading', label: 'Vision heading', type: 'text', default: 'The Vision' },
          {
            key: 'about.vision_body',
            label: 'Vision text',
            type: 'textarea',
            default:
              "To see every life constructed on the unshakeable foundation of grace, transforming individuals into living monuments of God's presence within their spheres of influence.",
          },
          { key: 'about.mission_heading', label: 'Mission heading', type: 'text', default: 'The Mission' },
          {
            key: 'about.mission_body',
            label: 'Mission text',
            type: 'textarea',
            default:
              'We are committed to building people through the precise teaching of the Word, the warmth of communal fellowship, and the strategic deployment of spiritual gifts for societal impact.',
          },
        ],
      },
    ],
  },
  {
    slug: 'visit',
    title: 'Visit',
    groups: [
      {
        title: 'Hero',
        fields: [
          { key: 'visit.hero_kicker', label: 'Eyebrow', type: 'text', default: 'Plan Your Visit' },
          { key: 'visit.hero_title', label: 'Title', type: 'text', default: 'A Place to Belong' },
          {
            key: 'visit.hero_subtitle',
            label: 'Subtitle',
            type: 'textarea',
            default:
              "Experience the intersection of tradition and transformation. We can't wait to welcome you home.",
          },
        ],
      },
      {
        title: 'Plan Your Visit card',
        fields: [
          { key: 'visit.plan_eyebrow', label: 'Eyebrow', type: 'text', default: 'First Time?' },
          { key: 'visit.plan_heading', label: 'Heading', type: 'text', default: 'Plan Your Visit' },
          {
            key: 'visit.plan_body',
            label: 'Body',
            type: 'textarea',
            default: "Let us know you're coming so we can have a welcome pack ready and help you find your way.",
          },
          { key: 'visit.parking_body', label: 'Parking note', type: 'textarea', default: 'Free on-site parking is available, with assistance for elderly visitors.' },
        ],
      },
      {
        title: 'What to Expect',
        fields: [
          { key: 'visit.expect_eyebrow', label: 'Eyebrow', type: 'text', default: 'Your First Visit' },
          { key: 'visit.expect_heading', label: 'Heading', type: 'text', default: 'What to Expect' },
          { key: 'visit.expect_q1_title', label: 'Card 1 title', type: 'text', default: 'What should I wear?' },
          {
            key: 'visit.expect_q1_body',
            label: 'Card 1 body',
            type: 'textarea',
            default:
              "We value your presence more than your attire. You'll find some people in suits and others in jeans — wear whatever makes you feel comfortable and ready to connect with the community.",
          },
          { key: 'visit.expect_kids_title', label: 'Card 2 title', type: 'text', default: 'Kids?' },
          {
            key: 'visit.expect_kids_body',
            label: 'Card 2 body',
            type: 'textarea',
            default:
              "Our 'Kharis Kids' program offers a safe, fun, and spiritually enriching environment for ages 2–11 during the morning service.",
          },
          { key: 'visit.expect_service_title', label: 'Card 3 title', type: 'text', default: 'The Service?' },
          {
            key: 'visit.expect_service_body',
            label: 'Card 3 body',
            type: 'textarea',
            default:
              'Services typically last 75 minutes — soulful music, communal prayer, and a message both ancient in truth and modern in application.',
          },
          { key: 'visit.expect_afterward_title', label: 'Card 4 title', type: 'text', default: 'Afterward' },
          {
            key: 'visit.expect_afterward_body',
            label: 'Card 4 body',
            type: 'textarea',
            default: 'Join us in the Glass Atrium for artisanal coffee and a chance to meet our leadership team.',
          },
        ],
      },
    ],
  },
];

export function contentDefaults(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const page of CONTENT_PAGES) for (const g of page.groups) for (const f of g.fields) out[f.key] = f.default;
  return out;
}

export function contentKeySet(): Set<string> {
  return new Set(Object.keys(contentDefaults()));
}

export function getContentPage(slug: string): ContentPage | undefined {
  return CONTENT_PAGES.find((p) => p.slug === slug);
}
```

- [ ] **Step 4: Run → pass.**

- [ ] **Step 5: Commit** `feat: content field registry (defaults = current copy) with tests`.

---

## Task 3: content helper (TDD)

**Files:** Create `src/lib/content/content.ts`, `tests/content/content.test.ts`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { makeContent } from '../../src/lib/content/content';

describe('makeContent', () => {
  it('returns the stored value when present', () => {
    const c = makeContent({ 'home.hero_line1': 'New Headline' });
    expect(c('home.hero_line1')).toBe('New Headline');
  });
  it('falls back to the registry default when missing', () => {
    const c = makeContent({});
    expect(c('home.hero_line1')).toBe('Building Lives,');
  });
  it('treats a blank/whitespace stored value as "use default"', () => {
    const c = makeContent({ 'home.hero_line1': '   ' });
    expect(c('home.hero_line1')).toBe('Building Lives,');
  });
  it('returns empty string for an unknown key', () => {
    expect(makeContent({})('home.nope')).toBe('');
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement `src/lib/content/content.ts`**

```ts
import { contentDefaults } from './fields';

const DEFAULTS = contentDefaults();

export type ContentFn = (key: string) => string;

/** Resolve content: stored value (when non-blank) else the registry default else ''. */
export function makeContent(stored: Record<string, string>): ContentFn {
  return (key: string) => {
    const v = stored[key];
    if (typeof v === 'string' && v.trim().length > 0) return v;
    return DEFAULTS[key] ?? '';
  };
}
```

- [ ] **Step 4: Run → pass.**

- [ ] **Step 5: Commit** `feat: content helper with default fallback + tests`.

---

## Task 4: data access (TDD)

**Files:** Create `src/lib/db/content.ts`, `tests/db/content.test.ts`.

- [ ] **Step 1: Write the failing test**

```ts
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { getAllContent, setContent } from '../../src/lib/db/content';

let ctx: TestDb;
beforeAll(async () => { ctx = await createTestDb(); });
afterAll(async () => { await ctx.dispose(); });

describe('page_content data access', () => {
  it('upserts and reads back, recording updated_by', async () => {
    await setContent(ctx.db, { 'home.hero_line1': 'First' }, 'a@x');
    expect((await getAllContent(ctx.db))['home.hero_line1']).toBe('First');
    await setContent(ctx.db, { 'home.hero_line1': 'Second' }, 'b@x'); // update same key
    expect((await getAllContent(ctx.db))['home.hero_line1']).toBe('Second');
  });
  it('no-ops on an empty entry set', async () => {
    await setContent(ctx.db, {}, 'a@x');
    expect(typeof (await getAllContent(ctx.db))).toBe('object');
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement `src/lib/db/content.ts`**

```ts
export async function getAllContent(db: D1Database): Promise<Record<string, string>> {
  const { results } = await db.prepare('SELECT key, value FROM page_content').all<{ key: string; value: string }>();
  const map: Record<string, string> = {};
  for (const row of results) map[row.key] = row.value;
  return map;
}

export async function setContent(db: D1Database, entries: Record<string, string>, email: string): Promise<void> {
  const stmts = Object.entries(entries).map(([key, value]) =>
    db
      .prepare(
        "INSERT INTO page_content (key, value, updated_at, updated_by) VALUES (?, ?, datetime('now'), ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now'), updated_by=excluded.updated_by",
      )
      .bind(key, value, email),
  );
  if (stmts.length) await db.batch(stmts);
}
```

- [ ] **Step 4: Run → pass.**

- [ ] **Step 5: Commit** `feat: page_content data access with tests`.

---

## Task 5: gated save route

**Files:** Create `src/pages/api/admin/content.ts`.

- [ ] **Step 1: Implement**

```ts
import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { requireAdmin } from '../../../lib/admin-auth';
import { setContent } from '../../../lib/db/content';
import { contentKeySet } from '../../../lib/content/fields';

export const POST: APIRoute = async ({ request }) => {
  const auth = requireAdmin(request, env, import.meta.env.DEV);
  if ('response' in auth) return auth.response;
  const form = await request.formData();
  const page = String(form.get('_page') ?? '');
  const allow = contentKeySet();
  const entries: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (allow.has(key) && typeof value === 'string') entries[key] = value;
  }
  try {
    await setContent(env.DB, entries, auth.email);
  } catch {
    return new Response('Invalid submission', { status: 400 });
  }
  const dest = ['home', 'about', 'visit'].includes(page) ? `/admin/content/${page}` : '/admin/content';
  return new Response(null, { status: 303, headers: { Location: `${dest}?saved=1` } });
};
```

- [ ] **Step 2: Build** (`npm run build`) → succeeds.

- [ ] **Step 3: Commit** `feat: gated content save route (allowlisted)`.

---

## Task 6: admin editors + nav

**Files:** Create `src/pages/admin/content/index.astro`, `src/pages/admin/content/[page].astro`; modify `src/layouts/AdminLayout.astro`.

- [ ] **Step 1: Add nav in `src/layouts/AdminLayout.astro`** (after the `dashboard` entry, before `sermons`)

```astro
  { label: 'Content', href: '/admin/content', key: 'content' },
```

- [ ] **Step 2: Implement `src/pages/admin/content/index.astro`**

```astro
---
import AdminLayout from '../../../layouts/AdminLayout.astro';
import { env } from '../../../lib/runtime';
import { getAdminEmail } from '../../../lib/admin-auth';
import { CONTENT_PAGES } from '../../../lib/content/fields';

const email = getAdminEmail(Astro.request, env, import.meta.env.DEV);
if (!email) return Astro.redirect('/admin/denied');
---
<AdminLayout title="Content" email={email} active="content">
  <p class="text-on-surface-variant text-sm mb-6">Edit the wording on each public page. Blank a field to restore its original text.</p>
  <ul class="space-y-3">
    {CONTENT_PAGES.map((p) => (
      <li>
        <a href={`/admin/content/${p.slug}`} class="text-primary hover:text-accent text-lg font-display">{p.title} page →</a>
      </li>
    ))}
  </ul>
</AdminLayout>
```

- [ ] **Step 3: Implement `src/pages/admin/content/[page].astro`**

```astro
---
import AdminLayout from '../../../layouts/AdminLayout.astro';
import Button from '../../../components/Button.astro';
import { env } from '../../../lib/runtime';
import { getAdminEmail } from '../../../lib/admin-auth';
import { getContentPage } from '../../../lib/content/fields';
import { getAllContent } from '../../../lib/db/content';

const email = getAdminEmail(Astro.request, env, import.meta.env.DEV);
if (!email) return Astro.redirect('/admin/denied');
const page = getContentPage(String(Astro.params.page));
if (!page) return Astro.redirect('/admin/content');
const stored = await getAllContent(env.DB).catch(() => ({}) as Record<string, string>);
const saved = Astro.url.searchParams.get('saved') === '1';
const val = (key: string, def: string) => (stored[key] != null && stored[key] !== '' ? stored[key] : def);
---
<AdminLayout title={`Content · ${page.title}`} email={email} active="content">
  {saved && <p class="mb-6 bg-accent/10 text-primary text-sm px-4 py-3">Saved. <a href={`/${page.slug === 'home' ? '' : page.slug}`} class="underline" target="_blank">View page →</a></p>}
  <form method="POST" action="/api/admin/content" class="max-w-2xl space-y-10">
    <input type="hidden" name="_page" value={page.slug} />
    {
      page.groups.map((g) => (
        <fieldset class="border-t border-champagne pt-6">
          <legend class="font-display text-lg text-primary mb-4">{g.title}</legend>
          <div class="space-y-5">
            {g.fields.map((f) => (
              <div class="flex flex-col gap-1">
                <label for={f.key} class="text-xs uppercase tracking-wider text-on-surface-variant">{f.label}</label>
                {f.type === 'textarea' ? (
                  <textarea id={f.key} name={f.key} rows="3" class="border border-champagne bg-surface px-4 py-2 font-body text-sm text-primary" set:text={val(f.key, f.default)} />
                ) : (
                  <input id={f.key} name={f.key} type={f.type === 'url' ? 'text' : 'text'} class="border border-champagne bg-surface px-4 py-2 font-body text-sm text-primary" value={val(f.key, f.default)} />
                )}
                {f.help && <p class="text-xs text-on-surface-variant">{f.help}</p>}
              </div>
            ))}
          </div>
        </fieldset>
      ))
    }
    <Button type="submit" variant="primary">Save changes</Button>
  </form>
</AdminLayout>
```

> The editor pre-fills each field with the stored value or its default, so staff always see and edit the live text.

- [ ] **Step 4: Build** → succeeds. (Manual admin check in Task 8.)

- [ ] **Step 5: Commit** `feat: admin content editors (index + per-page) + nav`.

---

## Task 7: wire public pages to `c(key)`

**Files:** Modify `src/pages/index.astro`, `src/pages/about.astro`, `src/pages/visit.astro`.

> For each page: in the frontmatter add the content load + helper, then replace the hardcoded strings. Add to the existing `Promise.all` where present (index) or a separate `getAllContent` call.

- [ ] **Step 1: `index.astro` frontmatter** — add content load + helper

Add import: `import { makeContent } from '../lib/content/content';` and `import { getAllContent } from '../lib/db/content';`
In the existing `try`, fetch content alongside the others, e.g. extend the `Promise.all` to include `getAllContent(env.DB)`, then `const c = makeContent(contentMap);`. If the try fails, set `const c = makeContent({});` in the catch (defaults). Ensure `c` is defined in both branches:
```ts
let contentMap: Record<string, string> = {};
try {
  const [s, e, settings, cm] = await Promise.all([
    listPublishedSermons(env.DB, 1),
    listUpcomingEvents(env.DB, 3),
    getAllSettings(env.DB),
    getAllContent(env.DB),
  ]);
  latestSermon = s[0] ?? null; events = e;
  serviceTimes = settings.service_times ? JSON.parse(settings.service_times) : [];
  contentMap = cm;
} catch { /* defaults */ }
const c = makeContent(contentMap);
```

- [ ] **Step 2: `index.astro` markup** — replace hardcoded copy with `c()`

| Replace | With |
|---|---|
| `Welcome Home` (kicker) | `{c('home.hero_kicker')}` |
| `Building Lives,` | `{c('home.hero_line1')}` |
| `Shaping Destinies.` | `{c('home.hero_line2')}` |
| `Join Us This Sunday` + `href="/visit"` | `{c('home.cta1_label')}` + `href={c('home.cta1_href')}` |
| `Watch Online` + `href="/sermons"` | `{c('home.cta2_label')}` + `href={c('home.cta2_href')}` |
| pastor eyebrow/heading/body1/body2/name | `c('home.pastor_*')` |
| scripture verse (inside the `“ ”`) | `{c('home.scripture_verse')}` (keep the literal `“`/`”` in the markup around it) |
| `Hebrews 11:1` | `{c('home.scripture_ref')}` |
| giving eyebrow/heading/body | `c('home.giving_*')` |
| `Give Online` / `Plan a Visit` (giving buttons) | `{c('home.giving_cta1_label')}` / `{c('home.giving_cta2_label')}` |

Multi-paragraph bodies render with `class="... whitespace-pre-line"` so newlines show.

- [ ] **Step 3: `index.astro` countdown** — drive the JS from the editable schedule

Add `data-schedule={c('home.gathering_schedule')}` to the `#hero-countdown` span. In the inline `<script>`, replace the hardcoded `sched` with a parse of that attribute (with fallback to the current array):
```js
const out = document.getElementById('hero-countdown');
let sched = [[0,9,0,'Sunday · 9:00 AM'],[0,17,30,'Sunday · 5:30 PM'],[3,19,0,'Wednesday · 7:00 PM']];
try {
  const raw = out?.getAttribute('data-schedule');
  if (raw) {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) sched = parsed.map((x) => [x.day, x.hour, x.min ?? 0, x.label]);
  }
} catch (e) { /* keep default */ }
```
Keep the rest of the countdown logic unchanged (it already iterates `sched` as `[day,h,m,label]`).

- [ ] **Step 4: `about.astro`** — add content load + replace copy

Frontmatter: `import { makeContent } from '../lib/content/content'; import { getAllContent } from '../lib/db/content'; const c = makeContent(await getAllContent(env.DB).catch(() => ({})));`
> about.astro has no `env` import yet — add `import { env } from '../lib/runtime';`.
Replace: hero kicker → `c('about.hero_kicker')`, hero title → `c('about.hero_title')`, The Vision/body → `c('about.vision_heading')`/`c('about.vision_body')`, The Mission/body → `c('about.mission_heading')`/`c('about.mission_body')` (bodies `whitespace-pre-line`).

- [ ] **Step 5: `visit.astro`** — replace copy

visit.astro already imports `env`. Add the content helper (`makeContent` + `getAllContent`) into the existing try (or a new line): `const c = makeContent(await getAllContent(env.DB).catch(() => ({})));`
Replace: hero kicker/title/subtitle → `c('visit.hero_*')`; First Time?/Plan Your Visit/body → `c('visit.plan_*')`; parking note → `c('visit.parking_body')`; What to Expect SectionIntro eyebrow/title → `c('visit.expect_eyebrow')`/`c('visit.expect_heading')`; the four expect cards titles/bodies → `c('visit.expect_*')`.

- [ ] **Step 6: Build** (`npm run build`) → succeeds.

- [ ] **Step 7: Commit** `feat: render home/about/visit copy from editable content with defaults`.

---

## Task 8: full gate + dev verify

- [ ] **Step 1: Full unit suite** (`npx vitest run`) — prior 142 + new (~10) pass.

- [ ] **Step 2: Build** (`npm run build`).

- [ ] **Step 3: Dev verify** (`npm run dev`, DEV_ADMIN_EMAIL set)
```bash
# defaults render unchanged (no rows yet)
curl -s http://localhost:4321/ | grep -o 'Shaping Destinies.' | head -1
# edit a field via the gated route (dev admin), then confirm it renders
curl -s -i -X POST http://localhost:4321/api/admin/content -H "Origin: http://localhost:4321" \
  -F "_page=home" -F "home.hero_line2=Shaping Eternity." | grep -i location
curl -s http://localhost:4321/ | grep -o 'Shaping Eternity.' | head -1     # now reflects the edit
# blank it -> default returns
curl -s -X POST http://localhost:4321/api/admin/content -H "Origin: http://localhost:4321" -F "_page=home" -F "home.hero_line2= " > /dev/null
curl -s http://localhost:4321/ | grep -o 'Shaping Destinies.' | head -1     # default restored
# editor page renders the fields
curl -s -o /dev/null -w "editor: %{http_code}\n" http://localhost:4321/admin/content/home
```
Expected: default renders; edit reflects; blank restores default; editor 200. Clean up the test row (`DELETE FROM page_content;` local) if desired.

- [ ] **Step 4: Clean tree** (`git status --short`).

---

## Phase E1 Done — Definition of Done
- `page_content` table + registry-driven editor make all Home/About/Visit singleton copy editable.
- Pages render `c(key)` = stored value ?? default; blank restores default; missing key/DB failure never breaks a page.
- Admin "Content" section with grouped, labeled per-page editors; gated + allowlisted save.
- Hero countdown reads the editable schedule.
- `npx vitest run` + `npm run build` pass; dev round-trip verified.

**Next:** E2 (leadership team + journey timeline + home quick-link cards as CRUD), then E3 (replaceable page images via R2).

---

## Open Questions (resolved defaults)
- Defaults live in `fields.ts` (verbatim current copy); table starts empty.
- Multi-paragraph via `whitespace-pre-line`; verse quotes added in markup.
- `gathering_schedule` is JSON (consistent with `service_times`).
