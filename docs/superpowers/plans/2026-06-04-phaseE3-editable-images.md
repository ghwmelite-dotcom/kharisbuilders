# Phase E3: Replaceable Page Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every singleton page image replaceable from the Content editor by adding an `image` field type to the E1 content registry, with each image defaulting to its current bundled path.

**Architecture:** Reuses E1 (registry, `page_content`, content editor, content save route) + A1 (`uploadImage`/`mediaUrl`/`/media`). An image field stores an R2 key on upload; `cimg(key)` resolves to `mediaUrl(key)` when stored else the bundled default. No migration, no secret.

**Tech Stack:** Astro 6 SSR, Cloudflare D1 + R2, Vitest. Spec: `docs/superpowers/specs/2026-06-04-editable-images-e3-design.md`.

**Working dir:** `C:\dev\Projects\KharisBuilders Project\stitch_kharisbuilders_church_web_design` (branch `feat/phaseE3-images` off `main`).

> **Conventions:** content registry `src/lib/content/fields.ts` (E1); resolver `src/lib/content/content.ts` (E1 `makeContent`); store `src/lib/db/content.ts` (`getAllContent`/`setContent`); save route `src/pages/api/admin/content.ts`; editor `src/pages/admin/content/[page].astro`. R2: `uploadImage(bucket,file,prefix)` + `mediaUrl(key)` in `src/lib/media.ts`; media allowlist `PUBLIC_PREFIXES` in `src/pages/media/[...key].ts`. Verbatim current image paths confirmed by audit.

---

## File Structure (modified/created)

```
src/lib/content/fields.ts        # FieldType += 'image'; add image fields + 'Other Pages' page
src/lib/content/content.ts       # + makeImage(stored) resolver
src/pages/api/admin/content.ts   # handle image uploads (multipart)
src/pages/admin/content/[page].astro  # image field UI + enctype
src/pages/media/[...key].ts      # + 'page/' prefix
src/pages/index.astro src/pages/about.astro src/pages/visit.astro
src/pages/sermons/index.astro src/pages/events/index.astro src/pages/ministries.astro src/pages/giving.astro
tests/content/image.test.ts
```

---

## Task 1: registry image fields

**Files:** Modify `src/lib/content/fields.ts`; create `tests/content/image.test.ts`.

- [ ] **Step 1: Extend `FieldType` + slug union**
```ts
export type FieldType = 'text' | 'textarea' | 'url' | 'image';
// ContentPage.slug union:
export interface ContentPage { slug: 'home' | 'about' | 'visit' | 'pages'; title: string; groups: ContentGroup[] }
```

- [ ] **Step 2: Add an "Images" group to the `home` page** (append to its `groups` array)
```ts
{
  title: 'Images',
  fields: [
    { key: 'home.hero_image', label: 'Hero background', type: 'image', default: '/images/home-1.jpg' },
    { key: 'home.pastor_image', label: 'Pastor photo', type: 'image', default: '/images/home-2.jpg' },
    { key: 'home.scripture_image', label: 'Scripture band background', type: 'image', default: '/images/home-7.jpg' },
    { key: 'home.giving_image', label: 'Giving band background', type: 'image', default: '/images/home-7.jpg' },
  ],
},
```

- [ ] **Step 3: Add an "Images" group to `about`**
```ts
{
  title: 'Images',
  fields: [
    { key: 'about.hero_image', label: 'Hero background', type: 'image', default: '/images/about-1.jpg' },
    { key: 'about.vision_image', label: 'Vision & Mission image', type: 'image', default: '/images/about-2.jpg' },
  ],
},
```

- [ ] **Step 4: Add an "Images" group to `visit`**
```ts
{
  title: 'Images',
  fields: [
    { key: 'visit.hero_image', label: 'Hero background', type: 'image', default: '/images/visit-1.jpg' },
    { key: 'visit.afterward_image', label: '"Afterward" image', type: 'image', default: '/images/visit-2.jpg' },
  ],
},
```

- [ ] **Step 5: Add a new `pages` ContentPage** (append to `CONTENT_PAGES`)
```ts
{
  slug: 'pages',
  title: 'Other Pages',
  groups: [
    {
      title: 'Hero backgrounds',
      fields: [
        { key: 'pages.sermons_hero', label: 'Sermons hero', type: 'image', default: '/images/home-3.jpg' },
        { key: 'pages.events_hero', label: 'Events hero', type: 'image', default: '/images/home-4.jpg' },
        { key: 'pages.ministries_hero', label: 'Ministries hero', type: 'image', default: '/images/ministries-1.jpg' },
        { key: 'pages.giving_hero', label: 'Giving hero', type: 'image', default: '/images/home-2.jpg' },
      ],
    },
  ],
},
```

- [ ] **Step 6: Write + run the test** (`tests/content/image.test.ts`)
```ts
import { describe, it, expect } from 'vitest';
import { CONTENT_PAGES, contentDefaults } from '../../src/lib/content/fields';

describe('image fields in registry', () => {
  it('every image field defaults to a bundled /images path', () => {
    const defaults = contentDefaults();
    const imageKeys = CONTENT_PAGES.flatMap((p) => p.groups.flatMap((g) => g.fields)).filter((f) => f.type === 'image');
    expect(imageKeys.length).toBeGreaterThanOrEqual(10);
    for (const f of imageKeys) expect(defaults[f.key]).toMatch(/^\/images\/.+\.(jpg|png)$/);
  });
  it('includes the Other Pages group', () => {
    expect(CONTENT_PAGES.some((p) => p.slug === 'pages')).toBe(true);
  });
});
```
Run → pass. (The E1 `fields.test.ts` registry-integrity test still passes — image fields are namespaced + have defaults.)

- [ ] **Step 7: Commit** `feat: image field type + page-image fields in content registry`.

---

## Task 2: image resolver (TDD)

**Files:** Modify `src/lib/content/content.ts`; create test cases (extend `tests/content/content.test.ts` or new file).

- [ ] **Step 1: Write the failing test** (append to `tests/content/content.test.ts`)
```ts
import { makeImage } from '../../src/lib/content/content';
describe('makeImage', () => {
  it('returns the bundled default when nothing is uploaded', () => {
    expect(makeImage({})('home.hero_image')).toBe('/images/home-1.jpg');
  });
  it('serves an uploaded R2 key via /media', () => {
    expect(makeImage({ 'home.hero_image': 'page/abc.jpg' })('home.hero_image')).toBe('/media/page/abc.jpg');
  });
  it('falls back to default for a blank stored value', () => {
    expect(makeImage({ 'home.hero_image': '  ' })('home.hero_image')).toBe('/images/home-1.jpg');
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement in `src/lib/content/content.ts`** (add below `makeContent`)
```ts
import { mediaUrl } from '../media';

export type ImageFn = (key: string) => string;

/** Resolve a page image: uploaded R2 key -> /media URL; else the registry default (bundled path). */
export function makeImage(stored: Record<string, string>): ImageFn {
  return (key: string) => {
    const def = DEFAULTS[key] ?? '';
    const v = stored[key];
    if (typeof v === 'string' && v.trim().length > 0) return mediaUrl(v) ?? def;
    return def;
  };
}
```
> `DEFAULTS` is the module-level `contentDefaults()` already computed for `makeContent`.

- [ ] **Step 4: Run → pass. Commit** `feat: makeImage resolver (uploaded key or bundled default) with tests`.

---

## Task 3: content save route — image uploads

**Files:** Modify `src/pages/api/admin/content.ts`.

- [ ] **Step 1: Handle image fields** — add an image-key set + upload loop

Replace the body's entry-collection + save with:
```ts
import { setContent } from '../../../lib/db/content';
import { contentKeySet, CONTENT_PAGES } from '../../../lib/content/fields';
import { uploadImage } from '../../../lib/media';
// ...
  const allow = contentKeySet();
  const imageKeys = new Set(
    CONTENT_PAGES.flatMap((p) => p.groups.flatMap((g) => g.fields)).filter((f) => f.type === 'image').map((f) => f.key),
  );
  const entries: Record<string, string> = {};
  try {
    for (const [key, value] of form.entries()) {
      if (!allow.has(key)) continue;
      if (imageKeys.has(key)) {
        if (value instanceof File && value.size > 0) {
          entries[key] = await uploadImage(env.MEDIA, value, 'page');
        }
        // no new file -> leave the existing stored image untouched
      } else if (typeof value === 'string') {
        entries[key] = value;
      }
    }
    await setContent(env.DB, entries, auth.email);
  } catch {
    return new Response('Invalid submission', { status: 400 });
  }
```
Keep the existing `_page` redirect logic.

- [ ] **Step 2: Build → succeeds. Commit** `feat: content save route handles page-image uploads`.

---

## Task 4: media prefix

**Files:** Modify `src/pages/media/[...key].ts`.

- [ ] **Step 1:** `const PUBLIC_PREFIXES = ['sermons/', 'events/', 'ministries/', 'leaders/', 'journey/', 'home-cards/', 'page/'];`

- [ ] **Step 2: Build → succeeds. Commit** `feat: allow page/ media prefix`.

---

## Task 5: content editor — image fields

**Files:** Modify `src/pages/admin/content/[page].astro`.

- [ ] **Step 1:** Add `enctype="multipart/form-data"` to the `<form>`.

- [ ] **Step 2:** Compute an image resolver in the frontmatter: `import { makeImage } from '../../../lib/content/content';` and `const cimg = makeImage(stored);`.

- [ ] **Step 3:** Render `type:'image'` fields as preview + file input — extend the field-render branch:
```astro
{f.type === 'image' ? (
  <div class="flex items-center gap-4">
    <img src={cimg(f.key)} alt="" class="h-20 w-28 object-cover border border-champagne" />
    <input id={f.key} name={f.key} type="file" accept="image/*" class="text-sm text-on-surface-variant" />
  </div>
) : f.type === 'textarea' ? (
  /* existing textarea */
) : (
  /* existing input */
)}
```
Help text for image fields: "Upload to replace; leave empty to keep the current image."

- [ ] **Step 4: Build → succeeds. Commit** `feat: image upload fields in the content editor`.

---

## Task 6: wire public pages to cimg

**Files:** Modify `index.astro`, `about.astro`, `visit.astro`, `sermons/index.astro`, `events/index.astro`, `ministries.astro`, `giving.astro`.

- [ ] **Step 1: `index.astro`** — add `import { makeImage } from '../lib/content/content';` and `const cimg = makeImage(contentMap);` (after `const c = makeContent(contentMap)`). Replace:
  - layout `image="/images/home-1.jpg"` → `image={cimg('home.hero_image')}`
  - hero `<img src="/images/home-1.jpg"` → `src={cimg('home.hero_image')}`
  - pastor `<img src="/images/home-2.jpg"` → `src={cimg('home.pastor_image')}`
  - giving `<img src="/images/home-7.jpg"` → `src={cimg('home.giving_image')}`
  - scripture band: in frontmatter add `const scriptureBg = `linear-gradient(rgba(44,23,69,0.86), rgba(44,23,69,0.92)), url('${cimg('home.scripture_image')}')`;` and set the band `style={`background-image: ${scriptureBg};`}` (replacing the inline literal).

- [ ] **Step 2: `about.astro`** — add `import { makeImage } from '../lib/content/content';`; reuse the already-loaded content: change `const c = makeContent(await getAllContent(env.DB).catch(() => ({})));` to load once into a var and build both `c` and `cimg`:
```ts
const contentMap = await getAllContent(env.DB).catch(() => ({}));
const c = makeContent(contentMap);
const cimg = makeImage(contentMap);
```
Replace PageHero `image="/images/about-1.jpg"` → `image={cimg('about.hero_image')}`; vision `<img src="/images/about-2.jpg"` → `src={cimg('about.vision_image')}`.

- [ ] **Step 3: `visit.astro`** — `import { makeImage }`; `const cimg = makeImage(contentMap);` (contentMap already loaded in E1). Replace PageHero `image="/images/visit-1.jpg"` → `cimg('visit.hero_image')`; afterward `<img src="/images/visit-2.jpg"` → `cimg('visit.afterward_image')`.

- [ ] **Step 4: `sermons/index.astro`** — add `import { getAllContent } from '../../lib/db/content'; import { makeImage } from '../../lib/content/content';` and `const cimg = makeImage(await getAllContent(env.DB).catch(() => ({})));`; set PageHero `image={cimg('pages.sermons_hero')}` (was `/images/home-3.jpg`).

- [ ] **Step 5: `events/index.astro`** — same; PageHero `image={cimg('pages.events_hero')}` (was `/images/home-4.jpg`).

- [ ] **Step 6: `ministries.astro`** — same; PageHero `image={cimg('pages.ministries_hero')}` (was `/images/ministries-1.jpg`).

- [ ] **Step 7: `giving.astro`** — content not loaded yet; add `import { getAllContent } from '../lib/db/content'; import { makeImage } from '../lib/content/content';` and (inside the existing try or a new line) `const cimg = makeImage(await getAllContent(env.DB).catch(() => ({})));`; set PageHero `image={cimg('pages.giving_hero')}` (was `/images/home-2.jpg`).

- [ ] **Step 8: Build → succeeds. Commit** `feat: render all page hero/section images from editable content`.

---

## Task 7: full gate + dev verify

- [ ] **Step 1: Full suite** (`npx vitest run`) — prior 154 + new (~5) pass.
- [ ] **Step 2: Build.**
- [ ] **Step 3: Dev verify** (`npm run dev`):
```bash
# default image renders (no upload yet)
curl -s http://localhost:4321/ | grep -o '/images/home-1.jpg' | head -1
# upload a hero image via the gated content route (a tiny jpg), confirm it switches to /media/page/...
printf '\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xFF\xD9' > /tmp/h.jpg
curl -s -o /dev/null -X POST http://localhost:4321/api/admin/content -H "Origin: http://localhost:4321" -F "_page=home" -F "home.hero_image=@/tmp/h.jpg;type=image/jpeg"
curl -s http://localhost:4321/ | grep -o '/media/page/[a-f0-9]*\.jpg' | head -1   # now an uploaded key
# text-save the same page does NOT wipe the image
curl -s -o /dev/null -X POST http://localhost:4321/api/admin/content -H "Origin: http://localhost:4321" -F "_page=home" -F "home.hero_line1=Building Lives,"
curl -s http://localhost:4321/ | grep -o '/media/page/[a-f0-9]*\.jpg' | head -1   # still present
# content editor renders image fields
curl -s http://localhost:4321/admin/content/home | grep -c 'type="file"'          # >=4
# cleanup
npx wrangler d1 execute kharisbuilders --local --command "DELETE FROM page_content;"
```
Expected: default path renders; upload switches to `/media/page/...`; a subsequent text save keeps the uploaded image; editor shows file inputs.
- [ ] **Step 4: Clean tree.**

---

## Phase E3 Done — Definition of Done
- `image` field type in the registry; all singleton page images (home/about/visit + sermons/events/ministries/giving heroes) have image fields defaulting to their bundled paths.
- Content editor uploads page images (preview + file input); `cimg(key)` serves the upload or the default; a text save never wipes an uploaded image.
- `page/` added to the media allowlist; pages render via `cimg`.
- `npx vitest run` + `npm run build` pass; dev upload round-trip verified.

**EVERY word and image on the public site is now admin-editable** (E1 text · E2 lists · E3 images).

**Next (optional):** a media library/reuse, orphan-image sweep, or other roadmap items (C2 chat, D–G). Giving (B1+B2) still pending the user's Paystack keys.

---

## Open Questions (resolved defaults)
- Uploaded page images stored under `page/`; defaults are the bundled `/images/...` paths.
- Other page heroes grouped under the "Other Pages" registry page.
- No media library yet; orphan sweep deferred.
