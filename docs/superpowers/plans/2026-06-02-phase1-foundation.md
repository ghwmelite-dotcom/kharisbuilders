# Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a deployable Astro + Cloudflare project with the theme-switchable design system (both palettes), shared UI components, D1/R2 bindings, and base layouts — the foundation every later phase builds on.

**Architecture:** A single Astro project in SSR mode using the Cloudflare adapter. Design tokens from both `DESIGN.md` files become CSS custom properties scoped by `[data-theme]`; Tailwind maps utilities to those variables so one component set serves both themes. React is added for later admin islands. D1 and R2 bindings are declared in `wrangler.toml` and reachable through a thin typed data-access layer. Pure logic (theme resolution, env access) is unit-tested with Vitest.

**Tech Stack:** Astro 5, `@astrojs/cloudflare`, `@astrojs/react`, Tailwind CSS v4 (`@tailwindcss/vite`), Vitest, Wrangler, Cloudflare D1 + R2.

**Working directory:** `C:\dev\Projects\KharisBuilders Project\stitch_kharisbuilders_church_web_design` (already a git repo; the design spec lives in `docs/superpowers/specs/`).

> **Reference while building:** the original Stitch mockups in `home_kharisbuilders/code.html`, `about_us_kharisbuilders/code.html`, etc., and the token files `sacred_structure_1/DESIGN.md` (midnight/gold) and `sacred_structure_2/DESIGN.md` (purple). Pull exact hex values and type scales from those.

---

## File Structure (created in this phase)

```
package.json                      # deps + scripts
astro.config.mjs                  # Astro + cloudflare adapter + react + tailwind vite plugin
wrangler.toml                     # D1 + R2 bindings, pages config
tsconfig.json                     # strict TS
vitest.config.ts                  # unit test runner
src/styles/tokens.css             # CSS custom properties for both themes
src/styles/global.css             # @import tailwind + tokens, base styles, fonts
src/lib/theme.ts                  # theme constants + resolveTheme() helper
src/lib/env.ts                    # typed accessor for Cloudflare runtime bindings
src/lib/cn.ts                     # className join helper
src/layouts/PublicLayout.astro    # public shell (sets data-theme, Nav + Footer slots)
src/components/Button.astro        # primary/secondary/tertiary
src/components/Card.astro          # base card
src/components/Nav.astro           # top nav (vellum-glass on scroll)
src/components/Footer.astro        # site footer
src/components/Icon.astro          # inline SVG icon by name
src/pages/index.astro             # temporary smoke page proving the stack renders
tests/theme.test.ts               # unit tests for resolveTheme()
tests/env.test.ts                 # unit tests for env accessor
```

---

## Task 1: Scaffold the Astro project

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `src/pages/index.astro`

- [ ] **Step 1: Scaffold a minimal Astro app into the current directory**

Run (the repo already has files, so scaffold into a temp dir and move, or use the empty-template flag):
```bash
npm create astro@latest -- --template minimal --no-install --no-git --yes .
```
Expected: creates `package.json`, `astro.config.mjs`, `tsconfig.json`, `src/pages/index.astro`. If it refuses because the directory is non-empty, scaffold into `./_scaffold` then move the generated files up and delete `_scaffold`.

- [ ] **Step 2: Add the Cloudflare, React, and Tailwind integrations**

Run:
```bash
npx astro add cloudflare react --yes
npm install -D @tailwindcss/vite tailwindcss
```
Expected: `@astrojs/cloudflare` and `@astrojs/react` added to `astro.config.mjs` and installed; Tailwind v4 Vite plugin installed.

- [ ] **Step 3: Configure `astro.config.mjs` for SSR on Cloudflare + Tailwind**

```js
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({ platformProxy: { enabled: true } }),
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
});
```

- [ ] **Step 4: Set strict TypeScript**

In `tsconfig.json`, ensure it extends Astro strict and forbids implicit any:
```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "strictNullChecks": true,
    "noImplicitAny": true
  }
}
```

- [ ] **Step 5: Verify the dev server boots**

Run:
```bash
npm run dev
```
Expected: Astro dev server starts and serves the default page at `http://localhost:4321` with no errors. Stop it (Ctrl+C) after confirming.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Astro + Cloudflare + React + Tailwind v4"
```

---

## Task 2: Wrangler config with D1 + R2 bindings

**Files:**
- Create: `wrangler.toml`, `.dev.vars.example`

- [ ] **Step 1: Create `wrangler.toml` with bindings**

```toml
name = "kharisbuilders"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = "dist"

[[d1_databases]]
binding = "DB"
database_name = "kharisbuilders"
database_id = "PLACEHOLDER_RUN_WRANGLER_D1_CREATE"

[[r2_buckets]]
binding = "MEDIA"
bucket_name = "kharisbuilders-media"
```

- [ ] **Step 2: Create the D1 database and capture its id**

Run:
```bash
npx wrangler d1 create kharisbuilders
```
Expected: prints a `database_id`. Paste that value into `wrangler.toml` replacing `PLACEHOLDER_RUN_WRANGLER_D1_CREATE`. (If not yet logged in, run `npx wrangler login` first — this opens a browser; if running headless, the user runs `! npx wrangler login`.)

- [ ] **Step 3: Create the R2 bucket**

Run:
```bash
npx wrangler r2 bucket create kharisbuilders-media
```
Expected: confirms bucket created.

- [ ] **Step 4: Document local secrets**

Create `.dev.vars.example`:
```
PAYSTACK_SECRET_KEY=
PAYSTACK_PUBLIC_KEY=
PAYSTACK_WEBHOOK_SECRET=
TURNSTILE_SECRET_KEY=
```
(`.dev.vars` itself is gitignored; this example documents required keys for later phases.)

- [ ] **Step 5: Commit**

```bash
git add wrangler.toml .dev.vars.example
git commit -m "chore: add wrangler config with D1 and R2 bindings"
```

---

## Task 3: Vitest setup + theme resolution helper (TDD)

**Files:**
- Create: `vitest.config.ts`, `src/lib/theme.ts`, `tests/theme.test.ts`

- [ ] **Step 1: Install and configure Vitest**

Run:
```bash
npm install -D vitest
```
Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
```
Add to `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 2: Write the failing test for `resolveTheme`**

Create `tests/theme.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { resolveTheme, THEMES, DEFAULT_THEME } from '../src/lib/theme';

describe('resolveTheme', () => {
  it('returns a valid theme unchanged', () => {
    expect(resolveTheme('purple')).toBe('purple');
    expect(resolveTheme('sacred')).toBe('sacred');
  });

  it('falls back to the default for unknown values', () => {
    expect(resolveTheme('nonsense')).toBe(DEFAULT_THEME);
    expect(resolveTheme(undefined)).toBe(DEFAULT_THEME);
    expect(resolveTheme(null)).toBe(DEFAULT_THEME);
  });

  it('exposes exactly the two supported themes', () => {
    expect(THEMES).toEqual(['sacred', 'purple']);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run:
```bash
npx vitest run tests/theme.test.ts
```
Expected: FAIL — cannot find module `../src/lib/theme`.

- [ ] **Step 4: Implement `src/lib/theme.ts`**

```ts
export const THEMES = ['sacred', 'purple'] as const;
export type Theme = (typeof THEMES)[number];
export const DEFAULT_THEME: Theme = 'sacred';

export function resolveTheme(value: unknown): Theme {
  return THEMES.includes(value as Theme) ? (value as Theme) : DEFAULT_THEME;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run:
```bash
npx vitest run tests/theme.test.ts
```
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts src/lib/theme.ts tests/theme.test.ts package.json
git commit -m "feat: add theme resolution helper with tests"
```

---

## Task 4: Typed env accessor for Cloudflare bindings (TDD)

**Files:**
- Create: `src/lib/env.ts`, `tests/env.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/env.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { getBindings } from '../src/lib/env';

describe('getBindings', () => {
  it('returns the runtime env from Astro locals', () => {
    const fakeEnv = { DB: {}, MEDIA: {} };
    const locals = { runtime: { env: fakeEnv } } as unknown as App.Locals;
    expect(getBindings(locals)).toBe(fakeEnv);
  });

  it('throws a clear error when runtime is missing', () => {
    const locals = {} as unknown as App.Locals;
    expect(() => getBindings(locals)).toThrow(/Cloudflare runtime/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
npx vitest run tests/env.test.ts
```
Expected: FAIL — cannot find module `../src/lib/env`.

- [ ] **Step 3: Declare binding types and implement the accessor**

Create `src/env.d.ts` (Astro runtime locals typing):
```ts
/// <reference types="astro/client" />

interface CloudflareBindings {
  DB: D1Database;
  MEDIA: R2Bucket;
}

declare namespace App {
  interface Locals {
    runtime: { env: CloudflareBindings };
  }
}
```
Create `src/lib/env.ts`:
```ts
export function getBindings(locals: App.Locals): CloudflareBindings {
  if (!locals?.runtime?.env) {
    throw new Error('Cloudflare runtime bindings are not available on locals.');
  }
  return locals.runtime.env;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
npx vitest run tests/env.test.ts
```
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/env.ts src/env.d.ts tests/env.test.ts
git commit -m "feat: add typed Cloudflare bindings accessor with tests"
```

---

## Task 5: Design tokens for both themes

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/global.css`

> Pull exact values from `sacred_structure_1/DESIGN.md` (sacred) and `sacred_structure_2/DESIGN.md` (purple). The subset below is the minimum the components in this phase consume; copy the full palette from the DESIGN.md files.

- [ ] **Step 1: Create `src/styles/tokens.css` with per-theme custom properties**

```css
/* Theme tokens — values sourced from the two DESIGN.md files.
   Runtime theme vars use a --kb-* prefix so they never collide with
   Tailwind's own --color-* theme namespace (mapped in global.css). */
:root {
  --container-max: 1280px;
  --space-unit: 8px;
  /* Fonts are theme-independent; referenced raw via font-[var(--font-display)]. */
  --font-display: 'Playfair Display', serif;
  --font-body: 'Manrope', sans-serif;
}

[data-theme='sacred'] {
  --kb-surface: #fbf9f4;
  --kb-on-surface: #1b1c19;
  --kb-on-surface-variant: #44474d;
  --kb-primary: #04162c;
  --kb-on-primary: #ffffff;
  --kb-primary-container: #1a2b42;
  --kb-accent: #8c734b;        /* heritage gold */
  --kb-accent-deep: #4a0e0e;   /* sacred burgundy */
  --kb-muted: #4d4d4d;         /* stone gray */
  --kb-champagne: #e5dcc5;
  --kb-shadow-ambient: 0 12px 32px -4px rgba(26, 43, 66, 0.08);
}

[data-theme='purple'] {
  --kb-surface: #fff7fe;
  --kb-on-surface: #1e1a21;
  --kb-on-surface-variant: #4a454d;
  --kb-primary: #4d3b5c;
  --kb-on-primary: #ffffff;
  --kb-primary-container: #6c5581;
  --kb-accent: #9d84b3;        /* muted lavender */
  --kb-accent-deep: #362545;
  --kb-muted: #4a454d;
  --kb-champagne: #f4f0f7;
  --kb-shadow-ambient: 0 12px 32px -4px rgba(77, 59, 92, 0.08);
}
```

- [ ] **Step 2: Create `src/styles/global.css` wiring Tailwind v4 to the tokens**

```css
@import 'tailwindcss';
@import './tokens.css';

/* Map Tailwind's color namespace to the runtime --kb-* vars so utilities
   like `bg-primary` / `text-on-surface` follow [data-theme] live.
   `inline` makes the generated utilities reference the var (not freeze its value). */
@theme inline {
  --color-surface: var(--kb-surface);
  --color-on-surface: var(--kb-on-surface);
  --color-on-surface-variant: var(--kb-on-surface-variant);
  --color-primary: var(--kb-primary);
  --color-on-primary: var(--kb-on-primary);
  --color-primary-container: var(--kb-primary-container);
  --color-accent: var(--kb-accent);
  --color-accent-deep: var(--kb-accent-deep);
  --color-muted: var(--kb-muted);
  --color-champagne: var(--kb-champagne);
}

@font-face {
  font-family: 'Playfair Display';
  font-style: normal;
  font-weight: 600 700;
  font-display: swap;
  src: local('Playfair Display');
}
@font-face {
  font-family: 'Manrope';
  font-style: normal;
  font-weight: 400 700;
  font-display: swap;
  src: local('Manrope');
}

body {
  background-color: var(--color-surface);
  color: var(--color-on-surface);
  font-family: var(--font-body);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

> Note: self-hosted font files (woff2) are added in Phase 2 with the public pages; `local()` is a temporary fallback so the build is valid now.

- [ ] **Step 3: Verify the build compiles the CSS**

Run:
```bash
npm run build
```
Expected: build succeeds (the temporary `index.astro` will import `global.css` in the next task; if build complains about an unused token, that's fine — fix in Task 7). If it fails on the `@theme inline` self-reference syntax for the installed Tailwind version, switch to defining the `@theme` colors directly as `var(--color-*)` references without the inline alias (engineer verifies against installed Tailwind v4 docs).

- [ ] **Step 4: Commit**

```bash
git add src/styles/tokens.css src/styles/global.css
git commit -m "feat: add theme-switchable design tokens for both palettes"
```

---

## Task 6: Shared UI components

**Files:**
- Create: `src/lib/cn.ts`, `src/components/Icon.astro`, `src/components/Button.astro`, `src/components/Card.astro`, `src/components/Nav.astro`, `src/components/Footer.astro`

- [ ] **Step 1: Create the className helper**

`src/lib/cn.ts`:
```ts
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
```

- [ ] **Step 2: Create `Icon.astro` (inline SVG, no icon font)**

```astro
---
interface Props { name: 'menu' | 'play' | 'arrow-right'; class?: string; }
const { name, class: cls = 'w-6 h-6' } = Astro.props;
const paths: Record<Props['name'], string> = {
  menu: 'M3 6h18M3 12h18M3 18h18',
  play: 'M8 5v14l11-7z',
  'arrow-right': 'M5 12h14M13 6l6 6-6 6',
};
---
<svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d={paths[name]} />
</svg>
```

- [ ] **Step 3: Create `Button.astro`**

```astro
---
interface Props { variant?: 'primary' | 'secondary' | 'tertiary'; href?: string; class?: string; type?: 'button' | 'submit'; }
const { variant = 'primary', href, class: cls = '', type = 'button' } = Astro.props;
const base = 'inline-flex items-center justify-center font-[var(--font-body)] uppercase tracking-wider text-sm font-semibold px-8 py-4 min-h-[44px] transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';
const variants = {
  primary: 'bg-primary text-on-primary border-b-2 border-transparent hover:border-accent',
  secondary: 'border border-accent text-accent bg-transparent hover:bg-accent hover:text-on-primary',
  tertiary: 'text-primary underline decoration-accent underline-offset-4',
};
const classes = `${base} ${variants[variant]} ${cls}`;
const Tag = href ? 'a' : 'button';
---
<Tag class={classes} href={href} type={href ? undefined : type}>
  <slot />
</Tag>
```

- [ ] **Step 4: Create `Card.astro`**

```astro
---
interface Props { class?: string; }
const { class: cls = '' } = Astro.props;
---
<div class={`bg-surface border border-champagne rounded-lg overflow-hidden transition-transform duration-300 hover:-translate-y-1 ${cls}`}>
  <slot />
</div>
```

- [ ] **Step 5: Create `Nav.astro` (vellum-glass on scroll)**

```astro
---
const links = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Ministries', href: '/ministries' },
  { label: 'Visit', href: '/visit' },
];
---
<header id="site-header" class="sticky top-0 z-50 border-b border-accent/20 transition-all duration-300">
  <nav class="mx-auto flex h-20 max-w-[var(--container-max)] items-center justify-between px-6 md:px-16">
    <a href="/" class="font-[var(--font-display)] text-2xl text-primary">Kharisbuilders</a>
    <div class="hidden items-center gap-10 md:flex">
      {links.map((l) => (
        <a href={l.href} class="text-sm uppercase tracking-wider text-on-surface-variant hover:text-primary transition-colors">{l.label}</a>
      ))}
      <a href="/visit" class="bg-primary text-on-primary px-6 py-3 text-sm uppercase tracking-wider border-b-2 border-transparent hover:border-accent transition-all">New Here?</a>
    </div>
    <button class="md:hidden text-primary" aria-label="Open menu">
      <span class="sr-only">Open menu</span>
    </button>
  </nav>
</header>
<script>
  const header = document.getElementById('site-header');
  const onScroll = () => header?.classList.toggle('backdrop-blur-xl', window.scrollY > 50);
  document.addEventListener('scroll', onScroll, { passive: true });
</script>
```

- [ ] **Step 6: Create `Footer.astro`**

```astro
---
const year = new Date().getFullYear();
---
<footer class="bg-primary text-on-primary mt-24 py-16">
  <div class="mx-auto max-w-[var(--container-max)] px-6 md:px-16 grid grid-cols-1 gap-10 md:grid-cols-4">
    <div>
      <div class="font-[var(--font-display)] text-xl text-accent mb-4">Kharisbuilders</div>
      <p class="text-on-primary/70 text-sm">Building Lives, Shaping Destinies.</p>
    </div>
    <div>
      <h4 class="uppercase tracking-widest text-sm mb-4">Explore</h4>
      <ul class="space-y-2 text-on-primary/70 text-sm">
        <li><a href="/" class="hover:text-accent">Home</a></li>
        <li><a href="/about" class="hover:text-accent">About</a></li>
        <li><a href="/ministries" class="hover:text-accent">Ministries</a></li>
        <li><a href="/visit" class="hover:text-accent">Visit</a></li>
      </ul>
    </div>
    <div>
      <h4 class="uppercase tracking-widest text-sm mb-4">Quick Links</h4>
      <ul class="space-y-2 text-on-primary/70 text-sm">
        <li><a href="/give" class="hover:text-accent">Give</a></li>
        <li><a href="/sermons" class="hover:text-accent">Sermons</a></li>
      </ul>
    </div>
    <div>
      <h4 class="uppercase tracking-widest text-sm mb-4">Service Times</h4>
      <p class="text-on-primary/70 text-sm">Sunday: 8:00 AM &amp; 11:00 AM</p>
      <p class="text-on-primary/70 text-sm">Wednesday: 7:00 PM</p>
    </div>
  </div>
  <div class="mx-auto max-w-[var(--container-max)] px-6 md:px-16 mt-12 pt-8 border-t border-white/10 text-center text-on-primary/50 text-sm">
    © {year} Kharisbuilders.
  </div>
</footer>
```

- [ ] **Step 7: Verify the build still compiles**

Run:
```bash
npm run build
```
Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/lib/cn.ts src/components/
git commit -m "feat: add shared UI components (Nav, Footer, Button, Card, Icon)"
```

---

## Task 7: PublicLayout + smoke page proving the stack

**Files:**
- Create: `src/layouts/PublicLayout.astro`
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Create `PublicLayout.astro` that sets the theme and renders Nav/Footer**

```astro
---
import '../styles/global.css';
import Nav from '../components/Nav.astro';
import Footer from '../components/Footer.astro';
import { resolveTheme } from '../lib/theme';

interface Props { title: string; description?: string; }
const { title, description = 'Kharisbuilders — Building Lives, Shaping Destinies.' } = Astro.props;
const theme = resolveTheme(Astro.cookies.get('theme')?.value);
---
<!doctype html>
<html lang="en" data-theme={theme}>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{title}</title>
    <meta name="description" content={description} />
  </head>
  <body>
    <Nav />
    <main><slot /></main>
    <Footer />
  </body>
</html>
```

- [ ] **Step 2: Replace `src/pages/index.astro` with a smoke page**

```astro
---
import PublicLayout from '../layouts/PublicLayout.astro';
import Button from '../components/Button.astro';
---
<PublicLayout title="Kharisbuilders | Building Lives, Shaping Destinies">
  <section class="mx-auto max-w-[var(--container-max)] px-6 md:px-16 py-24 text-center">
    <h1 class="font-[var(--font-display)] text-5xl text-primary mb-8">Building Lives, Shaping Destinies.</h1>
    <div class="flex flex-col md:flex-row gap-4 justify-center">
      <Button variant="primary" href="/visit">Join Us This Sunday</Button>
      <Button variant="secondary" href="/sermons">Watch Online</Button>
    </div>
  </section>
</PublicLayout>
```

- [ ] **Step 3: Build and preview to confirm the stack renders end to end**

Run:
```bash
npm run build
npm run preview
```
Expected: build succeeds; `/` renders the hero with Nav + Footer, themed via `data-theme="sacred"`. Manually change the `theme` cookie to `purple` in the browser devtools and reload — colors switch to the purple palette. Stop preview after confirming.

- [ ] **Step 4: Run the full unit suite**

Run:
```bash
npm test
```
Expected: PASS — all theme + env tests green.

- [ ] **Step 5: Commit**

```bash
git add src/layouts/PublicLayout.astro src/pages/index.astro
git commit -m "feat: add PublicLayout and themed smoke page"
```

---

## Task 8: README + scripts polish

**Files:**
- Create: `README.md`
- Modify: `package.json`

- [ ] **Step 1: Ensure `package.json` scripts are complete**

Scripts block should contain:
```json
{
  "dev": "astro dev",
  "build": "astro build",
  "preview": "astro preview",
  "test": "vitest run",
  "test:watch": "vitest",
  "deploy": "wrangler pages deploy dist"
}
```

- [ ] **Step 2: Write a short `README.md`**

```markdown
# Kharisbuilders Church Website

Full-stack church site (Astro + Cloudflare). See `docs/superpowers/specs/` for the design and `docs/superpowers/plans/` for phased implementation plans.

## Develop
- `npm run dev` — local dev (Cloudflare platform proxy enabled)
- `npm test` — unit tests (Vitest)
- `npm run build && npm run preview` — production build preview

## Stack
Astro 5 (SSR, Cloudflare adapter) · React islands (admin) · Tailwind v4 · D1 · R2 · Cloudflare Access · Paystack.

Themes: `sacred` (midnight/gold) and `purple`, switched via the `theme` cookie / `data-theme`.
```

- [ ] **Step 3: Final build + test gate**

Run:
```bash
npm run build && npm test
```
Expected: both succeed.

- [ ] **Step 4: Commit**

```bash
git add README.md package.json
git commit -m "docs: add README and finalize npm scripts"
```

---

## Phase 1 Done — Definition of Done
- `npm run build` and `npm test` both pass.
- `/` renders with Nav + Footer and switches palettes via the `theme` cookie (both themes verified).
- D1 + R2 bindings declared in `wrangler.toml`; database and bucket created in Cloudflare.
- Theme resolution and env accessor are unit-tested.
- All work committed in small, focused commits.

**Next:** Phase 2 (Public Site) — written against this real codebase once Phase 1 is executed.
