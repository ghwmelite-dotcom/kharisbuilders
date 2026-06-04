# Template T1: Brand & Config Extraction — Design Spec

**Date:** 2026-06-04
**Status:** Approved (design), pending spec review
**Project:** KharisBuilders church platform → reusable **template** (one church per deploy). T1 extracts the code-level church identity into a single config so the platform is re-skinnable by editing one file.

---

## 1. Purpose & Goals

Make the platform re-skinnable for any church by moving every hardcoded "Kharis-ism" in *code* (name, tagline, logo, brand colors, currency, timezone, cultural motifs, feature set) into a single `church.config.ts`. Operational content stays runtime-editable in the admin (unchanged). Kharis becomes the first config — the live site must look and behave identically after the refactor.

**Success criteria**
- Editing `church.config.ts` changes the site's name, wordmark, SEO identity, theme colors, currency, live timezone, motif on/off, and which features appear — with no other code edits and no redeploy logic changes.
- With the Kharis config in place, the deployed site is visually and behaviourally identical to today (regression-safe).
- Setting `motifs:false` cleanly removes the Adinkra/kente flourishes (neutral dividers instead); toggling a feature off hides its nav + route.
- A church's brand colors generate a cohesive, AA-respecting theme.

**Decisions locked in (brainstorming):** template-repo direction; motifs = on/off toggle; single config file is the source of truth for code-level identity; content stays in the DB/CMS.

---

## 2. Scope

**In scope (T1):** the `church.config.ts` + a typed accessor; theme-from-brand (token palette derived from config colors); wiring `SITE`/wordmarks/titles/OG to config; `currency`/`timezoneOffsetMin` defaults from config; the **motif toggle** across Adinkra/kente usages; **feature flags** gating nav links + routes. Regression coverage that Kharis renders unchanged.

**Out of scope:** generic starter content + placeholder assets (**T2**); the provisioning/setup script (**T3**); docs (**T4**); multi-tenant/runtime brand editing (deliberately compile-time per the template-fork decision). The two existing palettes collapse to one config-driven brand theme (sacred is retired as a separate theme; Kharis's purple becomes its config) — light/dark variants are not part of T1.

---

## 3. Architecture

```
src/config/church.ts            ← THE one file to customize (CHURCH literal)
  ├─ identity: name, tagline, description, logo, ogImage, locale
  ├─ brand:    theme { primary, accent, dark, surface }  → derived token palette
  ├─ ops:      currency, timezoneOffsetMin
  ├─ flags:    motifs (bool), features { sermons, events, ministries, giving, ai, live }
  └─ helpers:  feature(name), brandVars() (CSS custom props string)

consumed by:
  seo.ts SITE  → reads CHURCH (name/url/tagline/description/logo/ogImage)
  PublicLayout / AdminLayout → inject brandVars() into a :root <style>; html lang = locale
  tokens.css   → [data-theme] vars reference --brand-* (set by brandVars), deriving
                 surfaces/containers/on-colors via color-mix from primary/accent/dark/surface
  Nav/Footer/titles → name from CHURCH
  Adinkra.astro / SectionIntro / kente usages → render neutral when !CHURCH.motifs
  giving (currency), live (tz offset) → default from CHURCH when no DB setting
  feature(name) → nav arrays filter; disabled routes redirect home
```

Compile-time config (a plain TS module) — set once per church at scaffold, deploy. No runtime cost; types catch mistakes.

---

## 4. Components & Boundaries

**`src/config/church.ts`** — the config literal + typed shape + helpers:
```ts
export interface ChurchTheme { primary: string; accent: string; dark: string; surface: string }
export interface ChurchFeatures { sermons: boolean; events: boolean; ministries: boolean; giving: boolean; ai: boolean; live: boolean }
export interface ChurchConfig {
  name: string; tagline: string; description: string;
  url: string; logo: string; ogImage: string; locale: string;
  currency: string; timezoneOffsetMin: number;
  motifs: boolean; theme: ChurchTheme; features: ChurchFeatures;
}
export const CHURCH: ChurchConfig = { /* Kharis values (verbatim current) */ };
export function feature(name: keyof ChurchFeatures): boolean { return CHURCH.features[name]; }
```
Kharis values: name 'Kharisbuilders', tagline 'Building Lives, Shaping Destinies.', url the workers.dev, logo '/images/kharis-logo.png', ogImage '/images/home-1.jpg', locale 'en', currency 'GHS', timezoneOffsetMin 0, motifs true, theme { primary '#4a2a6b', accent '#a87f2e', dark '#2c1745', surface '#faf6fe' }, all features true.

**Theme derivation (`src/config/theme-vars.ts` + `tokens.css`)**:
- `brandVars(theme): string` returns a CSS block of `--brand-primary/--brand-accent/--brand-dark/--brand-surface` set from config.
- `tokens.css` keeps the `--kb-*` names (so all utilities keep working) but the **purple `[data-theme]` block is rewritten to derive from `--brand-*`** using `color-mix`:
  - `--kb-primary: var(--brand-primary)`, `--kb-accent: var(--brand-accent)`, `--kb-primary-container: var(--brand-dark)`, `--kb-surface: var(--brand-surface)`.
  - surfaces/containers via mixes: e.g. `--kb-surface-container: color-mix(in srgb, var(--brand-primary) 5%, var(--brand-surface))`, `--kb-on-primary-container: color-mix(in srgb, var(--brand-accent) 30%, white)`, `--kb-champagne: color-mix(in srgb, var(--brand-accent) 18%, white)`, `--kb-muted`/`--kb-on-surface` as dark neutrals, `--kb-secondary` a deeper accent (`color-mix accent + black`), `--kb-accent-deep` a plum/danger derived from primary+accent. Tuned so the Kharis colors reproduce the current palette within tolerance.
- The `<html data-theme>` stays (default from settings/`purple`), but only one brand theme exists; `brandVars()` is injected in the layout `<style is:global>` so the `--brand-*` are present.

> Acceptance for the derivation: with Kharis's 4 colors, the rendered home/about look unchanged (verified by screenshot diff during build). Exact hex parity isn't required — visual parity is.

**`SITE` (`src/lib/seo.ts`)** → `name/url/tagline/description/logo/ogImage` read from `CHURCH`. `SITE.ogImage` already used; keep the shape, source values from config.

**Layouts** — `PublicLayout`/`AdminLayout`: `<html lang={CHURCH.locale}>`; inject `<style is:global>:root{ ${brandVars(CHURCH.theme)} }</style>` once (PublicLayout; AdminLayout reuses). Footer/nav brand wordmark and `<title>` suffixes read `CHURCH.name`.

**Motif toggle** — `src/components/Adinkra.astro` returns nothing when `!CHURCH.motifs`; `SectionIntro` renders its eyebrow without the Adinkra glyph and uses a plain gold hairline instead of `.kente-rule` when motifs off; the standalone `.kente-rule` usages (Footer medallion, dividers) swap to `.hairline-gold` via a small `motifClass` helper or a body class `motifs-off` that CSS keys on (`.motifs-off .kente-rule { background: var(--kb-accent) }`, hide watermark/medallion). Simplest: add `class:list={{ 'motifs-off': !CHURCH.motifs }}` on `<body>` and let CSS neutralize kente/adinkra ornaments; Adinkra component still no-ops for the inline glyphs.

**Feature flags** — `feature(name)`:
- `Nav.astro` + `AdminLayout` nav arrays filter out links whose feature is off (Sermons→`ai`?no, `sermons`; Watch→`live`; Give→`giving`; Events→`events`; Ministries→`ministries`).
- Disabled public routes (`/sermons`, `/events`, `/ministries`, `/giving`, `/live`) early-`return Astro.redirect('/')` when their feature is off. Admin routes likewise hide/redirect.
- The home page sections (latest sermon, gatherings, giving banner, This Week) render only when their feature is on.

**Currency / timezone** — giving reads `settings.currency ?? CHURCH.currency`; live reads `settings.live_tz_offset_min ?? CHURCH.timezoneOffsetMin`. (DB still overrides; config supplies the default instead of a hardcoded 'GHS'/0.)

---

## 5. Error Handling / Safety

- Config is a typed literal — a malformed value is a compile error, not a runtime crash.
- `brandVars` only emits CSS custom properties (no user input) → no injection.
- A disabled feature's route redirects home (never a broken half-page); its nav link is absent.
- Motif-off path is purely presentational (dividers/ornaments) — no logic change.
- If `color-mix` is unsupported on an ancient browser, the `--kb-*` still resolve to the base brand colors for the critical ones (primary/accent/surface set directly), so text stays legible (graceful degradation).

## 6. Security
- No new secrets, routes, or data. Compile-time config only.
- Feature-gating is defense-in-depth on routes (redirect) in addition to hidden nav.

## 7. Testing Strategy

**Pure unit tests:**
- `church.ts`/`feature()`: returns the configured booleans; `feature('ai')` etc.
- `theme-vars.ts`: `brandVars(theme)` emits the four `--brand-*` custom properties with the given hex values; deterministic string.
- A "config integrity" test: required fields present, theme has 4 hex colors, features has the 6 flags.

**Build/regression:**
- `npm run build` passes with the Kharis config.
- Screenshot parity (reduced-motion) of home + about with Kharis config vs. the current deploy — visually unchanged (manual check during the gate).
- A scratch check: flipping `motifs:false` + a feature off in a throwaway run hides the ornaments + nav link/route (manual dev verification; revert before commit).

> Note: most of T1 is wiring `.astro`/CSS, which the unit suite can't fully cover. The regression guard is **build + screenshot parity + the existing 178 tests staying green** (nothing logic-level should change).

## 8. Rollout
1. Build + tests green; screenshot parity confirms Kharis is unchanged.
2. No migration. Deploy (Kharis config) — identical site.
3. The platform is now re-skinnable: a new church edits `church.config.ts` (name, colors, currency, tz, motifs, features) + swaps the logo, and redeploys.

## 9. Open Questions (resolved defaults)
- Single config-driven brand theme; the old `sacred`/`purple` dual-theme collapses (Kharis = its config). Light/dark variants deferred.
- Theme derivation via CSS `color-mix` from 4 brand colors; visual (not hex) parity with current Kharis is the bar.
- Compile-time config (per template-fork decision); runtime brand editing intentionally out.
- Content defaults remain Kharis-specific in T1 (admins override in CMS); neutral starter content is **T2**.
