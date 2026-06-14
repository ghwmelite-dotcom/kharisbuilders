# Hero Image Slider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the homepage's single static hero image with a 3-image crossfade + Ken Burns slider, backed by Ghanaian worship imagery generated via the account's own Cloudflare Workers AI.

**Architecture:** A repeatable Node script generates + curates 3 hero WebP images into `public/images/hero/` using `getPlatformProxy()` → `env.AI` (Flux). A new isolated Astro component (`HeroSlides.astro`) renders an absolutely-positioned image stack that crossfades and Ken-Burns-pans, driven by a tiny vanilla-JS rotator that imports a unit-tested pure helper. `index.astro` swaps its single background `<img>` for the component and points the OG image at slide 1. All existing hero overlays/text/CTAs are untouched.

**Tech Stack:** Astro, Cloudflare Workers AI (`@cf/black-forest-labs/flux-1-schnell`), `wrangler` `getPlatformProxy`, `sharp`, vanilla JS/CSS, vitest.

**Run all Cloudflare commands with** `CLOUDFLARE_ACCOUNT_ID=233d917842862e30ed5207cf7b95bc33` (the Missdiasporagh account this client lives on). Work on branch `deploy/kharisbuilders`.

---

## File Structure

- **Create** `scripts/hero-images.mjs` — generates candidate hero images via Workers AI and post-processes the chosen ones to WebP. One responsibility: image production.
- **Create** `src/lib/slider.ts` — pure slide-index helper (`nextIndex`). Testable, no DOM.
- **Create** `tests/lib/slider.test.ts` — unit tests for the helper.
- **Create** `src/components/HeroSlides.astro` — the slider UI (markup + scoped CSS + rotator script). One responsibility: render + animate the background slide stack.
- **Create (generated)** `public/images/hero/slide-1.webp`, `slide-2.webp`, `slide-3.webp`.
- **Modify** `src/pages/index.astro` — replace the single hero `<img>` with `<HeroSlides>`, define the slide list, set the OG image to slide 1.

---

## Task 1: Slide-index helper (TDD)

**Files:**
- Create: `src/lib/slider.ts`
- Test: `tests/lib/slider.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/slider.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { nextIndex } from '../../src/lib/slider';

describe('nextIndex', () => {
  it('advances by one', () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(1, 3)).toBe(2);
  });
  it('wraps around at the end', () => {
    expect(nextIndex(2, 3)).toBe(0);
  });
  it('returns 0 when there are no slides', () => {
    expect(nextIndex(0, 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- slider`
Expected: FAIL — cannot resolve `../../src/lib/slider` (module does not exist).

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/slider.ts`:

```ts
/** Index of the next slide, wrapping back to 0 after the last. */
export function nextIndex(current: number, total: number): number {
  if (total <= 0) return 0;
  return (current + 1) % total;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- slider`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/slider.ts tests/lib/slider.test.ts
git commit -m "feat(hero): add unit-tested slide-index helper"
```

---

## Task 2: HeroSlides component

**Files:**
- Create: `src/components/HeroSlides.astro`

- [ ] **Step 1: Create the component**

Create `src/components/HeroSlides.astro`:

```astro
---
interface Slide {
  src: string;
  alt?: string;
}
interface Props {
  slides: Slide[];
}
const { slides } = Astro.props;
---
<div class="hero-slides absolute inset-0" data-hero-slides>
  {
    slides.map((s, i) => (
      <img
        src={s.src}
        alt={s.alt ?? ''}
        class:list={['hero-slide absolute inset-0 w-full h-full object-cover', { 'is-active': i === 0 }]}
        data-slide={i}
        loading={i === 0 ? 'eager' : 'lazy'}
        decoding="async"
      />
    ))
  }
  <div class="hero-dots absolute left-1/2 -translate-x-1/2 bottom-28 md:bottom-32 z-20 flex gap-2.5" role="tablist" aria-label="Hero slides">
    {
      slides.map((_, i) => (
        <button
          type="button"
          class:list={['hero-dot', { 'is-active': i === 0 }]}
          data-dot={i}
          aria-label={`Show slide ${i + 1}`}
          aria-current={i === 0 ? 'true' : undefined}
        />
      ))
    }
  </div>
</div>

<style>
  .hero-slide {
    opacity: 0;
    transition: opacity 1200ms ease-in-out;
    will-change: opacity;
  }
  .hero-slide.is-active {
    opacity: 0.9;
    animation: hero-kenburns 12s ease-out forwards;
  }
  @keyframes hero-kenburns {
    from { transform: scale(1.04) translate3d(0, 0, 0); }
    to   { transform: scale(1.14) translate3d(0, -1.5%, 0); }
  }
  .hero-dot {
    width: 9px;
    height: 9px;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.65);
    cursor: pointer;
    transition: background 250ms ease, transform 250ms ease;
  }
  .hero-dot:hover { background: rgba(255, 255, 255, 0.7); }
  .hero-dot.is-active {
    background: var(--kb-accent, #b08a3e);
    border-color: var(--kb-accent, #b08a3e);
    transform: scale(1.25);
  }
  @media (prefers-reduced-motion: reduce) {
    .hero-slide { transition: none; animation: none !important; }
  }
</style>

<script>
  import { nextIndex } from '../lib/slider';

  const root = document.querySelector('[data-hero-slides]');
  if (root) {
    const slides = Array.from(root.querySelectorAll('.hero-slide')) as HTMLElement[];
    const dots = Array.from(root.querySelectorAll('.hero-dot')) as HTMLElement[];
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const INTERVAL = 6000;
    let current = 0;
    let timer: number | undefined;

    const show = (i: number) => {
      slides.forEach((el, n) => el.classList.toggle('is-active', n === i));
      dots.forEach((el, n) => {
        el.classList.toggle('is-active', n === i);
        if (n === i) el.setAttribute('aria-current', 'true');
        else el.removeAttribute('aria-current');
      });
      // Force the Ken Burns animation to restart on the newly-active slide.
      const active = slides[i];
      active.style.animation = 'none';
      void active.offsetWidth;
      active.style.animation = '';
      current = i;
    };

    const advance = () => show(nextIndex(current, slides.length));
    const start = () => {
      if (!reduce && slides.length > 1 && timer === undefined) {
        timer = window.setInterval(advance, INTERVAL);
      }
    };
    const stop = () => {
      if (timer !== undefined) {
        clearInterval(timer);
        timer = undefined;
      }
    };

    dots.forEach((dot, i) =>
      dot.addEventListener('click', () => {
        stop();
        show(i);
        start();
      }),
    );

    const hero = root.closest('section') ?? root;
    hero.addEventListener('mouseenter', stop);
    hero.addEventListener('mouseleave', start);
    hero.addEventListener('focusin', stop);
    hero.addEventListener('focusout', start);

    start();
  }
</script>
```

- [ ] **Step 2: Type/lint check via build (component not yet used — verifies it compiles)**

Run: `npm run build`
Expected: build completes with no TypeScript/Astro errors. (The component is unused so it won't appear in output yet; this just verifies it compiles.)

- [ ] **Step 3: Commit**

```bash
git add src/components/HeroSlides.astro
git commit -m "feat(hero): add HeroSlides crossfade + Ken Burns slider component"
```

---

## Task 3: Generate + curate the 3 hero images

**Files:**
- Create: `scripts/hero-images.mjs`
- Create (generated): `public/images/hero/slide-1.webp`, `slide-2.webp`, `slide-3.webp`

- [ ] **Step 1: Write the generation script**

Create `scripts/hero-images.mjs`:

```js
// Generate Ghanaian worship hero images via Cloudflare Workers AI (Flux) and
// post-process to wide WebP. Uses getPlatformProxy() so the deployed env.AI
// binding is reachable locally — no API key needed.
//
//   CLOUDFLARE_ACCOUNT_ID=233d917842862e30ed5207cf7b95bc33 node scripts/hero-images.mjs
//
// Writes N candidates per slot to public/images/hero/_candidates/, so you can
// pick the best and copy it to slide-<n>.webp (see plan Task 3).
import { getPlatformProxy } from 'wrangler';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'images', 'hero', '_candidates');
mkdirSync(outDir, { recursive: true });

const CANDIDATES = 3; // per slot
const MODEL = '@cf/black-forest-labs/flux-1-schnell';
const PROMPTS = [
  'A wide cinematic photograph of a joyful African (Ghanaian) church congregation with hands raised in worship, bright modern sanctuary, warm golden sunlight streaming through tall windows, vibrant and uplifting, shallow depth of field, no text',
  'A wide cinematic photograph of a Ghanaian church worship team and choir wearing vibrant kente cloth, seen from a flattering side and back angle, warm stage lighting, rich colours, celebratory atmosphere, no text',
  'A wide cinematic photograph of Ghanaian church drummers and instrumentalists with a celebrating congregation, motion and energy, colourful traditional cloth, golden hour light, joyful, no text',
];

const proxy = await getPlatformProxy();
try {
  for (let p = 0; p < PROMPTS.length; p++) {
    for (let c = 0; c < CANDIDATES; c++) {
      const label = `slide-${p + 1}-${String.fromCharCode(97 + c)}`; // slide-1-a, -b, -c
      process.stdout.write(`Generating ${label}... `);
      const res = await proxy.env.AI.run(MODEL, { prompt: PROMPTS[p], steps: 8 });
      const buf = Buffer.from(res.image, 'base64');
      const file = join(outDir, `${label}.webp`);
      await sharp(buf)
        .resize(1920, 1080, { fit: 'cover', position: 'attention' })
        .webp({ quality: 80 })
        .toFile(file);
      console.log('ok');
    }
  }
} finally {
  await proxy.dispose();
}

console.log(`\nDone. Review candidates in public/images/hero/_candidates/, then copy your`);
console.log(`picks to public/images/hero/slide-1.webp, slide-2.webp, slide-3.webp.`);
```

- [ ] **Step 2: Run the generator**

Run: `CLOUDFLARE_ACCOUNT_ID=233d917842862e30ed5207cf7b95bc33 node scripts/hero-images.mjs`
Expected: prints `Generating slide-1-a... ok` … through `slide-3-c... ok`, then the "Done" message. 9 files appear in `public/images/hero/_candidates/`.

If `res.image` is undefined (model output shape differs), log `Object.keys(res)` and adapt: some models return `{ image }` (base64), others a raw stream — for `flux-1-schnell` the field is `image` (base64). If Flux is unavailable on the account, switch `MODEL` to `@cf/stabilityai/stable-diffusion-xl-base-1.0` (returns a binary `ReadableStream`; in that case replace the decode with `const buf = Buffer.from(await new Response(res).arrayBuffer());`).

- [ ] **Step 3: View candidates and curate**

View each candidate with the Read tool (e.g. `public/images/hero/_candidates/slide-1-a.webp`). For each slot 1–3, pick the most beautiful, on-brand, artifact-free image.

- [ ] **Step 4: Finalize the three chosen images**

Copy each chosen candidate to its final name (example picks shown — use your actual choices):

```bash
cp public/images/hero/_candidates/slide-1-b.webp public/images/hero/slide-1.webp
cp public/images/hero/_candidates/slide-2-a.webp public/images/hero/slide-2.webp
cp public/images/hero/_candidates/slide-3-c.webp public/images/hero/slide-3.webp
```

- [ ] **Step 5: Remove the candidates folder (don't ship throwaways)**

```bash
rm -rf public/images/hero/_candidates
```

- [ ] **Step 6: Verify the finals exist and are sane**

Run: `node -e "const s=require('sharp');(async()=>{for(const n of [1,2,3]){const m=await s('public/images/hero/slide-'+n+'.webp').metadata();console.log('slide-'+n, m.width+'x'+m.height, m.format)}})()"`
Expected: three lines, each `1920x1080 webp`.

- [ ] **Step 7: Commit**

```bash
git add scripts/hero-images.mjs public/images/hero/slide-1.webp public/images/hero/slide-2.webp public/images/hero/slide-3.webp
git commit -m "feat(hero): generate + add 3 Ghanaian worship hero images"
```

---

## Task 4: Wire the slider into the homepage

**Files:**
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Import the component**

In `src/pages/index.astro`, add to the frontmatter imports (near the other component imports at the top, e.g. after the `SectionIntro` import on line 4):

```astro
import HeroSlides from '../components/HeroSlides.astro';
```

- [ ] **Step 2: Define the slide list in frontmatter**

In `src/pages/index.astro`, add just below the `const cimg = makeImage(contentMap);` line (~line 39):

```astro
const heroSlides = [
  { src: '/images/hero/slide-1.webp' },
  { src: '/images/hero/slide-2.webp' },
  { src: '/images/hero/slide-3.webp' },
];
```

- [ ] **Step 3: Point the OG image at slide 1**

In `src/pages/index.astro`, change the `PublicLayout` opening tag (line ~59) from:

```astro
<PublicLayout title={`${SITE.name} | ${SITE.tagline}`} image={cimg('home.hero_image')}>
```

to:

```astro
<PublicLayout title={`${SITE.name} | ${SITE.tagline}`} image={heroSlides[0].src}>
```

- [ ] **Step 4: Replace the single hero image with the slider**

In `src/pages/index.astro`, replace this line (~line 62):

```astro
    <img src={cimg('home.hero_image')} alt="" class="kenburns absolute inset-0 w-full h-full object-cover opacity-[0.9]" />
```

with:

```astro
    <HeroSlides slides={heroSlides} />
```

Leave every other element in the `<section>` (the legibility gradient div, `.hero-glows`, the radial scrim div, and the entire `.relative z-10` text column) exactly as-is.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: build succeeds; `dist/` includes the three hero WebPs as assets and the homepage references `/images/hero/slide-1.webp`.

- [ ] **Step 6: Run the full test suite (no regressions)**

Run: `npm test`
Expected: all tests pass (including the new `slider` tests).

- [ ] **Step 7: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat(hero): use HeroSlides slider on the homepage + OG image"
```

---

## Task 5: Deploy + verify live

- [ ] **Step 1: Deploy**

Run: `CLOUDFLARE_ACCOUNT_ID=233d917842862e30ed5207cf7b95bc33 npx wrangler deploy`
Expected: `Deployed kharisbuilders` with the live URL `https://kharisbuilders.missdiasporagh.workers.dev`.

- [ ] **Step 2: Verify assets serve**

Run: `for n in 1 2 3; do curl -s -o /dev/null -w "slide-$n HTTP %{http_code} %{content_type}\n" https://kharisbuilders.missdiasporagh.workers.dev/images/hero/slide-$n.webp; done`
Expected: three lines, each `HTTP 200 image/webp`.

- [ ] **Step 3: Visual verification**

Open `https://kharisbuilders.missdiasporagh.workers.dev/` and confirm:
- Hero shows the first generated image with a slow Ken Burns zoom.
- After ~6s it crossfades to the next slide; dots reflect the active slide.
- Clicking a dot switches slides; autoplay pauses while hovering the hero.
- Hero heading, gold kicker, countdown, CTAs, and the overlapping intro cards are unchanged and legible.
- The dots sit clear of the CTAs (if they overlap, nudge `bottom-28 md:bottom-32` in `HeroSlides.astro` and redeploy).

- [ ] **Step 4: Reduced-motion check**

In browser devtools, emulate `prefers-reduced-motion: reduce` and reload.
Expected: no Ken Burns, no autoplay; slide 1 is shown statically; dots still switch slides on click.

---

## Self-Review (completed by plan author)

- **Spec coverage:** generation pipeline → Task 3; `HeroSlides.astro` → Task 2; homepage integration + OG image → Task 4; accessibility/reduced-motion → Task 2 (CSS/JS) + Task 5 Step 4; verification → Task 4/5. All spec sections mapped.
- **Placeholder scan:** no TBD/TODO; all code shown in full; example `cp` picks are explicitly flagged as examples.
- **Type consistency:** `nextIndex(current, total)` defined in Task 1 and imported/called identically in Task 2; `Slide`/`slides` prop shape matches between `HeroSlides.astro` (Task 2) and `heroSlides` in `index.astro` (Task 4).
