# Hero image slider + generated Ghanaian worship imagery — Design

**Date:** 2026-06-14
**Client/site:** Kharis Builders (`kharisbuilders`)
**Status:** Approved (design), pending implementation plan

## Goal

Replace the homepage's single static hero image with a **3-image slider** that
crossfades with a Ken Burns motion, backed by **stunning, on-brand Ghanaian
worship imagery generated via the account's own Cloudflare Workers AI**. Keep the
existing cinematic hero text, countdown, CTAs, and overlays exactly as they are —
only the background image becomes a rotating stack.

## Decisions (locked with user)

| Decision | Choice |
| :-- | :-- |
| Image style | Atmospheric worship — wide congregation/hands raised, kente choir from flattering angles, drummers, golden light, church exterior. Minimal tight close-up faces (cleanest AI quality). |
| Number of slides | 3 |
| Transition | Crossfade + Ken Burns (slow zoom/pan), honoring `prefers-reduced-motion` |
| Storage | Bundled in `public/images/hero/` (committed). No admin UI yet; can wire R2/admin-editing later. |
| Slider implementation | Pure CSS + tiny vanilla JS stack (no carousel dependency) |

## Component 1 — Image generation pipeline

**File:** `scripts/hero-images.mjs` (repeatable, committed)

- **What it does:** generates the three hero background images and writes optimized
  WebP files to `public/images/hero/`.
- **How:** `getPlatformProxy()` from `wrangler` exposes the deployed `env.AI`
  binding to a local Node script — no API key, no third-party service, uses the
  logged-in Cloudflare account's AI access. Model: `@cf/black-forest-labs/flux-1-schnell`
  (fast, strong aesthetic). Falls back to `@cf/stabilityai/stable-diffusion-xl-base-1.0`
  if Flux is unavailable.
- **Prompts (3):** all warm/golden-light, vibrant, Ghanaian, worshipful, wide framing,
  avoiding tight close-up faces:
  1. Wide shot of a joyful African congregation with hands raised in a bright modern
     church, sunlight through tall windows.
  2. Worship team / choir in vibrant kente cloth, flattering side/back angle, warm stage light.
  3. Drummers and instruments with a celebrating congregation, colour and motion, golden hour.
- **Curation:** generate a few candidates per slot, view them, keep the best one per slot.
  (Curation is what separates "stunning" from "random output.")
- **Post-processing (`sharp`):** crop/cover to a wide hero ratio (~16:9), size to ~1920px
  on the long edge, export compressed WebP. Output: `public/images/hero/slide-1.webp`,
  `slide-2.webp`, `slide-3.webp`. Sharpness demands are forgiving because the hero layers
  heavy gradient + scrim + glow overlays over the image.
- **Dependencies:** `wrangler` (already present), `sharp` (already present, 0.34.5).

## Component 2 — Slider component

**File:** `src/components/HeroSlides.astro` (new, extracted for isolation)

- **Props:** `slides: { src: string; alt?: string }[]` (decorative → `alt` defaults to `""`).
- **Markup:** a stack of N absolutely-positioned `<img>` elements filling the hero box
  (`absolute inset-0 w-full h-full object-cover`), each a "slide". One slide is `is-active`
  at a time. A small dot-indicator row sits at the hero's bottom.
- **Motion:**
  - Crossfade via `opacity` transition (~1.2s) between the active and next slide.
  - Each slide runs a slow Ken Burns zoom/pan CSS animation while active (reusing/extending
    the existing `kenburns` aesthetic).
  - Autoplay ~6s per slide; **pause on hover/focus** of the hero.
- **Controls:** dot indicators only (no arrows — 3 slides). Each dot is a `<button>` with
  `aria-label="Show slide N"` and reflects the active slide (`aria-current`).
- **Accessibility:**
  - Images decorative (`alt=""`); the `<h1>` carries the meaning.
  - `prefers-reduced-motion: reduce` → no Ken Burns, no autoplay; slide 1 shown statically,
    dots still allow manual switching.
  - Dots are keyboard-focusable and operable.
- **Script:** tiny inline vanilla JS (interval rotator + dot click handlers + hover/focus
  pause + reduced-motion guard). No external library.

## Component 3 — Homepage integration

**File:** `src/pages/index.astro`

- Replace the single `<img src={cimg('home.hero_image')} class="kenburns …" />` (currently
  line ~62) with `<HeroSlides slides={heroSlides} />`.
- Define `heroSlides` in the page frontmatter as the three bundled paths:
  `/images/hero/slide-1.webp` … `slide-3.webp`.
- **Everything else in the hero stays:** the legibility gradient, `.hero-glows`, the radial
  scrim, the centered text column (logo swirl, kicker, `h1`, countdown, CTAs), and the
  overlapping intro cards below.
- SEO/OG: set the layout's `image` prop (currently `cimg('home.hero_image')`) to the first
  slide so `og:image`/`twitter:image` use a real generated hero.

## Out of scope (YAGNI)

- No `/admin` UI to manage slides (bundled for now; future enhancement noted).
- No arrows, no thumbnails, no per-slide captions.
- No change to the editable `home.hero_image` content key plumbing beyond the OG image.

## Testing / verification

- `npm run build` succeeds; `public/images/hero/slide-{1,2,3}.webp` exist and are reasonable
  sizes.
- Visually verify on the deployed URL: slides crossfade + Ken Burns, dots switch slides,
  autoplay pauses on hover.
- Verify `prefers-reduced-motion` disables motion/autoplay (emulate in devtools).
- Confirm hero text/countdown/CTAs and intro cards render unchanged.

## Affected files

- `scripts/hero-images.mjs` (new)
- `public/images/hero/slide-1.webp`, `slide-2.webp`, `slide-3.webp` (new, generated)
- `src/components/HeroSlides.astro` (new)
- `src/pages/index.astro` (edit hero background + OG image)
