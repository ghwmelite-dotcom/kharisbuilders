# Phase E3: Replaceable Page Images — Design Spec

**Date:** 2026-06-04
**Status:** Approved (design), pending spec review
**Builds on:** E1 (content registry + editor + `page_content` store + content save route) and the R2 `uploadImage`/`mediaUrl`/`/media` patterns (A1).

---

## 1. Purpose & Goals

Make every **singleton page image** (hero backgrounds, the pastor portrait, the Vision image, the scripture/giving band backgrounds, and the other page heroes) replaceable from the admin — completing "every word and every image is editable."

**Success criteria**
- Staff replace any key page image by uploading from the **Content** editor; it appears immediately.
- The site is **unchanged** until staff upload (each image field defaults to its current bundled path).
- Clearing/replacing is safe: no upload → the default bundled image is served; never a broken image.

**Decisions locked in (brainstorming):** extend the E1 content registry with an `image` field type; upload in the Content editor; resolver returns uploaded image or default; cover all singleton images including the other page heroes.

---

## 2. Scope

**In scope (E3):** an `image` field type in the registry; a `cimg(key)` image resolver; image upload handling in the content save route; `page/` added to the media allowlist; image fields for home/about/visit singletons **and** the Sermons/Events/Ministries/Giving hero backgrounds (those pages start loading content to resolve their hero). Tests.

**Out of scope:** the bundled images themselves (kept as defaults); list-item images (done in E2); sermon/event/ministry content images (already uploadable); a media library/browser (deferred).

---

## 3. Architecture — image fields in the content system

Reuses everything from E1. An image field stores an **R2 key** in `page_content` (only when staff upload); its registry **default is the current bundled path**.

```
registry field { key, type:'image', default:'/images/home-1.jpg', label }
store:  page_content[key] = '<R2 key>'  (set only on upload; text save ignores image fields)
resolve: cimg(key) = stored[key] (non-blank) ? mediaUrl(stored[key]) : default
editor:  image field → file input + <img> preview of cimg(key)
save:    multipart → for each image field with a File, uploadImage(MEDIA, file, 'page') → setContent({key: r2Key})
```

No new table. No new secret.

---

## 4. Components & Boundaries

**Registry (`src/lib/content/fields.ts`)** — extend `FieldType` with `'image'`; add image fields (defaults = current bundled paths). `contentDefaults()`/`contentKeySet()` already derive from all fields, so images are included automatically. New image fields:
- `home.hero_image` `/images/home-1.jpg`, `home.pastor_image` `/images/home-2.jpg`, `home.scripture_image` `/images/home-7.jpg`, `home.giving_image` `/images/home-7.jpg`
- `about.hero_image` `/images/about-1.jpg`, `about.vision_image` `/images/about-2.jpg`
- `visit.hero_image` `/images/visit-1.jpg`, `visit.afterward_image` `/images/visit-2.jpg`
- A new page group **"Other page heroes"** (registry page slug `pages`) or per-page: `pages.sermons_hero` `/images/home-3.jpg`, `pages.events_hero` `/images/home-4.jpg`, `pages.ministries_hero` `/images/ministries-1.jpg`, `pages.giving_hero` `/images/home-2.jpg`.

> The registry's `ContentPage.slug` union expands to include `'pages'`. The editor and save route already iterate `CONTENT_PAGES` generically, so a 4th page "Other Pages" appears automatically.

**Image resolver (`src/lib/content/content.ts`)** — add:
```ts
import { mediaUrl } from '../media';
export type ImageFn = (key: string) => string;
export function makeImage(stored: Record<string, string>): ImageFn {
  return (key) => {
    const v = stored[key];
    if (typeof v === 'string' && v.trim().length > 0) return mediaUrl(v) ?? defaultFor(key);
    return defaultFor(key);
  };
}
```
where `defaultFor(key)` reads `contentDefaults()[key] ?? ''`. (Stored value is always an R2 key — the editor only writes a value on upload — so `mediaUrl` is correct; the `?? defaultFor` guard covers a malformed key.)

**Content save route (`src/pages/api/admin/content.ts`)** — handle image fields:
- Build a map of `key → field.type` from the registry (or just an image-key set).
- For text fields: keep the current behaviour (write the string value).
- For image fields: read `form.get(key)`; if it's a non-empty `File`, `uploadImage(env.MEDIA, file, 'page')` → set `entries[key] = r2Key`. If it's not a File (no new upload), **leave the existing stored value untouched** (don't overwrite with empty).
- The form must be `enctype="multipart/form-data"`.

**Content editor (`src/pages/admin/content/[page].astro`)** — for `type:'image'` fields, render a current-image preview (`<img src={cimg(key)} class="h-24" />`) + a `<input type="file" name={key} accept="image/*">` + help "Upload to replace; leave empty to keep the current image." Set `enctype="multipart/form-data"` on the form.

**Media route (`src/pages/media/[...key].ts`)** — add `'page/'` to `PUBLIC_PREFIXES`.

**Public pages** — replace hardcoded singleton image paths with `cimg(key)`:
- `index.astro`: hero `<img src>` + the layout OG `image` → `cimg('home.hero_image')`; pastor `<img>` → `cimg('home.pastor_image')`; scripture band `background-image` uses `cimg('home.scripture_image')`; giving band `<img>` → `cimg('home.giving_image')`.
- `about.astro`: PageHero `image={cimg('about.hero_image')}`; vision `<img>` → `cimg('about.vision_image')`.
- `visit.astro`: PageHero `image={cimg('visit.hero_image')}`; afterward `<img>` → `cimg('visit.afterward_image')`.
- `sermons/index.astro`, `events/index.astro`, `ministries.astro`, `giving.astro`: load content (`getAllContent` + `makeImage`) and set their PageHero `image={cimg('pages.<x>_hero')}`. (sermons/index already loads several things — add the content load; others add a small load.)

> Inline `style="background-image: url('/images/home-7.jpg')"` on the scripture band becomes `style={`background-image: linear-gradient(...), url('${cimg('home.scripture_image')}')`}` — build the string in the frontmatter.

---

## 5. Error Handling / Safety

- **No upload** → resolver returns the default bundled path (always a valid image).
- **Bad file type/size** → `uploadImage` throws → caught by the content route's try/catch → 400 (same as other uploads); no partial write of that field.
- **Malformed stored key** → `mediaUrl` returns a `/media/...` URL; if the object is missing, the `/media` route 404s for that one image (graceful, not a page break). The `?? defaultFor` guard covers a null from `mediaUrl`.
- Text save (E1) and image save coexist: image fields without a new File are skipped, so saving the text editor never wipes an uploaded image.

## 6. Security
- Gated by `requireAdmin` + Cloudflare Access on `/api/admin/*`.
- `uploadImage` enforces the image type allowlist + 6 MB cap; `page/` added to the media allowlist so only images under known prefixes serve (A1 hardening preserved).
- `cimg` output is a URL used only in `src`/`background-image`; values are admin-supplied R2 keys, not arbitrary HTML.

## 7. Testing Strategy
**Pure unit tests:** `makeImage` returns the default when no stored value; returns `/media/<key>` when an R2 key is stored; registry has a default (a `/images/...` path) for every `image` field. Registry integrity test (E1) already enforces unique keys + defaults across the new fields.
**Content route image handling:** unit-test the image-entry builder (given a form with an image File for an image key → produces an upload+key write; given no File → no write for that key) via the existing injected patterns where feasible; otherwise verify in dev.
**Manual/dev:** upload a hero image in the Content editor → home hero updates; text-edit the same page → the uploaded image persists; clear nothing → default served.

## 8. Rollout
1. Build + tests green.
2. No migration (reuses `page_content`). Deploy.
3. Verify uploading a page image on the live admin (behind Access) updates the page; defaults render where nothing is uploaded.

## 9. Open Questions (resolved defaults)
- Image fields default to the current bundled paths; uploaded R2 keys live under `page/`.
- Other page heroes grouped under a registry page "Other Pages" (`slug:'pages'`).
- No media library yet (single upload per field); orphan sweep on replace deferred (A1 stance).
