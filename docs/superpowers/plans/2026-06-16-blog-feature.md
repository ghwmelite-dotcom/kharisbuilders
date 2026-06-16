# Blog Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Markdown-authored blog: premium excerpt cards on the homepage, a public blog index + dedicated post pages, and full admin CRUD with inline-image upload — all server-rendered for zero client-side weight.

**Architecture:** Mirrors the existing `sermons` feature end-to-end. New `blog_posts` D1 table → `src/lib/db/blog.ts` data layer (prepared statements) → admin CRUD pages + API → public `index`/`[slug]` pages → homepage section. Markdown renders to HTML **server-side** via `marked`; images upload to R2 and serve through the existing `/media/[...key]` route with `loading="lazy"`.

**Tech Stack:** Astro 6 (server output), Cloudflare Workers + D1 + R2, Tailwind v4, Zod, Vitest + Miniflare. New dependency: `marked`.

---

## File Structure

**New files:**
- `migrations/0026_blog.sql` — `blog_posts` table + index.
- `src/lib/blog/markdown.ts` — `renderMarkdown`, `deriveExcerpt`, `readMinutes` (pure, server-only).
- `src/lib/db/blog.ts` — data layer (list/get/create/update/delete/publish/cover).
- `src/components/BlogCard.astro` — premium excerpt card (public).
- `src/components/admin/BlogForm.astro` — admin create/edit form + inline-image uploader.
- `src/pages/blog/index.astro` — public list + category filter.
- `src/pages/blog/[slug].astro` — public post page.
- `src/pages/admin/blog.astro` — admin list.
- `src/pages/admin/blog/new.astro` — admin create.
- `src/pages/admin/blog/[id].astro` — admin edit.
- `src/pages/api/admin/blog.ts` — CRUD API (`_action` POST).
- `src/pages/api/admin/blog/upload.ts` — inline-image upload (returns JSON).
- `tests/blog/markdown.test.ts` — markdown/excerpt/readtime tests.
- `tests/db/blog.test.ts` — data-layer tests.

**Modified files:**
- `src/config/church.ts` — add `blog` feature flag.
- `src/lib/db/schemas.ts` — add `BlogPostInputSchema`.
- `src/pages/media/[...key].ts` — allow `blog/` prefix.
- `src/lib/db/admin.ts` — add `blog` to counts + `listAllPosts`.
- `src/pages/admin/index.astro` — Blog dashboard card.
- `src/layouts/AdminLayout.astro` — Blog nav item.
- `src/pages/index.astro` — "From the Blog" homepage section.
- `src/components/Nav.astro` — public Blog nav link.
- `src/pages/sitemap.xml.ts` — blog index + posts.

---

## Task 1: Foundation — dependency, migration, feature flag, media prefix

**Files:**
- Modify: `package.json`
- Create: `migrations/0026_blog.sql`
- Modify: `src/config/church.ts`
- Modify: `src/pages/media/[...key].ts:6`

- [ ] **Step 1: Install the markdown renderer**

Run:
```bash
npm install marked@^16
```
Expected: `marked` appears under `dependencies` in `package.json`, install succeeds.

- [ ] **Step 2: Create the migration**

Create `migrations/0026_blog.sql`:
```sql
CREATE TABLE IF NOT EXISTS blog_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  author TEXT,
  category TEXT,
  tags TEXT,
  excerpt TEXT,
  body TEXT NOT NULL,
  cover_key TEXT,
  read_minutes INTEGER,
  published INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_blog_published ON blog_posts(published, published_at DESC);
```

- [ ] **Step 3: Add the `blog` feature flag**

In `src/config/church.ts`, add `blog: boolean;` to the `ChurchFeatures` interface (after `community: boolean;`):
```ts
export interface ChurchFeatures {
  sermons: boolean;
  events: boolean;
  ministries: boolean;
  giving: boolean;
  ai: boolean;
  live: boolean;
  community: boolean;
  blog: boolean;
}
```
And add `blog: true` to the `CHURCH.features` object:
```ts
  features: { sermons: true, events: true, ministries: true, giving: true, ai: true, live: true, community: true, blog: true },
```

- [ ] **Step 4: Allow the `blog/` media prefix**

In `src/pages/media/[...key].ts`, add `'blog/'` to `PUBLIC_PREFIXES`:
```ts
const PUBLIC_PREFIXES = ['sermons/', 'events/', 'ministries/', 'leaders/', 'journey/', 'home-cards/', 'page/', 'groups/', 'volunteer/', 'blog/'];
```

- [ ] **Step 5: Verify the migration applies (via the test harness)**

Run:
```bash
npx vitest run tests/db/admin.test.ts
```
Expected: PASS. (The test harness in `tests/helpers/d1.ts` applies every `migrations/*.sql` in order, so a syntax error in `0026_blog.sql` would fail this run.)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json migrations/0026_blog.sql src/config/church.ts "src/pages/media/[...key].ts"
git commit -m "feat(blog): add migration, feature flag, marked dep, media prefix"
```

---

## Task 2: Markdown rendering + excerpt + read-time (TDD)

**Files:**
- Create: `src/lib/blog/markdown.ts`
- Test: `tests/blog/markdown.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/blog/markdown.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { renderMarkdown, deriveExcerpt, readMinutes } from '../../src/lib/blog/markdown';

describe('renderMarkdown', () => {
  it('renders markdown to html', () => {
    const html = renderMarkdown('# Hi\n\nHello **world**');
    expect(html).toContain('<h1>Hi</h1>');
    expect(html).toContain('<strong>world</strong>');
  });
  it('adds lazy-loading + async decoding to images', () => {
    const html = renderMarkdown('![alt](/media/blog/a.webp)');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('decoding="async"');
    expect(html).toContain('src="/media/blog/a.webp"');
  });
  it('strips dangerous markup (script tags + event handlers)', () => {
    const html = renderMarkdown('Hi\n\n<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('alert(1)');
  });
});

describe('deriveExcerpt', () => {
  it('strips markdown and truncates to ~30 words with an ellipsis', () => {
    const body = '# Heading\n\n' + Array.from({ length: 50 }, (_, i) => `word${i + 1}`).join(' ');
    const ex = deriveExcerpt(body);
    expect(ex.startsWith('word1 word2')).toBe(true);
    expect(ex).not.toContain('#');
    expect(ex.endsWith('…')).toBe(true);
    expect(ex.split(' ').length).toBeLessThanOrEqual(31); // 30 words + ellipsis token
  });
  it('does not append an ellipsis for short bodies', () => {
    expect(deriveExcerpt('Just three words')).toBe('Just three words');
  });
});

describe('readMinutes', () => {
  it('estimates ~200 wpm, minimum 1', () => {
    expect(readMinutes('one two three')).toBe(1);
    expect(readMinutes(Array.from({ length: 400 }, () => 'w').join(' '))).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run tests/blog/markdown.test.ts
```
Expected: FAIL — cannot resolve `../../src/lib/blog/markdown`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/blog/markdown.ts`:
```ts
import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: false });

/**
 * Render admin-authored Markdown to HTML for public display.
 *
 * Authorship is restricted to authenticated admins, so this is a trusted input;
 * the sanitisation below is defence-in-depth, not the primary trust boundary.
 * Rendering happens server-side only — nothing here ships to the browser.
 */
export function renderMarkdown(md: string): string {
  const html = marked.parse(md ?? '', { async: false }) as string;
  return sanitize(addImageLoading(html));
}

/** Inject lazy-loading + async decoding into every <img>. */
function addImageLoading(html: string): string {
  return html.replace(/<img\s/gi, '<img loading="lazy" decoding="async" ');
}

/** Strip script/style/iframe tags, inline event handlers, and javascript: URLs. */
function sanitize(html: string): string {
  return html
    .replace(/<\/?(?:script|style|iframe|object|embed)\b[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1=$2#$2');
}

/** Strip markdown syntax and return the first ~`words` words, with an ellipsis if truncated. */
export function deriveExcerpt(body: string, words = 30): string {
  const text = (body ?? '')
    .replace(/```[\s\S]*?```/g, ' ')           // code fences
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')      // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')    // links -> link text
    .replace(/[#>*_`~-]/g, ' ')                  // markdown punctuation
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  const parts = text.split(' ');
  if (parts.length <= words) return text;
  return parts.slice(0, words).join(' ') + '…';
}

/** Estimate reading time in minutes (~200 wpm), minimum 1. */
export function readMinutes(body: string): number {
  const count = (body ?? '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(count / 200));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npx vitest run tests/blog/markdown.test.ts
```
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/blog/markdown.ts tests/blog/markdown.test.ts
git commit -m "feat(blog): markdown render, excerpt, read-time helpers"
```

---

## Task 3: Schema + data layer (TDD)

**Files:**
- Modify: `src/lib/db/schemas.ts`
- Create: `src/lib/db/blog.ts`
- Test: `tests/db/blog.test.ts`

- [ ] **Step 1: Add the input schema**

Append to `src/lib/db/schemas.ts`:
```ts
export const BlogPostInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug: z.string().trim().max(200).optional().or(z.literal('')),
  author: z.string().trim().max(120).optional().or(z.literal('')),
  category: z.string().trim().max(80).optional().or(z.literal('')),
  tags: z.string().trim().max(300).optional().or(z.literal('')),
  excerpt: z.string().trim().max(500).optional().or(z.literal('')),
  body: z.string().trim().min(1).max(100000),
  published_at: z.string().trim().max(20).optional().or(z.literal('')),
  published: z.coerce.boolean().default(false),
});
export type BlogPostInput = z.infer<typeof BlogPostInputSchema>;
```

- [ ] **Step 2: Write the failing test**

Create `tests/db/blog.test.ts`:
```ts
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import {
  createPost,
  updatePost,
  getPostBySlug,
  getPostById,
  listPublishedPosts,
  listPublishedPostsByCategory,
  listCategories,
  setPostPublished,
  deletePost,
} from '../../src/lib/db/blog';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.dispose();
});

describe('blog data layer', () => {
  it('creates a post, deriving excerpt + read-time, and reads it back', async () => {
    const id = await createPost(
      ctx.db,
      { title: 'Grace Abounds', body: 'one two three four five', category: 'Teaching', tags: 'grace, faith', published: true, published_at: '2026-06-01' },
      'admin@x.org',
    );
    const post = await getPostById(ctx.db, id);
    expect(post).not.toBeNull();
    expect(post!.slug).toBe('grace-abounds');
    expect(post!.read_minutes).toBe(1);
    expect(post!.excerpt).toBe('one two three four five');
    expect(post!.published).toBe(1);
  });

  it('keeps a manual excerpt when provided', async () => {
    const id = await createPost(
      ctx.db,
      { title: 'Manual Excerpt', body: 'a long body here', excerpt: 'Hand-written summary.', published: true },
      'admin@x.org',
    );
    const post = await getPostById(ctx.db, id);
    expect(post!.excerpt).toBe('Hand-written summary.');
  });

  it('suffixes duplicate slugs', async () => {
    const id = await createPost(ctx.db, { title: 'Grace Abounds', body: 'x', published: true }, 'a@x.org');
    const post = await getPostById(ctx.db, id);
    expect(post!.slug).toBe('grace-abounds-2');
  });

  it('lists only published posts, newest published_at first', async () => {
    await createPost(ctx.db, { title: 'Draft One', body: 'x', published: false }, 'a@x.org');
    const published = await listPublishedPosts(ctx.db);
    expect(published.every((p) => p.slug !== 'draft-one')).toBe(true);
    expect(published[0].published_at >= (published[1]?.published_at ?? '')).toBe(true);
  });

  it('filters by category and lists distinct categories', async () => {
    const teaching = await listPublishedPostsByCategory(ctx.db, 'Teaching');
    expect(teaching.length).toBeGreaterThanOrEqual(1);
    expect(teaching.every((p) => p.category === 'Teaching')).toBe(true);
    expect(await listCategories(ctx.db)).toContain('Teaching');
  });

  it('getPostBySlug only returns published posts', async () => {
    expect(await getPostBySlug(ctx.db, 'draft-one')).toBeNull();
    expect((await getPostBySlug(ctx.db, 'grace-abounds'))?.title).toBe('Grace Abounds');
  });

  it('updates, toggles publish, and deletes', async () => {
    const id = await createPost(ctx.db, { title: 'Temp', body: 'x', published: true }, 'a@x.org');
    await updatePost(ctx.db, id, { title: 'Temp Renamed', body: 'x y z', published: true }, 'b@x.org');
    expect((await getPostById(ctx.db, id))!.title).toBe('Temp Renamed');
    await setPostPublished(ctx.db, id, false);
    expect((await getPostById(ctx.db, id))!.published).toBe(0);
    await deletePost(ctx.db, id);
    expect(await getPostById(ctx.db, id)).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run:
```bash
npx vitest run tests/db/blog.test.ts
```
Expected: FAIL — cannot resolve `../../src/lib/db/blog`.

- [ ] **Step 4: Write the data layer**

Create `src/lib/db/blog.ts`:
```ts
import type { BlogPostInput } from './schemas';
import { slugify, uniqueSlug } from '../slug';
import { deriveExcerpt, readMinutes } from '../blog/markdown';

export interface BlogPost {
  id: number;
  title: string;
  slug: string;
  author: string | null;
  category: string | null;
  tags: string | null;
  excerpt: string | null;
  body: string;
  cover_key: string | null;
  read_minutes: number | null;
  published_at: string | null;
  created_at: string;
}

export interface BlogPostFull extends BlogPost {
  published: number;
  updated_by: string | null;
}

const COLS =
  'id, title, slug, author, category, tags, excerpt, body, cover_key, read_minutes, published_at, created_at';

export async function listPublishedPosts(db: D1Database, limit = 50): Promise<BlogPost[]> {
  const { results } = await db
    .prepare(
      `SELECT ${COLS} FROM blog_posts WHERE published = 1
       ORDER BY COALESCE(published_at, created_at) DESC, id DESC LIMIT ?`,
    )
    .bind(limit)
    .all<BlogPost>();
  return results;
}

export async function listPublishedPostsByCategory(db: D1Database, category: string, limit = 50): Promise<BlogPost[]> {
  const { results } = await db
    .prepare(
      `SELECT ${COLS} FROM blog_posts WHERE published = 1 AND category = ?
       ORDER BY COALESCE(published_at, created_at) DESC, id DESC LIMIT ?`,
    )
    .bind(category, limit)
    .all<BlogPost>();
  return results;
}

export async function listCategories(db: D1Database): Promise<string[]> {
  const { results } = await db
    .prepare(
      `SELECT DISTINCT category FROM blog_posts WHERE published = 1 AND category IS NOT NULL AND category <> '' ORDER BY category`,
    )
    .all<{ category: string }>();
  return results.map((r) => r.category);
}

export async function getPostBySlug(db: D1Database, slug: string): Promise<BlogPost | null> {
  const row = await db
    .prepare(`SELECT ${COLS} FROM blog_posts WHERE slug = ? AND published = 1`)
    .bind(slug)
    .first<BlogPost>();
  return row ?? null;
}

export async function getPostById(db: D1Database, id: number): Promise<BlogPostFull | null> {
  const row = await db
    .prepare(`SELECT ${COLS}, published, updated_by FROM blog_posts WHERE id = ?`)
    .bind(id)
    .first<BlogPostFull>();
  return row ?? null;
}

async function resolveSlug(db: D1Database, desired: string, title: string, excludeId?: number): Promise<string> {
  const base = slugify(desired || title);
  const exists = async (s: string) => {
    const row = await db.prepare('SELECT id FROM blog_posts WHERE slug = ?').bind(s).first<{ id: number }>();
    return row != null && row.id !== excludeId;
  };
  return uniqueSlug(exists, base);
}

export async function createPost(db: D1Database, input: BlogPostInput, email: string): Promise<number> {
  const slug = await resolveSlug(db, input.slug ?? '', input.title);
  const excerpt = (input.excerpt && input.excerpt.trim()) || deriveExcerpt(input.body);
  const r = await db
    .prepare(
      `INSERT INTO blog_posts (title, slug, author, category, tags, excerpt, body, read_minutes, published, published_at, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.title,
      slug,
      input.author || null,
      input.category || null,
      input.tags || null,
      excerpt,
      input.body,
      readMinutes(input.body),
      input.published ? 1 : 0,
      input.published_at || null,
      email,
    )
    .run();
  return Number(r.meta.last_row_id);
}

export async function updatePost(db: D1Database, id: number, input: BlogPostInput, email: string): Promise<void> {
  const slug = await resolveSlug(db, input.slug ?? '', input.title, id);
  const excerpt = (input.excerpt && input.excerpt.trim()) || deriveExcerpt(input.body);
  await db
    .prepare(
      `UPDATE blog_posts SET title=?, slug=?, author=?, category=?, tags=?, excerpt=?, body=?, read_minutes=?,
        published=?, published_at=?, updated_by=?, updated_at=datetime('now') WHERE id=?`,
    )
    .bind(
      input.title,
      slug,
      input.author || null,
      input.category || null,
      input.tags || null,
      excerpt,
      input.body,
      readMinutes(input.body),
      input.published ? 1 : 0,
      input.published_at || null,
      email,
      id,
    )
    .run();
}

export async function setPostPublished(db: D1Database, id: number, published: boolean): Promise<void> {
  await db
    .prepare("UPDATE blog_posts SET published=?, updated_at=datetime('now') WHERE id=?")
    .bind(published ? 1 : 0, id)
    .run();
}

export async function setPostCover(db: D1Database, id: number, key: string): Promise<void> {
  await db.prepare("UPDATE blog_posts SET cover_key=?, updated_at=datetime('now') WHERE id=?").bind(key, id).run();
}

export async function deletePost(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM blog_posts WHERE id = ?').bind(id).run();
}
```

- [ ] **Step 5: Run test to verify it passes**

Run:
```bash
npx vitest run tests/db/blog.test.ts
```
Expected: PASS (all cases).

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/schemas.ts src/lib/db/blog.ts tests/db/blog.test.ts
git commit -m "feat(blog): input schema + D1 data layer"
```

---

## Task 4: Admin counts + admin list helper

**Files:**
- Modify: `src/lib/db/admin.ts`
- Test: `tests/db/blog.test.ts` (append)

This task adds an **admin-shaped** `listAllPosts` (lighter columns, incl. drafts) to `src/lib/db/admin.ts` — distinct from the public `listPublishedPosts` in `blog.ts`.

- [ ] **Step 1: Write the failing test (append)**

Append to `tests/db/blog.test.ts`:
```ts
import { getCounts, listAllPosts as adminListAllPosts } from '../../src/lib/db/admin';

describe('blog admin reads', () => {
  it('getCounts includes blog (published + drafts)', async () => {
    const c = await getCounts(ctx.db);
    expect(typeof c.blog).toBe('number');
    expect(c.blog).toBeGreaterThanOrEqual(1);
  });
  it('listAllPosts returns drafts + published, newest first', async () => {
    const rows = await adminListAllPosts(ctx.db);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]).toHaveProperty('published');
  });
});
```

- [ ] **Step 2: Implement in `admin.ts`**

In `src/lib/db/admin.ts`, extend the counts. Update the `AdminCounts` interface and `getCounts` query:
```ts
export interface AdminCounts {
  sermons: number;
  events: number;
  ministries: number;
  visitors: number;
  registrations: number;
  blog: number;
}

export async function getCounts(db: D1Database): Promise<AdminCounts> {
  const row = await db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM sermons) AS sermons,
        (SELECT COUNT(*) FROM events) AS events,
        (SELECT COUNT(*) FROM ministries) AS ministries,
        (SELECT COUNT(*) FROM visitors) AS visitors,
        (SELECT COUNT(*) FROM event_registrations) AS registrations,
        (SELECT COUNT(*) FROM blog_posts) AS blog`,
    )
    .first<AdminCounts>();
  return row ?? { sermons: 0, events: 0, ministries: 0, visitors: 0, registrations: 0, blog: 0 };
}
```

Append an admin-shaped list helper at the end of `src/lib/db/admin.ts`:
```ts
export interface AdminBlogRow {
  id: number;
  title: string;
  slug: string;
  category: string | null;
  published_at: string | null;
  published: number;
}
export async function listAllPosts(db: D1Database): Promise<AdminBlogRow[]> {
  const { results } = await db
    .prepare(
      `SELECT id, title, slug, category, published_at, published FROM blog_posts
       ORDER BY COALESCE(published_at, created_at) DESC, id DESC`,
    )
    .all<AdminBlogRow>();
  return results;
}
```

- [ ] **Step 3: Run tests to verify they pass**

Run:
```bash
npx vitest run tests/db/blog.test.ts tests/db/admin.test.ts
```
Expected: PASS. (`admin.test.ts` still passes — it asserts only `sermons`/`events`/`visitors`, which are unchanged.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/admin.ts tests/db/blog.test.ts
git commit -m "feat(blog): admin counts + admin list helper"
```

---

## Task 5: Admin API routes

**Files:**
- Create: `src/pages/api/admin/blog.ts`
- Create: `src/pages/api/admin/blog/upload.ts`

- [ ] **Step 1: Write the CRUD API**

Create `src/pages/api/admin/blog.ts`:
```ts
import type { APIRoute } from 'astro';
import { env } from '../../../lib/runtime';
import { requireAdmin } from '../../../lib/admin-auth';
import { BlogPostInputSchema } from '../../../lib/db/schemas';
import { createPost, updatePost, deletePost, setPostPublished, setPostCover } from '../../../lib/db/blog';
import { uploadImage } from '../../../lib/media';

export const POST: APIRoute = async ({ request }) => {
  const auth = requireAdmin(request, env, import.meta.env.DEV);
  if ('response' in auth) return auth.response;
  const form = await request.formData();
  const action = String(form.get('_action') ?? '');
  const id = Number(form.get('id') ?? 0);
  try {
    if (action === 'delete') {
      await deletePost(env.DB, id);
    } else if (action === 'toggle') {
      await setPostPublished(env.DB, id, String(form.get('published')) === 'true');
    } else {
      const data = BlogPostInputSchema.parse(Object.fromEntries(form));
      const targetId = action === 'update' ? id : await createPost(env.DB, data, auth.email);
      if (action === 'update') await updatePost(env.DB, id, data, auth.email);
      const image = form.get('image');
      if (image instanceof File && image.size > 0) {
        const key = await uploadImage(env.MEDIA, image, 'blog');
        await setPostCover(env.DB, targetId, key);
      }
    }
  } catch {
    return new Response('Invalid submission', { status: 400 });
  }
  return new Response(null, { status: 303, headers: { Location: '/admin/blog' } });
};
```

- [ ] **Step 2: Write the inline-image upload endpoint**

Create `src/pages/api/admin/blog/upload.ts`:
```ts
import type { APIRoute } from 'astro';
import { env } from '../../../../lib/runtime';
import { requireAdmin } from '../../../../lib/admin-auth';
import { uploadImage, mediaUrl } from '../../../../lib/media';

export const POST: APIRoute = async ({ request }) => {
  const auth = requireAdmin(request, env, import.meta.env.DEV);
  if ('response' in auth) return auth.response;
  try {
    const form = await request.formData();
    const file = form.get('image');
    if (!(file instanceof File) || file.size === 0) {
      return new Response(JSON.stringify({ error: 'No image provided' }), { status: 400 });
    }
    const key = await uploadImage(env.MEDIA, file, 'blog');
    const url = mediaUrl(key)!;
    return new Response(JSON.stringify({ url, markdown: `![](${url})` }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Upload failed';
    return new Response(JSON.stringify({ error: message }), { status: 400 });
  }
};
```

- [ ] **Step 3: Verify it type-checks via build (deferred)**

These routes are exercised together with the admin UI in Task 9's build. No standalone test (they require the admin-auth request context). Proceed.

- [ ] **Step 4: Commit**

```bash
git add src/pages/api/admin/blog.ts src/pages/api/admin/blog/upload.ts
git commit -m "feat(blog): admin CRUD API + inline image upload endpoint"
```

---

## Task 6: Admin UI — form, pages, nav, dashboard card

**Files:**
- Create: `src/components/admin/BlogForm.astro`
- Create: `src/pages/admin/blog.astro`
- Create: `src/pages/admin/blog/new.astro`
- Create: `src/pages/admin/blog/[id].astro`
- Modify: `src/layouts/AdminLayout.astro:21`
- Modify: `src/pages/admin/index.astro:9-22`

- [ ] **Step 1: Build the admin form**

Create `src/components/admin/BlogForm.astro`:
```astro
---
import Field from '../Field.astro';
import Button from '../Button.astro';
import type { BlogPostFull } from '../../lib/db/blog';
interface Props {
  post?: BlogPostFull | null;
}
const { post } = Astro.props;
const isEdit = !!post;
---
<form method="POST" action="/api/admin/blog" enctype="multipart/form-data" class="flex flex-col gap-6 max-w-2xl">
  <input type="hidden" name="_action" value={isEdit ? 'update' : 'create'} />
  {isEdit && <input type="hidden" name="id" value={String(post!.id)} />}
  <Field label="Title" name="title" required value={post?.title ?? ''} />
  <Field label="Slug (optional)" name="slug" value={post?.slug ?? ''} />
  <Field label="Author" name="author" value={post?.author ?? ''} />
  <Field label="Category" name="category" value={post?.category ?? ''} />
  <Field label="Tags (comma-separated)" name="tags" value={post?.tags ?? ''} />
  <Field label="Excerpt (optional — auto-generated from body if blank)" name="excerpt" textarea value={post?.excerpt ?? ''} />

  <div class="flex flex-col gap-1">
    <label for="f-body" class="text-xs uppercase tracking-wider text-on-surface-variant">Body (Markdown)</label>
    <textarea id="f-body" name="body" required rows="16" class="border border-champagne bg-surface px-4 py-3 font-mono text-sm text-primary" set:text={post?.body ?? ''} />
    <p class="text-xs text-on-surface-variant">
      Markdown supported: <code># Heading</code>, <code>**bold**</code>, <code>- list</code>, <code>[link](url)</code>, <code>![alt](image-url)</code>.
    </p>
  </div>

  <div class="flex flex-col gap-2 border border-champagne/60 p-4 rounded">
    <label for="f-inline" class="text-xs uppercase tracking-wider text-on-surface-variant">Insert an inline image</label>
    <div class="flex items-center gap-3 flex-wrap">
      <input id="f-inline" type="file" accept="image/*" class="text-sm text-on-surface-variant" />
      <button type="button" id="blog-upload-btn" class="border border-primary text-primary px-4 py-2 text-xs uppercase tracking-wider">Upload &amp; insert</button>
      <span id="blog-upload-status" class="text-xs text-on-surface-variant"></span>
    </div>
    <p class="text-xs text-on-surface-variant">Uploads to storage and inserts the Markdown at the end of the body. Max 6 MB.</p>
  </div>

  <div class="flex flex-col gap-1">
    <label for="f-image" class="text-xs uppercase tracking-wider text-on-surface-variant">Featured image (optional, max 6 MB)</label>
    <input id="f-image" name="image" type="file" accept="image/*" class="text-sm text-on-surface-variant" />
    {post?.cover_key && <p class="text-xs text-on-surface-variant">Current: {post.cover_key}</p>}
  </div>

  <Field label="Publish date (YYYY-MM-DD)" name="published_at" value={post?.published_at ?? ''} />
  <Field label="Published" name="published" type="checkbox" checked={!!post?.published} />
  <Button type="submit" variant="primary">{isEdit ? 'Save' : 'Create'}</Button>
</form>

<script>
  const btn = document.getElementById('blog-upload-btn');
  const input = document.getElementById('f-inline') as HTMLInputElement | null;
  const body = document.getElementById('f-body') as HTMLTextAreaElement | null;
  const status = document.getElementById('blog-upload-status');
  btn?.addEventListener('click', async () => {
    if (!input?.files?.length || !body) return;
    const fd = new FormData();
    fd.append('image', input.files[0]);
    if (status) status.textContent = 'Uploading…';
    try {
      const res = await fetch('/api/admin/blog/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      body.value += (body.value.endsWith('\n') ? '' : '\n\n') + data.markdown + '\n';
      input.value = '';
      if (status) status.textContent = 'Inserted ✓';
    } catch (e) {
      if (status) status.textContent = e instanceof Error ? e.message : 'Upload failed';
    }
  });
</script>
```

- [ ] **Step 2: Build the admin list page**

Create `src/pages/admin/blog.astro`:
```astro
---
import AdminLayout from '../../layouts/AdminLayout.astro';
import { env } from '../../lib/runtime';
import { getAdminEmail } from '../../lib/admin-auth';
import { listAllPosts } from '../../lib/db/admin';

const email = getAdminEmail(Astro.request, env, import.meta.env.DEV);
if (!email) return Astro.redirect('/admin/denied');
const posts = await listAllPosts(env.DB).catch(() => []);
---
<AdminLayout title="Blog" email={email} active="blog">
  <div class="flex items-center gap-3 mb-6">
    <a href="/admin/blog/new" class="inline-block bg-primary text-on-primary px-5 py-2 text-sm uppercase tracking-wider">
      + New post
    </a>
  </div>
  <table class="w-full text-sm">
    <thead>
      <tr class="text-left text-on-surface-variant border-b border-champagne">
        <th class="py-2">Title</th><th>Category</th><th>Date</th><th>Status</th><th class="text-right">Actions</th>
      </tr>
    </thead>
    <tbody>
      {
        posts.map((p) => (
          <tr class="border-b border-champagne/50">
            <td class="py-3">
              <a href={`/admin/blog/${p.id}`} class="text-primary hover:text-accent">{p.title}</a>
            </td>
            <td>{p.category}</td>
            <td>{p.published_at}</td>
            <td>{p.published ? 'Published' : 'Draft'}</td>
            <td class="text-right whitespace-nowrap">
              <form method="POST" action="/api/admin/blog" class="inline">
                <input type="hidden" name="_action" value="toggle" />
                <input type="hidden" name="id" value={String(p.id)} />
                <input type="hidden" name="published" value={p.published ? 'false' : 'true'} />
                <button class="text-accent text-xs uppercase tracking-wider">{p.published ? 'Unpublish' : 'Publish'}</button>
              </form>
              <form method="POST" action="/api/admin/blog" class="inline ml-3" onsubmit="return confirm('Delete this post?')">
                <input type="hidden" name="_action" value="delete" />
                <input type="hidden" name="id" value={String(p.id)} />
                <button class="text-accent-deep text-xs uppercase tracking-wider">Delete</button>
              </form>
            </td>
          </tr>
        ))
      }
    </tbody>
  </table>
  {posts.length === 0 && <p class="text-on-surface-variant mt-4">No posts yet.</p>}
</AdminLayout>
```

- [ ] **Step 3: Build the new + edit pages**

Create `src/pages/admin/blog/new.astro`:
```astro
---
import AdminLayout from '../../../layouts/AdminLayout.astro';
import BlogForm from '../../../components/admin/BlogForm.astro';
import { env } from '../../../lib/runtime';
import { getAdminEmail } from '../../../lib/admin-auth';

const email = getAdminEmail(Astro.request, env, import.meta.env.DEV);
if (!email) return Astro.redirect('/admin/denied');
---
<AdminLayout title="New Post" email={email} active="blog">
  <BlogForm />
  <a href="/admin/blog" class="inline-block mt-8 text-accent text-sm uppercase tracking-widest">← Back</a>
</AdminLayout>
```

Create `src/pages/admin/blog/[id].astro`:
```astro
---
import AdminLayout from '../../../layouts/AdminLayout.astro';
import BlogForm from '../../../components/admin/BlogForm.astro';
import { env } from '../../../lib/runtime';
import { getAdminEmail } from '../../../lib/admin-auth';
import { getPostById } from '../../../lib/db/blog';

const email = getAdminEmail(Astro.request, env, import.meta.env.DEV);
if (!email) return Astro.redirect('/admin/denied');
const id = Number(Astro.params.id);
const post = Number.isFinite(id) ? await getPostById(env.DB, id).catch(() => null) : null;
if (!post) return Astro.redirect('/admin/blog');
---
<AdminLayout title="Edit Post" email={email} active="blog">
  <BlogForm post={post} />
  <a href="/admin/blog" class="inline-block mt-8 text-accent text-sm uppercase tracking-widest">← Back</a>
</AdminLayout>
```

- [ ] **Step 4: Add the admin nav item**

In `src/layouts/AdminLayout.astro`, add to `allNav` right after the Sermons entry (line 19):
```ts
  { label: 'Blog', href: '/admin/blog', key: 'blog', gate: 'blog' },
```

- [ ] **Step 5: Add the dashboard count card**

In `src/pages/admin/index.astro`, update the `getCounts` fallback and the `cards` array:
```ts
const counts = await getCounts(env.DB).catch(() => ({
  sermons: 0,
  events: 0,
  ministries: 0,
  visitors: 0,
  registrations: 0,
  blog: 0,
}));
const cards = [
  { label: 'Sermons', value: counts.sermons, href: '/admin/sermons' },
  { label: 'Blog', value: counts.blog, href: '/admin/blog' },
  { label: 'Events', value: counts.events, href: '/admin/events' },
  { label: 'Ministries', value: counts.ministries, href: '/admin/ministries' },
  { label: 'Visitors', value: counts.visitors, href: '/admin/people' },
  { label: 'Registrations', value: counts.registrations, href: '/admin/events' },
];
```

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/BlogForm.astro src/pages/admin/blog.astro "src/pages/admin/blog/new.astro" "src/pages/admin/blog/[id].astro" src/layouts/AdminLayout.astro src/pages/admin/index.astro
git commit -m "feat(blog): admin form, list/new/edit pages, nav + dashboard card"
```

---

## Task 7: Public UI — card, index, post page

**Files:**
- Create: `src/components/BlogCard.astro`
- Create: `src/pages/blog/index.astro`
- Create: `src/pages/blog/[slug].astro`

- [ ] **Step 1: Build the excerpt card**

Create `src/components/BlogCard.astro`:
```astro
---
import type { BlogPost } from '../lib/db/blog';
interface Props {
  post: BlogPost;
  image: string;
}
const { post, image } = Astro.props;
const date = (post.published_at ?? post.created_at ?? '').slice(0, 10);
const meta = [post.author, date, post.read_minutes ? `${post.read_minutes} min read` : null].filter(Boolean).join(' · ');
---
<a
  href={`/blog/${post.slug}`}
  class="card-lift group block bg-surface-container-lowest border border-champagne elev-1 hover:border-heritage-gold/40 overflow-hidden"
>
  <div class="relative aspect-[16/10] overflow-hidden">
    <img src={image} alt={post.title} loading="lazy" decoding="async" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
    <div class="absolute inset-0 bg-gradient-to-t from-primary/40 via-transparent to-transparent"></div>
  </div>
  <div class="p-8">
    {post.category && <span class="font-label-sm uppercase tracking-widest text-heritage-gold mb-2 block">{post.category}</span>}
    <h3 class="font-display text-headline-md text-primary mb-3 group-hover:text-heritage-gold transition-colors">{post.title}</h3>
    {post.excerpt && <p class="font-body text-body-md text-stone-gray mb-5 line-clamp-3">{post.excerpt}</p>}
    <div class="flex items-center justify-between">
      <span class="font-body text-body-sm text-stone-gray">{meta}</span>
      <span class="font-label-sm uppercase tracking-[0.14em] text-primary border-b border-primary/20 group-hover:border-heritage-gold transition-colors">Read</span>
    </div>
  </div>
</a>
```

- [ ] **Step 2: Build the public index**

Create `src/pages/blog/index.astro`:
```astro
---
import PublicLayout from '../../layouts/PublicLayout.astro';
import PageHero from '../../components/PageHero.astro';
import BlogCard from '../../components/BlogCard.astro';
import { env } from '../../lib/runtime';
import { mediaUrl } from '../../lib/media';
import { PLACEHOLDER } from '../../lib/images';
import { SITE } from '../../lib/seo';
import { feature } from '../../config/church';
import { listPublishedPosts, listPublishedPostsByCategory, listCategories, type BlogPost } from '../../lib/db/blog';

if (!feature('blog')) return Astro.redirect('/');

const category = (Astro.url.searchParams.get('category') ?? '').trim();
let posts: BlogPost[] = [];
let categories: string[] = [];
try {
  [posts, categories] = await Promise.all([
    category ? listPublishedPostsByCategory(env.DB, category) : listPublishedPosts(env.DB),
    listCategories(env.DB),
  ]);
} catch {
  posts = [];
}
const fallback = [PLACEHOLDER.card, PLACEHOLDER.card, PLACEHOLDER.card];
---
<PublicLayout title={`Blog | ${SITE.name}`} description={`Reflections, teaching, and stories from ${SITE.name}.`}>
  <PageHero height="h-[360px] md:h-[460px]">
    <span class="font-label-sm uppercase tracking-[0.3em] text-heritage-gold mb-4 block hero-shadow">Reflections</span>
    <h1 class="font-display text-display-mobile md:text-display-lg text-white hero-shadow">Blog</h1>
    <p class="font-body text-body-lg text-white/85 max-w-2xl mx-auto mt-4 hero-shadow">
      Teaching, testimony, and stories from our church family.
    </p>
  </PageHero>
  <section class="py-16 md:py-24 px-margin-mobile md:px-margin-desktop max-w-[var(--container-max)] mx-auto">
    {
      categories.length > 0 && (
        <div class="flex flex-wrap justify-center gap-3 mb-12">
          <a href="/blog" class={`font-label-sm uppercase tracking-widest px-4 py-2 border ${!category ? 'border-heritage-gold text-heritage-gold' : 'border-champagne text-stone-gray hover:text-primary'}`}>All</a>
          {categories.map((cat) => (
            <a href={`/blog?category=${encodeURIComponent(cat)}`} class={`font-label-sm uppercase tracking-widest px-4 py-2 border ${category === cat ? 'border-heritage-gold text-heritage-gold' : 'border-champagne text-stone-gray hover:text-primary'}`}>{cat}</a>
          ))}
        </div>
      )
    }
    {
      posts.length === 0 ? (
        <p class="text-center text-stone-gray font-body">
          {category ? 'No posts in this category yet.' : 'No posts published yet — check back soon.'}
        </p>
      ) : (
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10" data-reveal>
          {posts.map((p, i) => (
            <BlogCard post={p} image={mediaUrl(p.cover_key) ?? fallback[i % fallback.length]} />
          ))}
        </div>
      )
    }
  </section>
</PublicLayout>
```

- [ ] **Step 3: Build the post page**

Create `src/pages/blog/[slug].astro`:
```astro
---
import PublicLayout from '../../layouts/PublicLayout.astro';
import { env } from '../../lib/runtime';
import { mediaUrl } from '../../lib/media';
import { SITE } from '../../lib/seo';
import { feature } from '../../config/church';
import { getPostBySlug } from '../../lib/db/blog';
import { renderMarkdown } from '../../lib/blog/markdown';

if (!feature('blog')) return Astro.redirect('/');

const { slug } = Astro.params;
const post = slug ? await getPostBySlug(env.DB, slug).catch(() => null) : null;
if (!post) return Astro.redirect('/blog');

const cover = mediaUrl(post.cover_key);
const date = (post.published_at ?? post.created_at ?? '').slice(0, 10);
const meta = [post.author, date, post.read_minutes ? `${post.read_minutes} min read` : null].filter(Boolean).join(' · ');
const tags = (post.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean);
const html = renderMarkdown(post.body);
---
<PublicLayout
  title={`${post.title} | ${SITE.name}`}
  description={post.excerpt ?? post.title}
  type="article"
  image={cover ?? undefined}
>
  <article>
    <header class="bg-primary-container py-20 md:py-28">
      <div class="max-w-3xl mx-auto px-margin-mobile md:px-margin-desktop text-center">
        {post.category && <span class="font-label-sm uppercase tracking-[0.3em] text-heritage-gold mb-4 block">{post.category}</span>}
        <h1 class="font-display text-display-mobile md:text-headline-lg text-white mb-5">{post.title}</h1>
        <p class="font-body text-body-md text-white/70">{meta}</p>
      </div>
    </header>

    {cover && (
      <div class="max-w-4xl mx-auto px-margin-mobile md:px-margin-desktop -mt-12 md:-mt-16 relative z-10">
        <div class="aspect-[16/9] overflow-hidden border border-white/10 shadow-2xl">
          <img src={cover} alt={post.title} loading="lazy" decoding="async" class="w-full h-full object-cover" />
        </div>
      </div>
    )}

    <div class="max-w-3xl mx-auto px-margin-mobile md:px-margin-desktop py-16 md:py-20">
      <div class="article-body font-body text-body-lg text-stone-gray leading-relaxed" set:html={html} />

      {tags.length > 0 && (
        <div class="mt-12 flex flex-wrap gap-2">
          {tags.map((t) => (
            <span class="font-label-sm uppercase tracking-widest text-stone-gray border border-champagne px-3 py-1">{t}</span>
          ))}
        </div>
      )}

      <div class="mt-14">
        <a href="/blog" class="text-heritage-gold font-label-md uppercase tracking-widest border-b border-heritage-gold/40 hover:border-heritage-gold transition-all">
          ← All posts
        </a>
      </div>
    </div>
  </article>
</PublicLayout>

<style>
  .article-body :global(h2) { font-family: var(--font-display); font-size: 1.75rem; color: var(--color-primary, #3b3a6b); margin: 2rem 0 1rem; }
  .article-body :global(h3) { font-family: var(--font-display); font-size: 1.35rem; color: var(--color-primary, #3b3a6b); margin: 1.75rem 0 0.75rem; }
  .article-body :global(p) { margin: 0 0 1.25rem; }
  .article-body :global(ul), .article-body :global(ol) { margin: 0 0 1.25rem 1.25rem; list-style: disc; }
  .article-body :global(ol) { list-style: decimal; }
  .article-body :global(li) { margin: 0.4rem 0; }
  .article-body :global(a) { color: var(--color-heritage-gold, #b08a3e); text-decoration: underline; }
  .article-body :global(blockquote) { border-left: 3px solid var(--color-heritage-gold, #b08a3e); padding-left: 1.25rem; font-style: italic; margin: 1.5rem 0; }
  .article-body :global(img) { width: 100%; height: auto; border-radius: 0.5rem; margin: 2rem 0; }
  .article-body :global(code) { background: rgba(0,0,0,0.05); padding: 0.1rem 0.35rem; border-radius: 0.25rem; font-size: 0.9em; }
  .article-body :global(pre) { background: rgba(0,0,0,0.05); padding: 1rem; border-radius: 0.5rem; overflow-x: auto; margin: 1.5rem 0; }
</style>
```

> **Note on `PageHero` without an image:** `src/pages/blog/index.astro` uses `<PageHero>` with no `image` prop. Confirm `src/components/PageHero.astro` renders acceptably without one (it is used elsewhere with `cimg(...)`). If `PageHero` requires an `image`, pass a placeholder: `image={PLACEHOLDER.card}`. Verify during Step 4.

- [ ] **Step 4: Verify the build compiles**

Run:
```bash
npm run build
```
Expected: build succeeds with no type errors. If `PageHero` errors on a missing `image`, apply the placeholder noted above and rebuild.

- [ ] **Step 5: Commit**

```bash
git add src/components/BlogCard.astro "src/pages/blog/index.astro" "src/pages/blog/[slug].astro"
git commit -m "feat(blog): public blog index, post page, excerpt card"
```

---

## Task 8: Homepage section, public nav, sitemap

**Files:**
- Modify: `src/pages/index.astro`
- Modify: `src/components/Nav.astro:4-23`
- Modify: `src/pages/sitemap.xml.ts`

- [ ] **Step 1: Add the homepage "From the Blog" section**

In `src/pages/index.astro`, add the import (near the other `listPublished*` imports, ~line 7):
```ts
import { listPublishedPosts } from '../lib/db/blog';
import BlogCard from '../components/BlogCard.astro';
```

Add a `latestPosts` declaration after the `dbCards` declaration (~line 22):
```ts
let latestPosts: Awaited<ReturnType<typeof listPublishedPosts>> = [];
```

Add `listPublishedPosts(env.DB, 3)` to the `Promise.all` and destructure it. Replace the existing `Promise.all` block (lines 24–35) with:
```ts
  const [s, e, settings, cm, cards, posts] = await Promise.all([
    listPublishedSermons(env.DB, 1),
    listUpcomingEvents(env.DB, 3),
    getAllSettings(env.DB),
    getAllContent(env.DB),
    listHomeCards(env.DB),
    listPublishedPosts(env.DB, 3),
  ]);
  latestSermon = s[0] ?? null;
  events = e;
  serviceTimes = settings.service_times ? JSON.parse(settings.service_times) : [];
  contentMap = cm;
  dbCards = cards;
  latestPosts = posts;
```

Then add this section just before the final `feature('community')` block (before line 381, after the giving `</section>` + `)}`):
```astro
  {feature('blog') && latestPosts.length > 0 && (
    <section class="py-24 md:py-36 bg-surface-container-low">
      <div class="max-w-[var(--container-max)] mx-auto px-margin-mobile md:px-margin-desktop">
        <div class="flex justify-between items-end mb-16" data-reveal>
          <div>
            <span class="text-heritage-gold font-label-sm uppercase tracking-[0.3em] mb-4 block">From the Blog</span>
            <h2 class="font-display text-display-mobile md:text-headline-lg text-primary">Latest Reflections</h2>
          </div>
          <a href="/blog" class="hidden md:inline-flex items-center gap-2 text-primary font-label-md uppercase tracking-[0.14em] link-underline">
            View all
          </a>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
          {latestPosts.map((p, i) => (
            <BlogCard post={p} image={mediaUrl(p.cover_key) ?? PLACEHOLDER.card} />
          ))}
        </div>
        <div class="text-center mt-12 md:hidden">
          <a href="/blog" class="text-primary font-label-md uppercase tracking-[0.14em] border-b border-heritage-gold/40">View all posts</a>
        </div>
      </div>
    </section>
  )}
```
(`mediaUrl` and `PLACEHOLDER` are already imported in this file.)

- [ ] **Step 2: Add the public nav link**

In `src/components/Nav.astro`, add a Blog entry to `allLinks` (after the Sermons entry):
```ts
  { label: 'Blog', href: '/blog' },
```
And add it to `featureOf`:
```ts
  '/blog': 'blog',
```

- [ ] **Step 3: Add blog URLs to the sitemap**

In `src/pages/sitemap.xml.ts`:

Add the import:
```ts
import { listPublishedPosts } from '../lib/db/blog';
```
Add `/blog` to the static `urls` array:
```ts
    { loc: absUrl('/blog', origin) },
```
Inside the `try` block, fetch posts and append them. Replace the `Promise.all` line and following loops with:
```ts
    const [sermons, events, posts] = await Promise.all([
      listPublishedSermons(env.DB),
      listUpcomingEvents(env.DB),
      listPublishedPosts(env.DB),
    ]);
    for (const s of sermons) urls.push({ loc: absUrl(`/sermons/${s.slug}`, origin), lastmod: toIso(s.sermon_date) });
    for (const e of events) urls.push({ loc: absUrl(`/events/${e.slug}`, origin), lastmod: toIso(e.start_at) });
    for (const p of posts) urls.push({ loc: absUrl(`/blog/${p.slug}`, origin), lastmod: toIso(p.published_at ?? p.created_at) });
    // ministries currently have no public detail route; surfaced only via /ministries
    await listPublishedMinistries(env.DB);
```

- [ ] **Step 4: Verify the build compiles**

Run:
```bash
npm run build
```
Expected: build succeeds, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/index.astro src/components/Nav.astro src/pages/sitemap.xml.ts
git commit -m "feat(blog): homepage section, public nav link, sitemap entries"
```

---

## Task 9: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run:
```bash
npm test
```
Expected: all tests PASS (including the new `tests/blog/markdown.test.ts` and `tests/db/blog.test.ts`).

- [ ] **Step 2: Run the production build**

Run:
```bash
npm run build
```
Expected: build succeeds with no errors.

- [ ] **Step 3: Manual smoke test (dev server)**

Run:
```bash
npm run dev
```
Then verify in a browser (admin auth is bypassed in DEV via `import.meta.env.DEV`):
1. Visit `/admin/blog` → "+ New post" → fill Title + Body (include a Markdown image and an inline-image upload) → check Published → Create.
2. Confirm redirect to `/admin/blog` and the post appears.
3. Visit `/blog` → the card shows the excerpt + cover image; category chips appear if a category was set.
4. Click the card → `/blog/[slug]` renders the Markdown body, cover image, meta row, and tags; inline images lazy-load.
5. Visit `/` → "Latest Reflections" section shows the post; "View all" links to `/blog`.
6. Confirm "Blog" appears in both the public nav and the admin sidebar, and `/sitemap.xml` includes the post URL.

Stop the dev server when done.

- [ ] **Step 4: Apply the migration to the live D1 (deploy step — only when deploying)**

The migration is applied locally/automatically in tests. For production, apply it before/with the next deploy:
```bash
npx wrangler d1 migrations apply <DB_BINDING_OR_NAME> --remote
```
(Use the same database name configured in `wrangler.jsonc`. Confirm the exact command against the project's existing deploy process in `PROVISIONING.md` / `README.md`.)

---

## Self-Review Notes

- **Spec coverage:** Markdown+R2 authoring (Tasks 2,5,6) ✓; 3-card homepage section (Task 8) ✓; author/category/tags/read-time fields (Tasks 1,3,6,7) ✓; auto excerpt (Tasks 2,3) ✓; server-side render, lazy images (Tasks 2,7) ✓; admin CRUD (Tasks 5,6) ✓; public index+detail (Task 7) ✓; feature flag, sitemap, nav (Tasks 1,8) ✓; tests (Tasks 2,3,4) ✓.
- **Naming consistency:** data-layer functions (`listPublishedPosts`, `getPostBySlug`, `getPostById`, `createPost`, `updatePost`, `setPostPublished`, `setPostCover`, `deletePost`, `listPublishedPostsByCategory`, `listCategories`) are referenced identically across API, pages, and tests. The admin-shaped `listAllPosts` lives in `admin.ts` (not `blog.ts`) — Task 4 explicitly corrects the Task 3 test import to avoid a name clash.
- **Out of scope (YAGNI):** comments, author accounts, WYSIWYG editor, responsive-srcset pipeline.
