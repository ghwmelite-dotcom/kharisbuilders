# Phase A2: SEO + Structured Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every public page discoverable and richly previewable — canonical URLs, OpenGraph/Twitter meta, JSON-LD structured data (Church/Organization, WebSite, Event, sermon VideoObject, breadcrumbs), a dynamic `sitemap.xml`, and `robots.txt`.

**Architecture:** A pure, unit-tested `src/lib/seo.ts` builds absolute URLs and JSON-LD objects from data + the request origin. `PublicLayout.astro` gains optional `image`/`type`/`noindex`/`jsonLd` props and renders canonical + OG/Twitter + `<script type="application/ld+json">` in `<head>` (always emitting Organization + WebSite sitewide). Page templates pass page-specific OG images and JSON-LD (Event on event detail, VideoObject on sermon detail). `sitemap.xml` and `robots.txt` are Astro endpoints driven by D1 + `Astro.site`.

**Tech Stack:** Astro 6 SSR, Cloudflare D1, Vitest (pure-function tests — no Miniflare needed for seo.ts).

**Working directory:** `C:\dev\Projects\KharisBuilders Project\stitch_kharisbuilders_church_web_design` (git repo, branch off `main`).

> **Conventions:** D1 datetimes are stored UTC as `YYYY-MM-DD HH:MM:SS`. `env` from `src/lib/runtime.ts`. Settings live in `site_settings` (keys: `contact_email`, `phone`, `address`, `service_times`, `socials` = JSON `{facebook,instagram,youtube}`, `default_theme`). Sermon embeds via `toEmbedUrl(provider,url)` in `src/lib/video.ts`. Live origin today: `https://kharisbuilders.missdiasporagh.workers.dev` (one-line change when a custom domain is added).

---

## File Structure (created/modified)

```
astro.config.mjs                       # MODIFY: add `site:` so Astro.site is defined
src/lib/seo.ts                         # NEW: SITE consts + absUrl/toIso + JSON-LD builders
tests/seo.test.ts                      # NEW: pure-function tests
src/layouts/PublicLayout.astro         # MODIFY: canonical + OG/Twitter + JSON-LD head
src/pages/index.astro                  # MODIFY: pass og image + breadcrumb (home uses sitewide org/website)
src/pages/sermons/[slug].astro         # MODIFY: VideoObject JSON-LD + og image
src/pages/events/[slug].astro          # MODIFY: Event JSON-LD + og image
src/pages/sitemap.xml.ts               # NEW: dynamic sitemap endpoint
src/pages/robots.txt.ts                # NEW: robots endpoint
```

---

## Task 1: seo helpers (TDD)

**Files:** Create `src/lib/seo.ts`, `tests/seo.test.ts`.

- [ ] **Step 1: Write the failing test** (`tests/seo.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { absUrl, toIso, organizationJsonLd, websiteJsonLd, eventJsonLd, videoJsonLd, breadcrumbJsonLd, SITE } from '../src/lib/seo';

const origin = 'https://example.org';

describe('absUrl', () => {
  it('joins origin + path and passes through absolute', () => {
    expect(absUrl('/images/x.jpg', origin)).toBe('https://example.org/images/x.jpg');
    expect(absUrl('images/x.jpg', origin)).toBe('https://example.org/images/x.jpg');
    expect(absUrl('https://cdn.com/a.jpg', origin)).toBe('https://cdn.com/a.jpg');
  });
});

describe('toIso', () => {
  it('converts a D1 UTC datetime to ISO 8601 Z', () => {
    expect(toIso('2026-07-01 18:30:00')).toBe('2026-07-01T18:30:00Z');
  });
  it('returns undefined for empty', () => {
    expect(toIso('')).toBeUndefined();
    expect(toIso(null)).toBeUndefined();
  });
});

describe('organizationJsonLd', () => {
  it('builds a Church node with address + socials', () => {
    const node = organizationJsonLd(origin, {
      address: '12 Cathedral Way, London',
      socials: JSON.stringify({ facebook: 'https://fb.com/kb', instagram: '', youtube: 'https://youtube.com/@kb' }),
      contact_email: 'hello@kb.org',
      phone: '+44 20 7946 0000',
    });
    expect(node['@type']).toBe('Church');
    expect(node.name).toBe(SITE.name);
    expect(node.url).toBe(origin + '/');
    expect(node.logo).toBe(origin + SITE.logo);
    expect(node.address.streetAddress).toBe('12 Cathedral Way, London');
    expect(node.sameAs).toEqual(['https://fb.com/kb', 'https://youtube.com/@kb']); // empty dropped
    expect(node.email).toBe('hello@kb.org');
  });
  it('omits empty optionals gracefully', () => {
    const node = organizationJsonLd(origin, {});
    expect(node.sameAs).toBeUndefined();
    expect(node.address).toBeUndefined();
  });
});

describe('websiteJsonLd', () => {
  it('builds a WebSite node', () => {
    const node = websiteJsonLd(origin);
    expect(node['@type']).toBe('WebSite');
    expect(node.url).toBe(origin + '/');
    expect(node.name).toBe(SITE.name);
  });
});

describe('eventJsonLd', () => {
  it('builds an Event node with ISO dates and place', () => {
    const node = eventJsonLd(origin, {
      title: 'First Steps Luncheon',
      slug: 'first-steps',
      description: 'A warm welcome',
      start_at: '2026-07-01 12:30:00',
      end_at: '2026-07-01 14:00:00',
      location: 'The Glass Atrium',
      image_key: 'events/abc.jpg',
    });
    expect(node['@type']).toBe('Event');
    expect(node.name).toBe('First Steps Luncheon');
    expect(node.startDate).toBe('2026-07-01T12:30:00Z');
    expect(node.endDate).toBe('2026-07-01T14:00:00Z');
    expect(node.url).toBe(origin + '/events/first-steps');
    expect(node.image).toBe(origin + '/media/events/abc.jpg');
    expect(node.location.name).toBe('The Glass Atrium');
    expect(node.organizer.name).toBe(SITE.name);
  });
});

describe('videoJsonLd', () => {
  it('builds a VideoObject with embedUrl', () => {
    const node = videoJsonLd(origin, {
      title: 'Faith That Builds',
      slug: 'faith-that-builds',
      description: 'Message',
      video_url: 'https://youtu.be/abc123',
      video_provider: 'youtube',
      thumbnail_key: 'sermons/t.jpg',
      sermon_date: '2026-05-04',
    });
    expect(node['@type']).toBe('VideoObject');
    expect(node.name).toBe('Faith That Builds');
    expect(node.embedUrl).toBe('https://www.youtube.com/embed/abc123');
    expect(node.thumbnailUrl).toBe(origin + '/media/sermons/t.jpg');
    expect(node.uploadDate).toBe('2026-05-04');
  });
});

describe('breadcrumbJsonLd', () => {
  it('builds an ordered list', () => {
    const node = breadcrumbJsonLd(origin, [{ name: 'Home', path: '/' }, { name: 'Sermons', path: '/sermons' }]);
    expect(node['@type']).toBe('BreadcrumbList');
    expect(node.itemListElement).toHaveLength(2);
    expect(node.itemListElement[1]).toMatchObject({ position: 2, name: 'Sermons', item: origin + '/sermons' });
  });
});
```

- [ ] **Step 2: Run → fail** (`npx vitest run tests/seo.test.ts`).

- [ ] **Step 3: Implement `src/lib/seo.ts`**

```ts
import { toEmbedUrl, type VideoProvider } from './video';

export const SITE = {
  name: 'Kharisbuilders',
  /** Live origin today; change when a custom domain is added. Used as fallback when Astro.site is unset. */
  url: 'https://kharisbuilders.missdiasporagh.workers.dev',
  tagline: 'Building Lives, Shaping Destinies.',
  description:
    'Kharisbuilders is a modern, Christ-centred church — sermons, events, ministries, and a place to belong. Building Lives, Shaping Destinies.',
  logo: '/images/kharis-logo.png',
  /** Default social/OG preview image. */
  ogImage: '/images/home-1.jpg',
} as const;

/** Resolve a path (or pass through an absolute URL) against an origin. */
export function absUrl(pathOrUrl: string, origin: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return new URL(pathOrUrl, origin.endsWith('/') ? origin : origin + '/').href;
}

/** D1 UTC datetime "YYYY-MM-DD HH:MM:SS" -> ISO 8601 "…Z". */
export function toIso(dt: string | null | undefined): string | undefined {
  if (!dt) return undefined;
  const trimmed = dt.trim();
  if (!trimmed) return undefined;
  return trimmed.includes('T') ? trimmed : `${trimmed.replace(' ', 'T')}Z`;
}

function parseSocials(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  try {
    const obj = JSON.parse(raw) as Record<string, string>;
    const urls = Object.values(obj).filter((v) => typeof v === 'string' && v.trim().length > 0);
    return urls.length ? urls : undefined;
  } catch {
    return undefined;
  }
}

export interface OrgSettings {
  address?: string;
  socials?: string;
  contact_email?: string;
  phone?: string;
}

export function organizationJsonLd(origin: string, s: OrgSettings): Record<string, unknown> {
  const node: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Church',
    '@id': absUrl('/#church', origin),
    name: SITE.name,
    url: absUrl('/', origin),
    logo: absUrl(SITE.logo, origin),
    description: SITE.description,
  };
  const sameAs = parseSocials(s.socials);
  if (sameAs) node.sameAs = sameAs;
  if (s.address) node.address = { '@type': 'PostalAddress', streetAddress: s.address };
  if (s.contact_email) node.email = s.contact_email;
  if (s.phone) node.telephone = s.phone;
  return node;
}

export function websiteJsonLd(origin: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE.name,
    url: absUrl('/', origin),
    description: SITE.description,
  };
}

export interface EventSeo {
  title: string;
  slug: string;
  description?: string | null;
  start_at: string;
  end_at?: string | null;
  location?: string | null;
  image_key?: string | null;
}

export function eventJsonLd(origin: string, e: EventSeo): Record<string, unknown> {
  const node: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: e.title,
    url: absUrl(`/events/${e.slug}`, origin),
    startDate: toIso(e.start_at),
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    organizer: { '@type': 'Organization', name: SITE.name, url: absUrl('/', origin) },
  };
  const end = toIso(e.end_at);
  if (end) node.endDate = end;
  if (e.description) node.description = e.description;
  if (e.location) node.location = { '@type': 'Place', name: e.location };
  if (e.image_key) node.image = absUrl(`/media/${e.image_key}`, origin);
  return node;
}

export interface SermonSeo {
  title: string;
  slug: string;
  description?: string | null;
  video_url: string;
  video_provider: VideoProvider;
  thumbnail_key?: string | null;
  sermon_date?: string | null;
}

export function videoJsonLd(origin: string, s: SermonSeo): Record<string, unknown> {
  const node: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: s.title,
    url: absUrl(`/sermons/${s.slug}`, origin),
    description: s.description || s.title,
    uploadDate: s.sermon_date || undefined,
    embedUrl: toEmbedUrl(s.video_provider, s.video_url),
    thumbnailUrl: s.thumbnail_key ? absUrl(`/media/${s.thumbnail_key}`, origin) : absUrl(SITE.ogImage, origin),
  };
  return node;
}

export function breadcrumbJsonLd(origin: string, items: Array<{ name: string; path: string }>): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: absUrl(it.path, origin),
    })),
  };
}
```

- [ ] **Step 4: Run → pass.** Adjust only if a builder shape differs from the test.

- [ ] **Step 5: Commit** `feat: SEO helpers — absUrl/toIso + JSON-LD builders with tests`.

---

## Task 2: Astro.site config

**Files:** Modify `astro.config.mjs`.

- [ ] **Step 1: Add `site`**

```js
export default defineConfig({
  site: 'https://kharisbuilders.missdiasporagh.workers.dev',
  output: 'server',
  adapter: cloudflare({ platformProxy: { enabled: true } }),
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
});
```

- [ ] **Step 2: Build** (`npm run build`) → succeeds.

- [ ] **Step 3: Commit** `chore: set Astro.site for canonical + sitemap`.

---

## Task 3: head meta + JSON-LD in PublicLayout

**Files:** Modify `src/layouts/PublicLayout.astro`.

- [ ] **Step 1: Extend Props + compute SEO values in frontmatter**

Add imports and props. After the existing `settings` load:
```astro
import { SITE, absUrl, organizationJsonLd, websiteJsonLd } from '../lib/seo';

interface Props {
  title: string;
  description?: string;
  image?: string;        // path or absolute; defaults to SITE.ogImage
  type?: string;         // og:type, default 'website'
  noindex?: boolean;
  jsonLd?: Array<Record<string, unknown>>;  // page-specific nodes
}
const { title, description = SITE.description, image, type = 'website', noindex = false, jsonLd = [] } = Astro.props;

const origin = (Astro.site ?? new URL(SITE.url)).origin;
const canonical = new URL(Astro.url.pathname, origin).href;
const ogImage = absUrl(image ?? SITE.ogImage, origin);
const seoNodes = [organizationJsonLd(origin, settings), websiteJsonLd(origin), ...jsonLd];
```

- [ ] **Step 2: Render the tags in `<head>`** (after the existing `<meta name="description">`)

```astro
    <link rel="canonical" href={canonical} />
    {noindex && <meta name="robots" content="noindex, nofollow" />}
    <meta property="og:type" content={type} />
    <meta property="og:site_name" content={SITE.name} />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:url" content={canonical} />
    <meta property="og:image" content={ogImage} />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={description} />
    <meta name="twitter:image" content={ogImage} />
    {seoNodes.map((node) => (
      <script type="application/ld+json" set:html={JSON.stringify(node)} />
    ))}
```

> `set:html` with `JSON.stringify` is safe for JSON-LD (no `</script>` sequences in our data). Do not use `set:text`.

- [ ] **Step 3: Build** → succeeds.

- [ ] **Step 4: Commit** `feat: canonical + OpenGraph/Twitter + sitewide JSON-LD in PublicLayout`.

---

## Task 4: page-specific OG + JSON-LD

**Files:** Modify `src/pages/index.astro`, `src/pages/sermons/[slug].astro`, `src/pages/events/[slug].astro`.

- [ ] **Step 1: Event detail** (`src/pages/events/[slug].astro`)

Add to frontmatter (after `heroImg`):
```astro
import { eventJsonLd } from '../../lib/seo';
// ...
const eventNode = eventJsonLd((Astro.site ?? new URL('https://kharisbuilders.missdiasporagh.workers.dev')).origin, event);
```
Update the layout open tag to pass image + jsonLd:
```astro
<PublicLayout
  title={`${event.title} | Events`}
  description={event.description ?? 'Event'}
  type="article"
  image={event.image_key ? `/media/${event.image_key}` : heroImg}
  jsonLd={[eventNode]}
>
```

- [ ] **Step 2: Sermon detail** (`src/pages/sermons/[slug].astro`)

Read the file first to get the exact `<PublicLayout>` invocation and the sermon variable name. Add:
```astro
import { videoJsonLd } from '../../lib/seo';
// after sermon is loaded:
const sermonNode = videoJsonLd((Astro.site ?? new URL('https://kharisbuilders.missdiasporagh.workers.dev')).origin, sermon);
```
Pass to layout:
```astro
<PublicLayout
  title={`${sermon.title} | Sermons`}
  description={sermon.description ?? sermon.title}
  type="video.other"
  image={sermon.thumbnail_key ? `/media/${sermon.thumbnail_key}` : undefined}
  jsonLd={[sermonNode]}
>
```

- [ ] **Step 3: Home** (`src/pages/index.astro`) — give it a strong OG image (org + website already sitewide)

Update the `<PublicLayout ...>` open tag to add `image="/images/home-1.jpg"` (or whichever hero image the home page already uses).

- [ ] **Step 4: Build** → succeeds.

- [ ] **Step 5: Commit** `feat: Event + VideoObject JSON-LD and OG images on detail pages`.

---

## Task 5: sitemap.xml endpoint

**Files:** Create `src/pages/sitemap.xml.ts`.

- [ ] **Step 1: Implement**

```ts
import type { APIRoute } from 'astro';
import { env } from '../lib/runtime';
import { SITE, absUrl, toIso } from '../lib/seo';
import { listPublishedSermons } from '../lib/db/sermons';
import { listUpcomingEvents } from '../lib/db/events';
import { listPublishedMinistries } from '../lib/db/ministries';

export const GET: APIRoute = async ({ site }) => {
  const origin = (site ?? new URL(SITE.url)).origin;
  const urls: Array<{ loc: string; lastmod?: string }> = [
    { loc: absUrl('/', origin) },
    { loc: absUrl('/about', origin) },
    { loc: absUrl('/ministries', origin) },
    { loc: absUrl('/sermons', origin) },
    { loc: absUrl('/events', origin) },
    { loc: absUrl('/visit', origin) },
  ];
  try {
    const [sermons, events] = await Promise.all([listPublishedSermons(env.DB), listUpcomingEvents(env.DB)]);
    for (const s of sermons) urls.push({ loc: absUrl(`/sermons/${s.slug}`, origin), lastmod: toIso(s.sermon_date) });
    for (const e of events) urls.push({ loc: absUrl(`/events/${e.slug}`, origin), lastmod: toIso(e.start_at) });
    // ministries currently have no public detail route; listed only via /ministries
    await listPublishedMinistries(env.DB);
  } catch {
    /* fall back to static routes only */
  }
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemap.org/schemas/sitemap/0.9">\n` +
    urls
      .map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`)
      .join('\n') +
    `\n</urlset>\n`;
  return new Response(body, {
    headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  });
};
```

> Note: namespace URL must be `http://www.sitemaps.org/schemas/sitemap/0.9` (sitemaps, plural). Use exactly that string in the implementation.

- [ ] **Step 2: Build** → succeeds.

- [ ] **Step 3: Commit** `feat: dynamic sitemap.xml from D1 content`.

---

## Task 6: robots.txt endpoint

**Files:** Create `src/pages/robots.txt.ts`.

- [ ] **Step 1: Implement**

```ts
import type { APIRoute } from 'astro';
import { SITE, absUrl } from '../lib/seo';

export const GET: APIRoute = ({ site }) => {
  const origin = (site ?? new URL(SITE.url)).origin;
  const body = ['User-agent: *', 'Allow: /', 'Disallow: /admin', '', `Sitemap: ${absUrl('/sitemap.xml', origin)}`, ''].join('\n');
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
};
```

- [ ] **Step 2: Build** → succeeds.

- [ ] **Step 3: Commit** `feat: robots.txt pointing at sitemap, disallowing /admin`.

---

## Task 7: verify (dev) + gate

- [ ] **Step 1: Full unit suite** (`npx vitest run`) — prior 60 + seo (~9) pass.

- [ ] **Step 2: Build** (`npm run build`).

- [ ] **Step 3: Dev smoke** (start `npm run dev`):
```bash
curl -s http://localhost:4321/robots.txt
curl -s http://localhost:4321/sitemap.xml | head -20
# JSON-LD present on home + an event detail:
curl -s http://localhost:4321/ | grep -c 'application/ld+json'            # >= 2 (org + website)
curl -s http://localhost:4321/ | grep -o '<link rel="canonical"[^>]*>'
curl -s "http://localhost:4321/events" | grep -o '/events/[a-z0-9-]*' | head -1   # grab a slug
curl -s "http://localhost:4321/events/<slug>" | grep -c '"@type":"Event"'  # 1
```
Expected: robots lists Sitemap; sitemap is valid XML with static + content URLs; home has ≥2 JSON-LD scripts + canonical; event detail has an Event node.

- [ ] **Step 4: Clean tree** (`git status --short`).

---

## Phase A2 Done — Definition of Done
- Every public page emits a canonical URL, OpenGraph + Twitter card meta, and sitewide Church + WebSite JSON-LD.
- Event detail emits Event JSON-LD; sermon detail emits VideoObject JSON-LD; both set page-appropriate OG images.
- `/sitemap.xml` lists static routes + published sermons/events with lastmod; `/robots.txt` allows crawl, disallows `/admin`, and references the sitemap.
- `npx vitest run` and `npm run build` pass; dev smoke verified.

**Next:** Phase A3 (live keys — real Turnstile widget + email provider so visit/registration forms notify staff; needs your Cloudflare/Resend dashboard setup), then Phase B (Paystack giving).

---

## Open Questions (non-blocking)
- Custom domain: when added, change `site` in `astro.config.mjs` + `SITE.url` (one line each) — everything else derives from origin at runtime.
- Per-sermon/event OG images already flow from uploaded R2 keys (Phase A1); no extra work.
