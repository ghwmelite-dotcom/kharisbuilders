# Blog Feature — Design Spec

**Date:** 2026-06-16
**Status:** Approved, ready for implementation plan
**Project:** Kharis Builders church website (Astro 6 + Cloudflare Workers + D1 + R2)

## Goal

Add a blog feature where post excerpts are beautifully displayed on the homepage, "view more" opens a dedicated post page, and posts are authored from the admin section. Posts support inline images in the body. The result must be premium, professional, and lightweight (no heavy client-side cost).

## Key decisions (from brainstorming)

- **Authoring:** Markdown body + R2-hosted images.
- **Homepage display:** A "Latest" section with the 3 most recent posts as premium cards + "View all" link.
- **Post fields:** title, slug, author, category (single), tags (multiple), excerpt (optional), body (Markdown), featured image, read time (auto), published toggle, date.
- **Rendering:** Markdown → HTML **server-side** (zero client JS). Images lazy-loaded and served from R2 via the existing `/media/[...key]` route.

## Architecture

Mirrors the existing `sermons` feature end-to-end (data layer → admin CRUD → public list/detail → homepage section → SEO wiring), so it stays consistent with the codebase and is easy to maintain.

### 1. Data model — `migrations/0026_blog.sql`

```sql
CREATE TABLE IF NOT EXISTS blog_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  author TEXT,
  category TEXT,
  tags TEXT,                 -- comma-separated
  excerpt TEXT,              -- optional; auto-derived from body if blank
  body TEXT NOT NULL,        -- Markdown source
  cover_key TEXT,            -- R2 object key for featured image
  read_minutes INTEGER,      -- computed on save
  published INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,         -- public-facing date (YYYY-MM-DD)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_blog_published ON blog_posts(published, published_at DESC);
```

### 2. Data layer — `src/lib/db/blog.ts`

Mirrors `src/lib/db/sermons.ts`. Functions:

- `listPublishedPosts(db, limit = 50)` — published, ordered by `published_at DESC, id DESC`.
- `listPublishedPostsByCategory(db, category, limit)` — for index filtering.
- `getPostBySlug(db, slug)` — single published post (public detail).
- `getPostById(db, id)` — full row incl. `published`, `updated_by` (admin edit).
- `listAllPosts(db)` — admin list (published + drafts).
- `listCategories(db)` — distinct non-null categories among published posts (for filter chips).
- `createPost(db, input, email)` / `updatePost(db, id, input, email)` — resolve unique slug via `slug.ts`, compute `read_minutes`, derive `excerpt` if blank, all via **prepared statements**.
- `setPostPublished(db, id, published)`, `deletePost(db, id)`, `setPostCover(db, id, key)`.

`BlogPostInput` zod schema added alongside the existing schemas in `src/lib/db/schemas`.

### 3. Markdown + helpers — `src/lib/blog/markdown.ts`

- Add **`marked`** dependency (server-side only; nothing ships to the browser).
- `renderMarkdown(md): string` — parse Markdown → HTML. Custom image renderer adds `loading="lazy"`, `decoding="async"`, and wraps images in a styled `<figure>`. Raw inline HTML is escaped (not passed through) — content is admin-authored/trusted, but escaping keeps it safe.
- `deriveExcerpt(body, words = 30): string` — strip Markdown, take first ~30 words.
- `readMinutes(body): number` — word count / ~200 wpm, min 1.

### 4. Image handling

- **Featured image:** file input in `BlogForm` → existing `uploadImage(bucket, file, 'blog')` helper (6 MB cap; jpg/png/webp/avif/gif) → stored as `cover_key`. Served via `mediaUrl(cover_key)` → `/media/...`.
- **Inline images:** small uploader in `BlogForm` posts to `POST /api/admin/blog/upload` (multipart) → uploads to R2 → returns JSON with the `/media/...` URL and ready-to-paste Markdown `![alt](/media/...)`. Minimal inline JS; one-click copy.
- All images lazy-loaded + async-decoded. Featured images use explicit aspect-ratio containers to avoid layout shift (CLS). Responsive srcset / Cloudflare Image Resizing is intentionally **out of scope** (documented as a future enhancement).

### 5. Public pages

- `src/pages/blog/index.astro` — `PublicLayout` + `PageHero`, optional `?category=` filter chips, responsive 1/2/3-col grid of `BlogCard`s. Empty state when no posts. Gated by the `blog` feature flag (redirect home if off).
- `src/pages/blog/[slug].astro` — premium article layout: cover image (aspect-ratio container), title, meta row (author · date · read time), rendered Markdown in a typographic `prose` container, tags footer, "Back to blog" link. Full SEO: title/description from excerpt, `article` OG tags. 404 if not found/unpublished.
- `src/components/BlogCard.astro` — cover image, category eyebrow, title, excerpt, `author · date · read-time` meta, hover-lift; matches `SermonCard` styling language.

### 6. Homepage section

A "From the Blog" / "Latest Reflections" section added to `src/pages/index.astro`: 3 most recent published posts as `BlogCard`s + "View all" link to `/blog`. Hidden when the `blog` flag is off or there are zero published posts.

### 7. Admin section (mirrors sermons)

- `src/pages/admin/blog.astro` — list (title, status, category, date) with edit/delete and publish toggle.
- `src/pages/admin/blog/new.astro` + `src/pages/admin/blog/[id].astro` — create/edit via `BlogForm`.
- `src/components/admin/BlogForm.astro` — fields: Title, Slug (optional), Author, Category, Tags, Excerpt (optional), Body (Markdown textarea), inline-image uploader + short formatting hint, Featured image (file), Date, Published toggle.
- `src/pages/api/admin/blog.ts` — `_action` POST pattern (`create` / `update` / `delete` / `publish`), matching `api/admin/sermons.ts`, including featured-image upload on create/update.
- `src/pages/api/admin/blog/upload.ts` — inline-image upload endpoint (admin-auth guarded).
- Add **"Blog"** nav item to `AdminLayout.astro` (gated on `blog` feature).
- Add a **Blog** count card to the admin dashboard (`getCounts` in `src/lib/db/admin.ts` + `src/pages/admin/index.astro`).

### 8. Wiring & SEO

- Add `blog: boolean` to `ChurchFeatures` in `src/config/church.ts` (default `true` for Kharis Builders); `feature('blog')` gates public + admin surfaces.
- Add published posts to `src/pages/sitemap.xml.ts`.
- Add a **"Blog"** link to the public site nav (`PublicLayout` / header nav).

## Testing (`tests/`, Vitest)

- `readMinutes` and `deriveExcerpt` behavior (word counts, min 1 minute, blank-body edge cases).
- Slug uniqueness on create/update (collision → suffixed slug).
- Markdown rendering: images get `loading="lazy"` / `decoding="async"`; raw inline HTML is escaped.

## Scope guardrails (YAGNI — explicitly out of scope)

- No comments / reactions.
- No per-author user accounts (single free-text byline only).
- No client-side WYSIWYG editor framework.
- No image-resizing / responsive-srcset pipeline (future enhancement).

## Files touched

**New:**
`migrations/0026_blog.sql`, `src/lib/db/blog.ts`, `src/lib/blog/markdown.ts`,
`src/pages/blog/index.astro`, `src/pages/blog/[slug].astro`,
`src/components/BlogCard.astro`, `src/components/admin/BlogForm.astro`,
`src/pages/admin/blog.astro`, `src/pages/admin/blog/new.astro`, `src/pages/admin/blog/[id].astro`,
`src/pages/api/admin/blog.ts`, `src/pages/api/admin/blog/upload.ts`,
plus tests under `tests/`.

**Modified:**
`src/config/church.ts`, `src/layouts/AdminLayout.astro`, `src/pages/admin/index.astro`,
`src/lib/db/admin.ts`, `src/pages/index.astro`, `src/pages/sitemap.xml.ts`,
`src/layouts/PublicLayout.astro` (nav), `src/lib/db/schemas` (BlogPostInput), `package.json` (marked).
