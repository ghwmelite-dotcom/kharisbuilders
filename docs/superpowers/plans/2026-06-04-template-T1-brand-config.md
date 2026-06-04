# Template T1: Brand & Config Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every code-level church-specific value (name, tagline, logo, brand colors, currency, timezone, motifs, feature set) into one `src/config/church.ts`, so the platform is re-skinnable by editing one file — with Kharis looking and behaving identically afterward.

**Architecture:** A typed `CHURCH` config drives `SITE`, the theme (token palette derived from 4 brand colors via CSS `color-mix`, injected as `--brand-*`), wordmarks/titles, the `motifs` on/off toggle, and `feature()` flags that gate nav + routes. Compile-time; no new data/secrets. Kharis's values reproduce the current palette (visual parity, verified by screenshots).

**Tech Stack:** Astro 6 SSR, Tailwind v4, Vitest. Spec: `docs/superpowers/specs/2026-06-04-template-T1-brand-config-design.md`.

**Working dir:** `C:\dev\Projects\KharisBuilders Project\stitch_kharisbuilders_church_web_design` (branch `feat/template-T1-config` off `main`).

> **Parity target (current Kharis `[data-theme='purple']` in `src/styles/tokens.css`):** surface `#faf6fe`, surface-dim `#ddd2e6`, container-lowest `#ffffff`, container-low `#f7f0fb`, container `#f2e9f7`, container-high `#ebe0f2`, container-highest `#e4d7ee`, on-surface `#1d1426`, on-surface-variant `#4b4255`, primary `#4a2a6b`, on-primary `#ffffff`, primary-container `#2c1745`, on-primary-container `#cdb6e6`, secondary `#8a6a34`, secondary-container `#ead7fb`, on-secondary-container `#5a4076`, accent `#a87f2e`, accent-deep `#5b2a4a`, muted `#4b4255`, champagne `#efe6d4`. Anchors: primary `#4a2a6b`, accent `#a87f2e`, dark `#2c1745`, surface `#faf6fe`.

---

## File Structure (created/modified)

```
src/config/church.ts            # CHURCH config + feature() + ChurchConfig type
src/config/theme-vars.ts        # brandVars(theme) -> :root CSS custom props
src/styles/tokens.css           # brand theme derives --kb-* from --brand-* (color-mix); remove sacred
src/layouts/PublicLayout.astro  # inject brandVars + lang from config
src/layouts/AdminLayout.astro   # inject brandVars + lang; feature-filter nav
src/lib/seo.ts                  # SITE <- CHURCH
src/lib/theme.ts                # THEMES collapse to the brand theme
src/components/Nav.astro        # feature-filter links; wordmark <- CHURCH.name
src/components/Footer.astro     # wordmark/description <- CHURCH.name
src/components/Adinkra.astro    # no-op when !motifs
src/components/SectionIntro.astro # neutral divider/eyebrow when !motifs
src/pages/{sermons/index,events/index,ministries,giving,live}.astro  # feature redirect guards
src/pages/index.astro           # gate sections by feature
src/pages/giving.astro src/pages/api/.../live*  # currency/tz default from CHURCH
src/pages/admin/settings.astro  # drop the now-vestigial Default-theme field
tests/config/church.test.ts tests/config/theme-vars.test.ts
```

---

## Task 1: the config + theme-vars (TDD)

**Files:** Create `src/config/church.ts`, `src/config/theme-vars.ts`, `tests/config/church.test.ts`, `tests/config/theme-vars.test.ts`.

- [ ] **Step 1: Write the failing tests**

`tests/config/church.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { CHURCH, feature } from '../../src/config/church';

describe('church config', () => {
  it('has identity, theme (4 hex), currency, tz, motifs, and 6 features', () => {
    expect(CHURCH.name.length).toBeGreaterThan(0);
    for (const k of ['primary', 'accent', 'dark', 'surface'] as const) {
      expect(CHURCH.theme[k]).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
    expect(typeof CHURCH.currency).toBe('string');
    expect(typeof CHURCH.timezoneOffsetMin).toBe('number');
    expect(typeof CHURCH.motifs).toBe('boolean');
    expect(Object.keys(CHURCH.features).sort()).toEqual(['ai', 'events', 'giving', 'live', 'ministries', 'sermons']);
  });
  it('feature() reads the flags', () => {
    expect(feature('giving')).toBe(CHURCH.features.giving);
  });
});
```

`tests/config/theme-vars.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { brandVars } from '../../src/config/theme-vars';

describe('brandVars', () => {
  it('emits the four brand custom properties', () => {
    const css = brandVars({ primary: '#4a2a6b', accent: '#a87f2e', dark: '#2c1745', surface: '#faf6fe' });
    expect(css).toContain('--brand-primary: #4a2a6b');
    expect(css).toContain('--brand-accent: #a87f2e');
    expect(css).toContain('--brand-dark: #2c1745');
    expect(css).toContain('--brand-surface: #faf6fe');
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement `src/config/church.ts`** (Kharis values verbatim)
```ts
export interface ChurchTheme {
  primary: string;
  accent: string;
  dark: string;
  surface: string;
}
export interface ChurchFeatures {
  sermons: boolean;
  events: boolean;
  ministries: boolean;
  giving: boolean;
  ai: boolean;
  live: boolean;
}
export interface ChurchConfig {
  name: string;
  tagline: string;
  description: string;
  url: string;
  logo: string;
  ogImage: string;
  locale: string;
  currency: string;
  timezoneOffsetMin: number;
  motifs: boolean;
  theme: ChurchTheme;
  features: ChurchFeatures;
}

/**
 * THE ONE FILE TO CUSTOMISE PER CHURCH.
 * Edit these values + swap the logo/og images to re-skin the whole platform.
 */
export const CHURCH: ChurchConfig = {
  name: 'Kharisbuilders',
  tagline: 'Building Lives, Shaping Destinies.',
  description:
    'Kharisbuilders is a modern, Christ-centred church — sermons, events, ministries, and a place to belong. Building Lives, Shaping Destinies.',
  url: 'https://kharisbuilders.missdiasporagh.workers.dev',
  logo: '/images/kharis-logo.png',
  ogImage: '/images/home-1.jpg',
  locale: 'en',
  currency: 'GHS',
  timezoneOffsetMin: 0, // Accra / UTC
  motifs: true, // Adinkra + kente flourishes
  theme: { primary: '#4a2a6b', accent: '#a87f2e', dark: '#2c1745', surface: '#faf6fe' },
  features: { sermons: true, events: true, ministries: true, giving: true, ai: true, live: true },
};

export function feature(name: keyof ChurchFeatures): boolean {
  return CHURCH.features[name];
}
```

- [ ] **Step 4: Implement `src/config/theme-vars.ts`**
```ts
import type { ChurchTheme } from './church';

/** CSS custom properties that anchor the theme; injected once into :root by the layouts. */
export function brandVars(theme: ChurchTheme): string {
  return [
    `--brand-primary: ${theme.primary}`,
    `--brand-accent: ${theme.accent}`,
    `--brand-dark: ${theme.dark}`,
    `--brand-surface: ${theme.surface}`,
  ].join('; ');
}
```

- [ ] **Step 5: Run → pass. Commit** `feat: church.config + brandVars theme anchors with tests`.

---

## Task 2: derive the token palette from brand colors

**Files:** Modify `src/styles/tokens.css`, `src/layouts/PublicLayout.astro`, `src/layouts/AdminLayout.astro`, `src/lib/theme.ts`.

- [ ] **Step 1: Rewrite the `[data-theme='purple']` block in `tokens.css`** to derive `--kb-*` from `--brand-*` via `color-mix` (formulas tuned to reproduce the Kharis parity target)
```css
[data-theme='purple'] {
  /* Brand theme — derived from the four --brand-* anchors (set per church via church.config).
     color-mix percentages are tuned so Kharis's anchors reproduce its hand-picked palette. */
  --kb-surface: var(--brand-surface);
  --kb-surface-container-lowest: #ffffff;
  --kb-surface-container-low: color-mix(in srgb, var(--brand-primary) 4%, var(--brand-surface));
  --kb-surface-container: color-mix(in srgb, var(--brand-primary) 7%, var(--brand-surface));
  --kb-surface-container-high: color-mix(in srgb, var(--brand-primary) 11%, var(--brand-surface));
  --kb-surface-container-highest: color-mix(in srgb, var(--brand-primary) 16%, var(--brand-surface));
  --kb-surface-dim: color-mix(in srgb, var(--brand-primary) 18%, var(--brand-surface));
  --kb-on-surface: color-mix(in srgb, var(--brand-primary) 42%, #000);
  --kb-on-surface-variant: color-mix(in srgb, var(--brand-primary) 30%, #2a2730);
  --kb-primary: var(--brand-primary);
  --kb-on-primary: #ffffff;
  --kb-primary-container: var(--brand-dark);
  --kb-on-primary-container: color-mix(in srgb, var(--brand-primary) 26%, #ffffff);
  --kb-secondary: color-mix(in srgb, var(--brand-accent) 82%, #000);
  --kb-secondary-container: color-mix(in srgb, var(--brand-primary) 12%, #ffffff);
  --kb-on-secondary-container: color-mix(in srgb, var(--brand-primary) 78%, #ffffff);
  --kb-accent: var(--brand-accent);
  --kb-accent-deep: color-mix(in srgb, var(--brand-primary) 55%, #7a1f3a);
  --kb-muted: color-mix(in srgb, var(--brand-primary) 30%, #2a2730);
  --kb-champagne: color-mix(in srgb, var(--brand-accent) 18%, #ffffff);
  --kb-shadow-ambient: 0 12px 32px -4px color-mix(in srgb, var(--brand-dark) 16%, transparent);
}
```
Also **remove the `[data-theme='sacred']` block** (retired). Keep the `:root` font/space vars block at the top untouched.

- [ ] **Step 2: Inject `--brand-*` in `PublicLayout.astro`** — add to `<head>` (before the stylesheet is fine; `:root` props cascade):
```astro
import { CHURCH } from '../config/church';
import { brandVars } from '../config/theme-vars';
// ... in the markup <head>:
<style is:global set:html={`:root{ ${brandVars(CHURCH.theme)} }`}></style>
```
And set `<html lang={CHURCH.locale} ...>`.

- [ ] **Step 3: Same injection in `AdminLayout.astro`** (`<html lang={CHURCH.locale} data-theme="purple">` + the `:root` brandVars `<style is:global>`), so admin uses the brand theme too.

- [ ] **Step 4: `src/lib/theme.ts`** — collapse themes:
```ts
export const THEMES = ['purple'] as const;
export type Theme = (typeof THEMES)[number];
export const DEFAULT_THEME: Theme = 'purple';
export function resolveTheme(value: unknown): Theme {
  return THEMES.includes(value as Theme) ? (value as Theme) : DEFAULT_THEME;
}
```
(resolveTheme already falls back to DEFAULT_THEME, so any old `sacred` setting resolves to the brand theme — no breakage.)

- [ ] **Step 5: Build, then SCREENSHOT PARITY** — `npm run build`; capture home + about (reduced-motion, 1280) and visually compare to the current look. Tune the `color-mix` percentages in Step 1 if any surface/secondary reads off. Expected: indistinguishable from current Kharis.

- [ ] **Step 6: Commit** `feat: derive token palette from brand colors (color-mix); retire sacred theme`.

---

## Task 3: SITE + wordmarks + titles from config

**Files:** Modify `src/lib/seo.ts`, `src/components/Nav.astro`, `src/components/Footer.astro`, `src/layouts/PublicLayout.astro`.

- [ ] **Step 1: `src/lib/seo.ts`** — replace the hardcoded `SITE` literal body with config reads:
```ts
import { CHURCH } from '../config/church';
export const SITE = {
  name: CHURCH.name,
  url: CHURCH.url,
  tagline: CHURCH.tagline,
  description: CHURCH.description,
  logo: CHURCH.logo,
  ogImage: CHURCH.ogImage,
} as const;
```
(Keep the rest of seo.ts — `absUrl`, `toIso`, the JSON-LD builders — unchanged; they already read `SITE.name`/`SITE.logo`.)

- [ ] **Step 2: `Nav.astro`** — the brand wordmark text "Kharisbuilders" → `{CHURCH.name}`; the logo `src` → `{CHURCH.logo}`. Import `CHURCH`.

- [ ] **Step 3: `Footer.astro`** — the gold-gradient wordmark "Kharisbuilders" → `{CHURCH.name}`; the logo `<img src>` → `{CHURCH.logo}`; the "Building Lives, Shaping Destinies — …" blurb → keep (it's editable elsewhere) or source the tagline from `CHURCH.tagline`. The bottom `© {year} Kharisbuilders` → `{CHURCH.name}`; the "Building Lives · Shaping Destinies" → `{CHURCH.tagline}` (strip trailing period if present).

- [ ] **Step 4: `PublicLayout.astro`** — the default `description` prop already uses `SITE.description` (now config-driven). Confirm the `<title>` and any "Kharisbuilders" literals route through `SITE.name`/props. (Page-level titles like `"Sermons | Kharisbuilders"` are per-page strings — leave for T2/neutral-content, or interpolate `${SITE.name}` where trivial; not required for T1.)

- [ ] **Step 5: Build → succeeds; the site still says "Kharisbuilders" everywhere (from config). Commit** `feat: SITE + nav/footer wordmark from church config`.

---

## Task 4: motif toggle

**Files:** Modify `src/layouts/PublicLayout.astro` (+ AdminLayout), `src/components/Adinkra.astro`, `src/components/SectionIntro.astro`, `src/styles/global.css`.

- [ ] **Step 1: Body class** — in `PublicLayout.astro` `<body>` add `class:list={['grain', { 'motifs-off': !CHURCH.motifs }]}` (import `CHURCH`). Same idea on AdminLayout's body if it carries motifs (it doesn't use kente much — optional).

- [ ] **Step 2: `Adinkra.astro`** — early return nothing when motifs off:
```astro
---
import { CHURCH } from '../config/church';
// ...props...
---
{CHURCH.motifs && (
  /* existing <svg> branches */
)}
```

- [ ] **Step 3: `global.css`** — neutralize kente ornaments when motifs are off (append):
```css
.motifs-off .kente-rule {
  background-image: none;
  background-color: var(--kb-accent);
}
```
(SectionIntro's eyebrow Adinkra already disappears via Task 4 Step 2; the kente-rule under headings becomes a plain gold rule. The Footer's Adinkra medallion + watermark are `<Adinkra>` instances → already hidden. The home hero's Adinkra kicker glyphs → hidden.)

- [ ] **Step 4: `SectionIntro.astro`** — its `<Adinkra>` eyebrow glyph already no-ops; ensure the eyebrow still renders its text + the kente rule (now plain gold via CSS) cleanly. No structural change needed beyond Adinkra's no-op.

- [ ] **Step 5: Dev check (scratch)** — temporarily set `motifs:false`, run dev, confirm the Adinkra glyphs/medallion/watermark vanish and kente rules become plain gold; revert to `true`. Build.

- [ ] **Step 6: Commit** `feat: motif on/off toggle (Adinkra + kente) via config`.

---

## Task 5: feature flags (nav + routes + sections)

**Files:** Modify `src/components/Nav.astro`, `src/layouts/AdminLayout.astro`, the feature pages, `src/pages/index.astro`.

- [ ] **Step 1: Public nav filter** — in `Nav.astro`, after building `links`, filter by feature:
```ts
import { feature } from '../config/church';
const featureOf: Record<string, keyof import('../config/church').ChurchFeatures | undefined> = {
  '/sermons': 'sermons', '/events': 'events', '/ministries': 'ministries', '/giving': 'giving', '/live': 'live',
};
const links = allLinks.filter((l) => { const f = featureOf[l.href]; return !f || feature(f); });
```
(Apply the same filter to the mobile menu links if separate.)

- [ ] **Step 2: Admin nav filter** — in `AdminLayout.astro`, filter the `nav` array: drop `sermons`(feature sermons), `events`, `ministries`, `giving`+`funds`+`subscriptions`(feature giving), `live`(feature live). Keep Dashboard/Content/Settings/People always.

- [ ] **Step 3: Route guards** — at the top of each feature page frontmatter add a redirect when off:
  - `src/pages/sermons/index.astro` + `src/pages/sermons/[slug].astro`: `if (!feature('sermons')) return Astro.redirect('/');`
  - `events/index.astro` + `events/[slug].astro`: `feature('events')`
  - `ministries.astro`: `feature('ministries')`
  - `giving.astro` + `giving/callback.astro`: `feature('giving')`
  - `live.astro`: `feature('live')`
  (Import `feature` in each.)

- [ ] **Step 4: Home sections** — in `index.astro`, wrap the **Latest sermon** section in `{feature('sermons') && (...)}`, **Upcoming gatherings** in `{feature('events') && (...)}`, the **giving banner** in `{feature('giving') && (...)}`. (The intro cards/`This Week`/scripture/pastor stay.) Import `feature`.

- [ ] **Step 5: Build → succeeds (all features on → site unchanged). Commit** `feat: feature flags gate nav, routes, and home sections`.

---

## Task 6: currency + timezone defaults from config

**Files:** Modify `src/pages/giving.astro`, `src/lib/giving/initialize-handler.ts`, `src/pages/live.astro`, `src/pages/api/live/status.ts`.

- [ ] **Step 1: Currency** — replace hardcoded `'GHS'` defaults with `CHURCH.currency`:
  - `giving.astro`: `currency = settings.currency ?? CHURCH.currency;`
  - `initialize-handler.ts`: `const currency = (await getSetting(env.DB, 'currency').catch(() => null)) ?? CHURCH.currency;` (import CHURCH).
- [ ] **Step 2: Timezone** — replace the `?? 0` live tz default with `CHURCH.timezoneOffsetMin`:
  - `live.astro` + `api/live/status.ts`: `Number(settings.live_tz_offset_min ?? CHURCH.timezoneOffsetMin) || CHURCH.timezoneOffsetMin`.
- [ ] **Step 3: Build → succeeds. Commit** `feat: currency + live timezone default from church config`.

---

## Task 7: tidy settings + full gate + parity

**Files:** Modify `src/pages/admin/settings.astro`.

- [ ] **Step 1: Remove the vestigial "Default theme" field** from `admin/settings.astro` (one brand theme now). Leave the other settings fields.

- [ ] **Step 2: Full unit suite** (`npx vitest run`) — prior 178 + new config tests (~4) pass; nothing logic-level changed so all stay green.

- [ ] **Step 3: Build** (`npm run build`).

- [ ] **Step 4: Screenshot parity** — capture home + about + a sermon page (reduced-motion, 1280) and confirm visually identical to the current Kharis look (theme + motifs intact). Tune Task 2 color-mix if needed.

- [ ] **Step 5: Re-skin smoke (scratch)** — temporarily set a different name + `theme.primary`/`accent` + `motifs:false` + `features.ai:false` in `church.ts`; `npm run dev`; confirm the wordmark/title change, the colors change cohesively, the motifs vanish, and the Sermons nav/route disappears (`/sermons` → redirect home). **Revert church.ts to the Kharis values** and rebuild.

- [ ] **Step 6: Clean tree** (`git status --short`).

---

## Done — Definition of Done
- `src/config/church.ts` is the single source for name, tagline, logo, brand colors, currency, timezone, motifs, and feature flags.
- Theme palette derives from the 4 brand colors; Kharis looks identical (screenshot parity).
- `motifs:false` cleanly neutralizes Adinkra/kente; a feature flag off hides its nav link + redirects its route + hides its home section.
- `SITE`, nav/footer wordmark, currency, and live timezone all read from config.
- `npx vitest run` + `npm run build` pass; re-skin smoke verified then reverted to Kharis.

**Next:** T2 (generic starter content + placeholder assets so a fresh deploy is a clean generic church), T3 (the `new-church` provisioning script), T4 (launch docs).

---

## Open Questions (resolved defaults)
- Single brand theme (`purple` data-theme name kept to avoid churn); sacred retired; resolveTheme falls back safely.
- Token derivation via `color-mix` from 4 anchors, tuned to Kharis parity (visual, not hex).
- Page-title literals (`"… | Kharisbuilders"`) left for T2's content pass; not required for T1.
