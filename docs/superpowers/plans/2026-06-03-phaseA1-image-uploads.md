# Phase A1: R2 Image Uploads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff upload real images for sermons (thumbnail), events, and ministries through the admin; store them in R2; serve them publicly; and have the public pages use the uploaded image with the existing demo image as fallback.

**Architecture:** Uploads ride along on the existing gated admin entity routes (`/api/admin/{sermons,events,ministries}`). When the create/update form includes a non-empty `image` file, a tested `uploadImage(bucket, file)` helper validates type/size, generates a key, and `put`s it into the R2 `MEDIA` bucket; the returned key is written to the row's `thumbnail_key`/`image_key` column. A public `GET /media/[...key]` route streams the object from R2 with long-lived cache headers. A `mediaUrl(key)` helper builds `/media/<key>`; public components prefer the uploaded image and fall back to the demo image. Pure logic (validation, key generation, url) is unit-tested; the R2 round-trip is tested with the Miniflare harness (which already exposes the `MEDIA` bucket via wrangler.jsonc).

**Tech Stack:** Cloudflare R2 (`MEDIA` binding), Astro 6 SSR, Vitest + Miniflare harness.

**Working directory:** `C:\dev\Projects\KharisBuilders Project\stitch_kharisbuilders_church_web_design` (git repo, branch off `main`).

> **Conventions:** binding via `env` from `src/lib/runtime.ts` in routes; helpers take params and are unit-tested. Admin surfaces stay gated by `requireAdmin`. The `MEDIA` R2 bucket (`kharisbuilders-media`) already exists and is bound. Schema already has `sermons.thumbnail_key`, `events.image_key`, `ministries.image_key`.

---

## File Structure (created/modified)

```
src/lib/media.ts                       # mediaUrl(key); uploadImage(bucket,file)->key; ALLOWED_TYPES/MAX
src/pages/media/[...key].ts            # public GET: stream object from R2 (cache headers)
src/pages/api/admin/sermons.ts         # MODIFY: handle `image` file -> thumbnail_key
src/pages/api/admin/events.ts          # MODIFY: handle `image` file -> image_key
src/pages/api/admin/ministries.ts      # MODIFY: handle `image` file -> image_key
src/lib/db/sermons.ts                  # MODIFY: setSermonImage(db,id,key)
src/lib/db/events.ts                   # MODIFY: setEventImage(db,id,key)
src/lib/db/ministries.ts               # MODIFY: setMinistryImage(db,id,key)
src/components/admin/SermonForm.astro   # MODIFY: add file input
src/components/admin/EventForm.astro
src/components/admin/MinistryForm.astro
src/components/SermonCard.astro         # MODIFY: prefer uploaded image
src/components/EventCard.astro
src/components/MinistryCard.astro       # (unused on public ministries page, but keep consistent)
src/pages/ministries.astro             # MODIFY: use uploaded image_key when present
src/pages/sermons/[slug].astro         # MODIFY: use thumbnail for player poster fallback
src/pages/events/[slug].astro          # MODIFY: hero uses uploaded image_key when present
tests/media.test.ts                    # uploadImage validation + key + mediaUrl (Miniflare R2)
```

---

## Task 1: media helpers (TDD)

**Files:** Create `src/lib/media.ts`, `tests/media.test.ts`.

- [ ] **Step 1: Write the failing test** (`tests/media.test.ts`)

```ts
import { Miniflare } from 'miniflare';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { mediaUrl, uploadImage } from '../src/lib/media';

let mf: Miniflare;
let bucket: R2Bucket;
beforeAll(async () => {
  mf = new Miniflare({ modules: true, script: 'export default {};', r2Buckets: { MEDIA: 'media' } });
  bucket = (await mf.getR2Bucket('MEDIA')) as unknown as R2Bucket;
});
afterAll(async () => {
  await mf.dispose();
});

function file(type: string, bytes = 10, name = 'p.jpg') {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe('mediaUrl', () => {
  it('builds a /media/ path and is null-safe', () => {
    expect(mediaUrl('sermons/abc.jpg')).toBe('/media/sermons/abc.jpg');
    expect(mediaUrl(null)).toBeNull();
    expect(mediaUrl('')).toBeNull();
  });
});

describe('uploadImage', () => {
  it('stores a valid image and returns a prefixed key', async () => {
    const key = await uploadImage(bucket, file('image/jpeg'), 'sermons');
    expect(key).toMatch(/^sermons\/[a-z0-9]+\.jpg$/);
    const obj = await bucket.get(key);
    expect(obj).not.toBeNull();
  });
  it('rejects non-image types', async () => {
    await expect(uploadImage(bucket, file('application/pdf', 10, 'x.pdf'), 'events')).rejects.toThrow(/type/i);
  });
  it('rejects oversized files', async () => {
    await expect(uploadImage(bucket, file('image/png', 6_000_001, 'big.png'), 'events')).rejects.toThrow(/large/i);
  });
});
```

- [ ] **Step 2: Run → fail** (`npx vitest run tests/media.test.ts`).

- [ ] **Step 3: Implement `src/lib/media.ts`**

```ts
export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
};
export const MAX_IMAGE_BYTES = 6_000_000; // 6 MB

export function mediaUrl(key: string | null | undefined): string | null {
  return key ? `/media/${key}` : null;
}

/** Validate + store an uploaded image in R2 under `<prefix>/<rand>.<ext>`; returns the key. */
export async function uploadImage(bucket: R2Bucket, file: File, prefix: string): Promise<string> {
  const ext = ALLOWED_IMAGE_TYPES[file.type];
  if (!ext) throw new Error(`Unsupported image type: ${file.type || 'unknown'}`);
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Image is too large (max 6 MB).');
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const key = `${prefix}/${rand}.${ext}`;
  await bucket.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  return key;
}
```

- [ ] **Step 4: Run → pass.**

- [ ] **Step 5: Commit**

```bash
git add src/lib/media.ts tests/media.test.ts
git commit -m "feat: R2 image upload + mediaUrl helpers with tests"
```

---

## Task 2: public media streaming route

**Files:** Create `src/pages/media/[...key].ts`.

- [ ] **Step 1: Implement the route**

```ts
import type { APIRoute } from 'astro';
import { env } from '../../lib/runtime';

export const GET: APIRoute = async ({ params }) => {
  const key = params.key;
  if (!key) return new Response('Not found', { status: 404 });
  const obj = await env.MEDIA.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  return new Response(obj.body, { headers });
};
```

- [ ] **Step 2: Build to verify it compiles**

```bash
npm run build
```
Expected: succeeds. (Functional verification happens in Task 6 against local R2.)

- [ ] **Step 3: Commit**

```bash
git add src/pages/media/[...key].ts
git commit -m "feat: public R2 media streaming route with long cache"
```

---

## Task 3: per-entity setImage data access (TDD)

**Files:** Modify `src/lib/db/{sermons,events,ministries}.ts`; add tests to a new `tests/db/set-image.test.ts`.

- [ ] **Step 1: Write the failing test** (`tests/db/set-image.test.ts`)

```ts
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from './helpers/d1';
import { createSermon, getSermonById, setSermonImage } from '../../src/lib/db/sermons';
import { createEvent, getEventById, setEventImage } from '../../src/lib/db/events';
import { createMinistry, getMinistryById, setMinistryImage } from '../../src/lib/db/ministries';

let ctx: TestDb;
beforeAll(async () => { ctx = await createTestDb(); });
afterAll(async () => { await ctx.dispose(); });

describe('setImage helpers', () => {
  it('sets sermon thumbnail_key', async () => {
    const id = await createSermon(ctx.db, { title: 'S', slug: '', speaker: '', series: '', scripture_ref: '', video_url: 'https://youtu.be/x', video_provider: 'youtube', description: '', sermon_date: '', published: true }, 'a@x');
    await setSermonImage(ctx.db, id, 'sermons/k.jpg');
    expect((await getSermonById(ctx.db, id))?.thumbnail_key).toBe('sermons/k.jpg');
  });
  it('sets event + ministry image_key', async () => {
    const eid = await createEvent(ctx.db, { title: 'E', slug: '', category: '', description: '', start_at: '2999-01-01 10:00:00', end_at: '', location: '', registration_enabled: false, capacity: undefined, published: true }, 'a@x');
    await setEventImage(ctx.db, eid, 'events/e.jpg');
    expect((await getEventById(ctx.db, eid))?.image_key).toBe('events/e.jpg');
    const mid = await createMinistry(ctx.db, { name: 'M', slug: '', description: 'd', leader: '', meeting_time: '', sort_order: 0, published: true }, 'a@x');
    await setMinistryImage(ctx.db, mid, 'ministries/m.jpg');
    expect((await getMinistryById(ctx.db, mid))?.image_key).toBe('ministries/m.jpg');
  });
});
```

> Note: `getSermonById`/`getEventById` already select their key columns? `getSermonById` selects `thumbnail_key` (yes, in COLS). `getEventById` selects `image_key` (in COLS). `getMinistryById` selects `image_key` (yes). So the assertions can read the keys directly.

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement the three setters** (append to each module)

```ts
// sermons.ts
export async function setSermonImage(db: D1Database, id: number, key: string): Promise<void> {
  await db.prepare("UPDATE sermons SET thumbnail_key=?, updated_at=datetime('now') WHERE id=?").bind(key, id).run();
}
// events.ts
export async function setEventImage(db: D1Database, id: number, key: string): Promise<void> {
  await db.prepare("UPDATE events SET image_key=?, updated_at=datetime('now') WHERE id=?").bind(key, id).run();
}
// ministries.ts
export async function setMinistryImage(db: D1Database, id: number, key: string): Promise<void> {
  await db.prepare("UPDATE ministries SET image_key=?, updated_at=datetime('now') WHERE id=?").bind(key, id).run();
}
```

- [ ] **Step 4: Run → pass.**

- [ ] **Step 5: Commit** `feat: setImage data-access for sermons/events/ministries with tests`.

---

## Task 4: wire uploads into admin routes

**Files:** Modify `src/pages/api/admin/{sermons,events,ministries}.ts`.

- [ ] **Step 1: In each route, after a successful create/update, upload the image if present and set the key**

For `sermons.ts`, change the create/update branch so it captures the id and uploads:
```ts
import { uploadImage } from '../../../lib/media';
import { createSermon, updateSermon, deleteSermon, setSermonPublished, setSermonImage } from '../../../lib/db/sermons';
// ...
} else {
  const data = SermonInputSchema.parse(Object.fromEntries(form));
  const targetId = action === 'update' ? id : await createSermon(env.DB, data, auth.email);
  if (action === 'update') await updateSermon(env.DB, id, data, auth.email);
  const image = form.get('image');
  if (image instanceof File && image.size > 0) {
    const key = await uploadImage(env.MEDIA, image, 'sermons');
    await setSermonImage(env.DB, targetId, key);
  }
}
```
Replicate for events (`'events'` prefix, `setEventImage`) and ministries (`'ministries'` prefix, `setMinistryImage`). The existing `try/catch` already returns 400 on any thrown error (e.g. bad image type), so invalid uploads are handled.

- [ ] **Step 2: Build**

```bash
npm run build
```
Expected: succeeds.

- [ ] **Step 3: Commit** `feat: handle image uploads in admin create/update routes`.

---

## Task 5: admin form file inputs + public image usage

**Files:** Modify the three admin form components and the public components/pages.

- [ ] **Step 1: Add a file input to each admin form** (`SermonForm`, `EventForm`, `MinistryForm`)

The forms must be `enctype="multipart/form-data"` to send files. Update the `<form>` tag and add a field. For `SermonForm.astro`:
```astro
<form method="POST" action="/api/admin/sermons" enctype="multipart/form-data" class="flex flex-col gap-6 max-w-xl">
  ...existing fields...
  <div class="flex flex-col gap-1">
    <label for="f-image" class="text-xs uppercase tracking-wider text-on-surface-variant">Image (optional, max 6 MB)</label>
    <input id="f-image" name="image" type="file" accept="image/*" class="text-sm text-on-surface-variant" />
    {sermon?.thumbnail_key && <p class="text-xs text-on-surface-variant">Current: {sermon.thumbnail_key}</p>}
  </div>
  <Button .../>
</form>
```
Replicate for `EventForm` (label "Event image", show `event?.image_key`) and `MinistryForm` (show `ministry?.image_key`). Keep `enctype="multipart/form-data"` on all three.

- [ ] **Step 2: Public components prefer the uploaded image**

`SermonCard.astro`: accept the sermon's `thumbnail_key`; the list page passes `mediaUrl(s.thumbnail_key) ?? fallbackImage`. Simplest: keep the `image` prop but compute it at the call site. In `src/pages/sermons/index.astro`:
```astro
import { mediaUrl } from '../../lib/media';
// ...
{sermons.map((s, i) => <SermonCard sermon={s} image={mediaUrl(s.thumbnail_key) ?? imgs[i % imgs.length]} />)}
```
> `listPublishedSermons` already returns `thumbnail_key` (it's in COLS). Confirm; if not, add it to the SELECT.

`EventCard` + `src/pages/events/index.astro`: `image={mediaUrl(e.image_key) ?? imgs[i % imgs.length]}` (`listUpcomingEvents` returns `image_key` — in COLS).

`src/pages/ministries.astro`: in the bento, use `const img = mediaUrl(m.image_key) ?? c.img;` for each card's `<img src>`.

`src/pages/events/[slug].astro`: `const heroImg = mediaUrl(event.image_key) ?? '/images/home-4.jpg';`

`src/pages/sermons/[slug].astro`: the player section uses `/images/home-3.jpg`; no change required (poster art optional). Skip unless trivial.

- [ ] **Step 3: Build**

```bash
npm run build
```
Expected: succeeds.

- [ ] **Step 4: Commit** `feat: admin image inputs + public pages use uploaded images with fallback`.

---

## Task 6: end-to-end verify (dev) + gate

- [ ] **Step 1: Run the full unit suite**

```bash
npx vitest run
```
Expected: prior tests + media (4) + set-image (2) all pass.

- [ ] **Step 2: Build**

```bash
npm run build
```

- [ ] **Step 3: Dev end-to-end** (DEV_ADMIN_EMAIL set)

Create or edit an event via `/admin/events/new` with an image file, OR via curl (multipart). Example curl (uses a tiny PNG):
```bash
# 1x1 PNG
printf '\x89PNG\r\n\x1a\n...' > /tmp/x.png   # or use any small jpg/png on disk
curl -s -i -X POST "http://localhost:4321/api/admin/events" -H "Origin: http://localhost:4321" \
  -F "_action=create" -F "title=Image Test" -F "start_at=2999-05-01 10:00:00" -F "published=on" \
  -F "image=@/path/to/small.jpg;type=image/jpeg" | grep -i "location:"
# find the key, then fetch it:
npx wrangler d1 execute kharisbuilders --local --command "SELECT image_key FROM events WHERE title='Image Test';"
curl -s -o /dev/null -w "media -> %{http_code}\n" "http://localhost:4321/media/<the-key>"
```
Expected: POST → 303; `image_key` populated; `GET /media/<key>` → 200 with the image. The public `/events` and `/events/<slug>` then show the uploaded image instead of the demo.

- [ ] **Step 4: Clean tree** (`git status --short`).

---

## Phase A1 Done — Definition of Done
- Staff can attach an image when creating/editing a sermon, event, or ministry; it stores in R2 and the key is saved on the row.
- `GET /media/<key>` serves the stored image with a long immutable cache.
- Public sermon/event/ministry surfaces show the uploaded image, falling back to the demo image when none is set.
- `npx vitest run` and `npm run build` pass; end-to-end upload verified in dev.

**Next:** Phase A2 (SEO + structured data: Organization/Church + Event + sermon VideoObject JSON-LD, OpenGraph/Twitter meta, sitemap.xml, robots.txt) and Phase A3 (live keys: real Turnstile widget + email provider so forms notify staff — needs your dashboard setup).

---

## Open Questions (non-blocking)
- Image resizing/variants (responsive `srcset` via Cloudflare image transformations) — deferred; raw R2 streaming for now (fine on workers.dev). Revisit when on a custom domain.
- Whether to delete the old R2 object on replace (orphan cleanup) — deferred; low cost, can sweep later.
