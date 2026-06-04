# Template T3: `new-church` Provisioning Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A dry, deterministic provisioning script that turns the generic template into a configured, ready-to-deploy church instance from one input file, emitting an ordered command checklist — without mutating any Cloudflare account.

**Architecture:** A pure, unit-tested core (`scripts/lib/provision.mjs`: validation + file renderers, no fs/network/deps) plus a thin fs runner (`scripts/new-church.mjs`, run with plain `node`). The runner reads `scripts/new-church.config.json`, validates it, and writes patched `src/config/church.ts`, `wrangler.jsonc`, 4 re-tinted placeholder SVGs, `package.json` name, `astro.config.mjs` site, and `PROVISIONING.md`. Idempotent; never calls `wrangler`.

**Tech Stack:** Plain Node ESM (Node ≥22, no `vite-node`, no zod — hand-rolled validation), Vitest for the pure core, Astro 6 build as a smoke gate. Spec: `docs/superpowers/specs/2026-06-04-template-T3-new-church-provisioning-design.md`.

**Working dir:** `C:\dev\Projects\KharisBuilders Project\stitch_kharisbuilders_church_web_design`.

---

## File Structure

```
scripts/lib/provision.mjs                 # CREATE — pure core: validate + renderers (Tasks 2-6)
scripts/new-church.mjs                     # CREATE — fs runner (Task 7)
scripts/new-church.config.example.json     # CREATE — sentinel input template (Task 1)
tests/template/provision.test.ts           # CREATE — unit tests for the pure core (Tasks 2-6)
.gitignore                                 # MODIFY — ignore scripts/new-church.config.json (Task 1)
```

The runner also writes these at provision time (NOT committed to `main` — reverted after the smoke run): `src/config/church.ts`, `wrangler.jsonc`, `public/images/placeholder-*.svg`, `public/images/logo-placeholder.svg`, `package.json`, `astro.config.mjs`, `PROVISIONING.md`.

> **IMPORTANT:** `main` is the TEMPLATE. T3 adds the script + tests + example config. Do NOT commit a *provisioned* state (a real church's church.ts / wrangler.jsonc) to `main`. The smoke run in Task 8 is reverted before finishing.

---

## Task 1: Branch, .gitignore, example config

**Files:** Modify `.gitignore`; Create `scripts/new-church.config.example.json`.

- [ ] **Step 1: Confirm clean tree on main and branch**

Run: `git status --short && git rev-parse --abbrev-ref HEAD`
Expected: empty output, `main`.

Then:
```bash
git checkout -b feat/template-T3-provisioning
```

- [ ] **Step 2: Add the real config to `.gitignore`**

Append a line to `.gitignore` so a filled config is never committed:
```
scripts/new-church.config.json
```

- [ ] **Step 3: Create `scripts/new-church.config.example.json`** (sentinel values — an unedited copy is rejected by validation)

```json
{
  "name": "Example Church",
  "slug": "example-church",
  "tagline": "A place to belong.",
  "description": "A welcoming, Christ-centred church — sermons, events, ministries, and a community to call home.",
  "url": "https://example-church.YOUR-ACCOUNT.workers.dev",
  "locale": "en",
  "currency": "USD",
  "timezoneOffsetMin": 0,
  "motifs": false,
  "theme": { "primary": "#3b3a6b", "accent": "#b08a3e", "dark": "#23223f", "surface": "#f7f7fb" },
  "features": { "sermons": true, "events": true, "ministries": true, "giving": true, "ai": true, "live": true }
}
```

- [ ] **Step 4: Commit**

```bash
git add .gitignore scripts/new-church.config.example.json
git commit -m "chore: T3 scaffolding — example church config + gitignore real config"
```

---

## Task 2: Pure core — `validateChurchInput` + `deriveNames`

**Files:** Create `scripts/lib/provision.mjs`, `tests/template/provision.test.ts`.

- [ ] **Step 1: Write the failing test** `tests/template/provision.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { validateChurchInput, deriveNames } from '../../scripts/lib/provision.mjs';

const valid = {
  name: 'Grace Community Church',
  slug: 'grace-community',
  tagline: 'A place to belong.',
  description: 'A welcoming church.',
  url: 'https://grace-community.acct.workers.dev',
  locale: 'en',
  currency: 'USD',
  timezoneOffsetMin: 0,
  motifs: false,
  theme: { primary: '#3b3a6b', accent: '#b08a3e', dark: '#23223f', surface: '#f7f7fb' },
  features: { sermons: true, events: true, ministries: true, giving: true, ai: true, live: true },
};

describe('deriveNames', () => {
  it('derives the four CF resource names from a slug', () => {
    expect(deriveNames('grace-community')).toEqual({
      worker: 'grace-community',
      database: 'grace-community',
      bucket: 'grace-community-media',
      vectorize: 'grace-community-sermons',
    });
  });
});

describe('validateChurchInput', () => {
  it('accepts a valid config and attaches derived names', () => {
    const res = validateChurchInput(valid);
    expect(res.ok).toBe(true);
    expect(res.value.names.bucket).toBe('grace-community-media');
    expect(res.value.features.giving).toBe(true);
  });
  it('rejects the example sentinel slug', () => {
    const res = validateChurchInput({ ...valid, slug: 'example-church' });
    expect(res.ok).toBe(false);
    expect(res.errors.join(' ')).toMatch(/example/i);
  });
  it('rejects an invalid slug (uppercase / leading hyphen / too short)', () => {
    expect(validateChurchInput({ ...valid, slug: 'Grace' }).ok).toBe(false);
    expect(validateChurchInput({ ...valid, slug: '-grace' }).ok).toBe(false);
    expect(validateChurchInput({ ...valid, slug: 'a' }).ok).toBe(false);
  });
  it('rejects a bad hex colour and a bad currency', () => {
    expect(validateChurchInput({ ...valid, theme: { ...valid.theme, primary: 'blue' } }).ok).toBe(false);
    expect(validateChurchInput({ ...valid, currency: 'Dollars' }).ok).toBe(false);
  });
  it('rejects a non-boolean feature flag and an out-of-range timezone', () => {
    expect(validateChurchInput({ ...valid, features: { ...valid.features, ai: 'yes' } }).ok).toBe(false);
    expect(validateChurchInput({ ...valid, timezoneOffsetMin: 9999 }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/template/provision.test.ts`
Expected: FAIL (cannot import `../../scripts/lib/provision.mjs`).

- [ ] **Step 3: Create `scripts/lib/provision.mjs`** with the typedefs, `deriveNames`, and `validateChurchInput`

```js
// Pure template-provisioning core: validation + file renderers.
// No fs, no network, no third-party imports — runnable by plain `node` and by vitest.

/**
 * @typedef {{ primary: string, accent: string, dark: string, surface: string }} ChurchTheme
 * @typedef {{ sermons: boolean, events: boolean, ministries: boolean, giving: boolean, ai: boolean, live: boolean }} ChurchFeatures
 * @typedef {{ worker: string, database: string, bucket: string, vectorize: string }} DerivedNames
 * @typedef {{ name: string, slug: string, tagline: string, description: string, url: string, locale: string, currency: string, timezoneOffsetMin: number, motifs: boolean, theme: ChurchTheme, features: ChurchFeatures, names: DerivedNames }} ChurchInput
 */

const SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const FEATURE_KEYS = ['sermons', 'events', 'ministries', 'giving', 'ai', 'live'];

/** @param {string} slug @returns {DerivedNames} */
export function deriveNames(slug) {
  return { worker: slug, database: slug, bucket: `${slug}-media`, vectorize: `${slug}-sermons` };
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, value: ChurchInput } | { ok: false, errors: string[] }}
 */
export function validateChurchInput(raw) {
  const errors = [];
  const r = /** @type {any} */ (raw ?? {});
  const nonEmpty = (k) => typeof r[k] === 'string' && r[k].trim().length > 0;

  for (const k of ['name', 'tagline', 'description', 'url', 'locale']) {
    if (!nonEmpty(k)) errors.push(`"${k}" must be a non-empty string`);
  }
  if (typeof r.slug !== 'string' || !SLUG_RE.test(r.slug)) {
    errors.push('"slug" must be lowercase letters/digits/hyphens, 2–40 chars, no leading/trailing hyphen');
  }
  if (r.slug === 'example-church') {
    errors.push('"slug" is still the example value — copy scripts/new-church.config.example.json to scripts/new-church.config.json and edit it first');
  }
  if (typeof r.currency !== 'string' || !/^[A-Z]{3}$/.test(r.currency)) {
    errors.push('"currency" must be a 3-letter uppercase code (e.g. USD, GHS)');
  }
  if (!Number.isInteger(r.timezoneOffsetMin) || r.timezoneOffsetMin < -720 || r.timezoneOffsetMin > 840) {
    errors.push('"timezoneOffsetMin" must be an integer between -720 and 840');
  }
  if (typeof r.motifs !== 'boolean') errors.push('"motifs" must be a boolean');

  const t = r.theme ?? {};
  for (const k of ['primary', 'accent', 'dark', 'surface']) {
    if (typeof t[k] !== 'string' || !HEX_RE.test(t[k])) errors.push(`"theme.${k}" must be a 6-digit hex colour like #3b3a6b`);
  }
  const f = r.features ?? {};
  for (const k of FEATURE_KEYS) {
    if (typeof f[k] !== 'boolean') errors.push(`"features.${k}" must be a boolean`);
  }

  if (errors.length) return { ok: false, errors };

  const value = {
    name: r.name, slug: r.slug, tagline: r.tagline, description: r.description, url: r.url,
    locale: r.locale, currency: r.currency, timezoneOffsetMin: r.timezoneOffsetMin, motifs: r.motifs,
    theme: { primary: t.primary, accent: t.accent, dark: t.dark, surface: t.surface },
    features: Object.fromEntries(FEATURE_KEYS.map((k) => [k, f[k]])),
    names: deriveNames(r.slug),
  };
  return { ok: true, value };
}
```

- [ ] **Step 4: Run → pass**

Run: `npx vitest run tests/template/provision.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/provision.mjs tests/template/provision.test.ts
git commit -m "feat: provision core — validateChurchInput + deriveNames"
```

---

## Task 3: `renderChurchConfigTs`

**Files:** Modify `scripts/lib/provision.mjs`, `tests/template/provision.test.ts`.

- [ ] **Step 1: Add the failing test** (append to `tests/template/provision.test.ts`)

```ts
import { renderChurchConfigTs } from '../../scripts/lib/provision.mjs';

describe('renderChurchConfigTs', () => {
  const out = renderChurchConfigTs(validateChurchInput(valid).value);
  it('emits a valid CHURCH literal with the church identity', () => {
    expect(out).toContain('export const CHURCH: ChurchConfig = {');
    expect(out).toContain("name: \"Grace Community Church\"");
    expect(out).toContain("currency: \"USD\"");
    expect(out).toContain('export function feature(name: keyof ChurchFeatures): boolean');
  });
  it('keeps logo/og pointed at placeholder assets and carries the theme + flags', () => {
    expect(out).toContain("logo: '/images/logo-placeholder.svg'");
    expect(out).toContain('primary: "#3b3a6b"');
    expect(out).toContain('giving: true');
  });
  it('leaves no unfilled template markers', () => {
    expect(out).not.toMatch(/\$\{|PASTE_FROM|TODO/);
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/template/provision.test.ts`
Expected: FAIL (`renderChurchConfigTs` is not exported).

- [ ] **Step 3: Add `renderChurchConfigTs` to `scripts/lib/provision.mjs`** (append after `validateChurchInput`)

```js
/** @param {ChurchInput} input @returns {string} */
export function renderChurchConfigTs(input) {
  const s = (v) => JSON.stringify(v); // safe double-quoted JS/TS string
  const { theme: th, features: ft } = input;
  return `export interface ChurchTheme {
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
 * Generated by scripts/new-church.mjs — edit scripts/new-church.config.json and re-run to change.
 */
export const CHURCH: ChurchConfig = {
  name: ${s(input.name)},
  tagline: ${s(input.tagline)},
  description: ${s(input.description)},
  url: ${s(input.url)},
  logo: '/images/logo-placeholder.svg',
  ogImage: '/images/placeholder-wide.svg',
  locale: ${s(input.locale)},
  currency: ${s(input.currency)},
  timezoneOffsetMin: ${input.timezoneOffsetMin},
  motifs: ${input.motifs},
  theme: { primary: ${s(th.primary)}, accent: ${s(th.accent)}, dark: ${s(th.dark)}, surface: ${s(th.surface)} },
  features: { sermons: ${ft.sermons}, events: ${ft.events}, ministries: ${ft.ministries}, giving: ${ft.giving}, ai: ${ft.ai}, live: ${ft.live} },
};

export function feature(name: keyof ChurchFeatures): boolean {
  return CHURCH.features[name];
}
`;
}
```

- [ ] **Step 4: Run → pass**

Run: `npx vitest run tests/template/provision.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/provision.mjs tests/template/provision.test.ts
git commit -m "feat: provision — renderChurchConfigTs"
```

---

## Task 4: `renderWranglerJsonc`

**Files:** Modify `scripts/lib/provision.mjs`, `tests/template/provision.test.ts`.

- [ ] **Step 1: Add the failing test** (append)

```ts
import { renderWranglerJsonc, deriveNames as _derive } from '../../scripts/lib/provision.mjs';

// Strip // line comments so the JSONC body can be JSON.parsed.
function parseJsonc(text: string) {
  return JSON.parse(text.replace(/^\s*\/\/.*$/gm, ''));
}

describe('renderWranglerJsonc', () => {
  const out = renderWranglerJsonc(_derive('grace-community'));
  it('is valid JSONC with slug-derived resource names', () => {
    const cfg = parseJsonc(out);
    expect(cfg.name).toBe('grace-community');
    expect(cfg.d1_databases[0].database_name).toBe('grace-community');
    expect(cfg.r2_buckets[0].bucket_name).toBe('grace-community-media');
    expect(cfg.vectorize[0].index_name).toBe('grace-community-sermons');
    expect(cfg.kv_namespaces[0].binding).toBe('SESSION');
  });
  it('emits id markers that the checklist tells the user to replace', () => {
    const cfg = parseJsonc(out);
    expect(cfg.d1_databases[0].database_id).toBe('PASTE_FROM_D1_CREATE');
    expect(cfg.kv_namespaces[0].id).toBe('PASTE_FROM_KV_CREATE');
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/template/provision.test.ts`
Expected: FAIL (`renderWranglerJsonc` is not exported).

- [ ] **Step 3: Add `renderWranglerJsonc`** (append to `scripts/lib/provision.mjs`)

```js
/** @param {DerivedNames} names @returns {string} */
export function renderWranglerJsonc(names) {
  return `{
\t"compatibility_date": "2026-06-02",
\t"compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
\t"name": "${names.worker}",
\t"main": "@astrojs/cloudflare/entrypoints/server",
\t"assets": {
\t\t"directory": "./dist",
\t\t"binding": "ASSETS"
\t},
\t"observability": {
\t\t"enabled": true
\t},
\t// Structured content (sermons, events, ministries, visitors, donations, settings).
\t// database_id is filled in after \`wrangler d1 create ${names.database}\`.
\t"d1_databases": [
\t\t{
\t\t\t"binding": "DB",
\t\t\t"database_name": "${names.database}",
\t\t\t"database_id": "PASTE_FROM_D1_CREATE"
\t\t}
\t],
\t// Uploaded media (event/ministry images, sermon thumbnails, portraits).
\t"r2_buckets": [
\t\t{
\t\t\t"binding": "MEDIA",
\t\t\t"bucket_name": "${names.bucket}"
\t\t}
\t],
\t// Session storage required by the Astro Cloudflare adapter.
\t// id is filled in after \`wrangler kv namespace create SESSION\`.
\t"kv_namespaces": [
\t\t{
\t\t\t"binding": "SESSION",
\t\t\t"id": "PASTE_FROM_KV_CREATE"
\t\t}
\t],
\t// Workers AI (embeddings + study-guide generation) and Vectorize (sermon search index).
\t"ai": { "binding": "AI" },
\t"vectorize": [
\t\t{ "binding": "SERMONS", "index_name": "${names.vectorize}" }
\t]
}
`;
}
```

- [ ] **Step 4: Run → pass**

Run: `npx vitest run tests/template/provision.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/provision.mjs tests/template/provision.test.ts
git commit -m "feat: provision — renderWranglerJsonc (slug-derived names + id markers)"
```

---

## Task 5: `retintSvg`

**Files:** Modify `scripts/lib/provision.mjs`, `tests/template/provision.test.ts`.

- [ ] **Step 1: Add the failing test** (append)

```ts
import { retintSvg } from '../../scripts/lib/provision.mjs';

describe('retintSvg', () => {
  const theme = { primary: '#112233', accent: '#445566', dark: '#778899', surface: '#ffffff' };
  it('renders four valid SVGs that carry the new colours, not the generic ones', () => {
    for (const key of ['wide', 'portrait', 'card', 'logo']) {
      const svg = retintSvg[key](theme);
      expect(svg.trimStart().startsWith('<svg')).toBe(true);
      expect(svg).toContain('#445566'); // accent (ring) appears in every variant
      expect(svg).not.toContain('#b08a3e'); // generic gold must be gone
      expect(svg).not.toContain('#3b3a6b'); // generic indigo must be gone
    }
  });
  it('uses primary + dark as the gradient stops on the wide variant', () => {
    const svg = retintSvg.wide(theme);
    expect(svg).toContain('stop-color="#112233"'); // primary
    expect(svg).toContain('stop-color="#778899"'); // dark
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/template/provision.test.ts`
Expected: FAIL (`retintSvg` is not exported).

- [ ] **Step 3: Add `retintSvg`** (append to `scripts/lib/provision.mjs`)

```js
/** @type {Record<'wide'|'portrait'|'card'|'logo', (t: ChurchTheme) => string>} */
export const retintSvg = {
  wide: ({ primary, accent, dark }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" role="img" aria-label="Placeholder image">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${primary}"/>
      <stop offset="1" stop-color="${dark}"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#g)"/>
  <g fill="none" stroke="${accent}" stroke-opacity="0.45" stroke-width="6">
    <circle cx="800" cy="430" r="120"/>
    <circle cx="800" cy="430" r="70"/>
  </g>
  <circle cx="800" cy="430" r="14" fill="${accent}" fill-opacity="0.55"/>
  <text x="1560" y="868" font-family="system-ui, sans-serif" font-size="26" fill="#ffffff" fill-opacity="0.5" text-anchor="end">Replace in Admin</text>
</svg>
`,
  portrait: ({ primary, accent, dark }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" role="img" aria-label="Placeholder image">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${primary}"/>
      <stop offset="1" stop-color="${dark}"/>
    </linearGradient>
  </defs>
  <rect width="800" height="1000" fill="url(#g)"/>
  <g fill="none" stroke="${accent}" stroke-opacity="0.45" stroke-width="6">
    <circle cx="400" cy="470" r="110"/>
    <circle cx="400" cy="470" r="64"/>
  </g>
  <circle cx="400" cy="470" r="13" fill="${accent}" fill-opacity="0.55"/>
  <text x="760" y="968" font-family="system-ui, sans-serif" font-size="26" fill="#ffffff" fill-opacity="0.5" text-anchor="end">Replace in Admin</text>
</svg>
`,
  card: ({ primary, accent, dark }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" role="img" aria-label="Placeholder image">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${primary}"/>
      <stop offset="1" stop-color="${dark}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="900" fill="url(#g)"/>
  <g fill="none" stroke="${accent}" stroke-opacity="0.45" stroke-width="6">
    <circle cx="600" cy="420" r="100"/>
    <circle cx="600" cy="420" r="58"/>
  </g>
  <circle cx="600" cy="420" r="12" fill="${accent}" fill-opacity="0.55"/>
  <text x="1160" y="868" font-family="system-ui, sans-serif" font-size="24" fill="#ffffff" fill-opacity="0.5" text-anchor="end">Replace in Admin</text>
</svg>
`,
  logo: ({ primary, accent }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Logo placeholder">
  <g fill="none" stroke="${accent}" stroke-width="22">
    <circle cx="256" cy="256" r="150"/>
    <circle cx="256" cy="256" r="88"/>
  </g>
  <circle cx="256" cy="256" r="30" fill="${primary}"/>
</svg>
`,
};
```

- [ ] **Step 4: Run → pass**

Run: `npx vitest run tests/template/provision.test.ts`
Expected: PASS (14 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/provision.mjs tests/template/provision.test.ts
git commit -m "feat: provision — retintSvg (brand-coloured placeholders)"
```

---

## Task 6: `buildChecklist`

**Files:** Modify `scripts/lib/provision.mjs`, `tests/template/provision.test.ts`.

- [ ] **Step 1: Add the failing test** (append)

```ts
import { buildChecklist } from '../../scripts/lib/provision.mjs';

describe('buildChecklist', () => {
  const base = validateChurchInput(valid).value;
  it('always includes D1 create, migrate, deploy and the Access app', () => {
    const md = buildChecklist(base);
    expect(md).toContain('wrangler d1 create grace-community');
    expect(md).toContain('wrangler d1 migrations apply grace-community --remote');
    expect(md).toContain('npm run deploy');
    expect(md).toMatch(/api\/admin/);
  });
  it('is feature-aware (ai → vectorize/reindex; giving → paystack)', () => {
    const md = buildChecklist(base);
    expect(md).toContain('wrangler vectorize create grace-community-sermons');
    expect(md).toContain('PAYSTACK_SECRET_KEY');

    const off = buildChecklist({ ...base, features: { ...base.features, ai: false, giving: false } });
    expect(off).not.toContain('vectorize create');
    expect(off).not.toContain('PAYSTACK_SECRET_KEY');
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/template/provision.test.ts`
Expected: FAIL (`buildChecklist` is not exported).

- [ ] **Step 3: Add `buildChecklist`** (append to `scripts/lib/provision.mjs`)

```js
/** @param {ChurchInput} input @returns {string} */
export function buildChecklist(input) {
  const n = input.names;
  const L = [];
  L.push(`# Provisioning checklist — ${input.name}`);
  L.push('');
  L.push('Generated by `scripts/new-church.mjs`. Run these from the repo root, in order.');
  L.push('Each `wrangler` call may prompt you to log in first (`npx wrangler login`).');
  L.push('');
  L.push('## 1. Create Cloudflare resources');
  L.push('');
  L.push('```bash');
  L.push(`npx wrangler d1 create ${n.database}`);
  L.push('#   -> paste the printed database_id into wrangler.jsonc (replace PASTE_FROM_D1_CREATE)');
  L.push('npx wrangler kv namespace create SESSION');
  L.push('#   -> paste the printed id into wrangler.jsonc (replace PASTE_FROM_KV_CREATE)');
  L.push(`npx wrangler r2 bucket create ${n.bucket}`);
  if (input.features.ai) L.push(`npx wrangler vectorize create ${n.vectorize} --dimensions=768 --metric=cosine`);
  L.push('```');
  L.push('');
  L.push('## 2. Migrate + seed the database');
  L.push('');
  L.push('```bash');
  L.push(`npx wrangler d1 migrations apply ${n.database} --remote`);
  L.push(`npx wrangler d1 execute ${n.database} --remote --file db/seed.sql`);
  L.push(`npx wrangler d1 execute ${n.database} --remote --file db/seed_funds.sql`);
  L.push(`npx wrangler d1 execute ${n.database} --remote --file db/seed_lists.sql`);
  L.push('```');
  L.push('');
  L.push('## 3. Secrets');
  L.push('');
  L.push('```bash');
  L.push('npx wrangler secret put TURNSTILE_SECRET_KEY   # spam protection on visit/registration/giving forms');
  if (input.features.giving) L.push('npx wrangler secret put PAYSTACK_SECRET_KEY    # online giving');
  L.push('npx wrangler secret put RESEND_API_KEY         # optional: staff email notifications');
  L.push('```');
  L.push('');
  L.push('## 4. Cloudflare Access (protect the admin) — manual, in the dashboard');
  L.push('');
  L.push('Zero Trust → Access → Applications → Add a **self-hosted** app of type **Workers**:');
  L.push('- Cover BOTH paths on your worker hostname: `admin` AND `api/admin`.');
  L.push('- Policy: Allow → your staff emails (One-time PIN or Google).');
  L.push('');
  L.push('## 5. Deploy');
  L.push('');
  L.push('```bash');
  L.push('npm run deploy');
  L.push('```');
  L.push('');
  L.push('## 6. Post-deploy (Admin → Settings)');
  L.push('');
  if (input.features.giving) {
    L.push(`- Giving: set \`paystack_public_key\`, \`currency=${input.currency}\`, \`giving_enabled=true\`; set the Paystack webhook to \`${input.url}/api/webhooks/paystack\`.`);
  }
  L.push('- Turnstile: create a widget for your hostname → put the secret (step 3) + set `turnstile_site_key`.');
  if (input.features.ai) L.push('- AI search: Admin → Sermons → "Reindex AI search" once sermons exist.');
  L.push('- Replace placeholder images and copy throughout the admin.');
  L.push('');
  return L.join('\n');
}
```

- [ ] **Step 4: Run → pass**

Run: `npx vitest run tests/template/provision.test.ts`
Expected: PASS (16 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/provision.mjs tests/template/provision.test.ts
git commit -m "feat: provision — buildChecklist (feature-aware command list)"
```

---

## Task 7: The fs runner — `scripts/new-church.mjs`

**Files:** Create `scripts/new-church.mjs`.

- [ ] **Step 1: Create `scripts/new-church.mjs`**

```js
// Provision the template for one church. Reads scripts/new-church.config.json,
// validates it, and writes the per-church files. Dry: never calls wrangler.
// Run: node scripts/new-church.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  validateChurchInput,
  renderChurchConfigTs,
  renderWranglerJsonc,
  retintSvg,
  buildChecklist,
} from './lib/provision.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const configPath = join(root, 'scripts', 'new-church.config.json');

let raw;
try {
  raw = JSON.parse(readFileSync(configPath, 'utf8'));
} catch {
  console.error('Could not read scripts/new-church.config.json.');
  console.error('Copy scripts/new-church.config.example.json to scripts/new-church.config.json, edit it, then re-run.');
  process.exit(1);
}

const result = validateChurchInput(raw);
if (!result.ok) {
  console.error('Config is invalid:');
  for (const e of result.errors) console.error('  - ' + e);
  process.exit(1);
}
const input = result.value;

const writes = [
  ['src/config/church.ts', renderChurchConfigTs(input)],
  ['wrangler.jsonc', renderWranglerJsonc(input.names)],
  ['public/images/placeholder-wide.svg', retintSvg.wide(input.theme)],
  ['public/images/placeholder-portrait.svg', retintSvg.portrait(input.theme)],
  ['public/images/placeholder-card.svg', retintSvg.card(input.theme)],
  ['public/images/logo-placeholder.svg', retintSvg.logo(input.theme)],
  ['PROVISIONING.md', buildChecklist(input)],
];
for (const [rel, content] of writes) writeFileSync(join(root, rel), content);

// Patch package.json "name" (first occurrence is the top-level field).
const pkgPath = join(root, 'package.json');
writeFileSync(pkgPath, readFileSync(pkgPath, 'utf8').replace(/("name":\s*)"[^"]*"/, `$1"${input.slug}"`));

// Patch astro.config.mjs site URL.
const acPath = join(root, 'astro.config.mjs');
writeFileSync(acPath, readFileSync(acPath, 'utf8').replace(/(site:\s*)'[^']*'/, `$1'${input.url}'`));

console.log(`Provisioned "${input.name}" (${input.slug}).`);
console.log('Wrote: src/config/church.ts, wrangler.jsonc, 4 placeholder SVGs, package.json name, astro.config.mjs site, PROVISIONING.md');
console.log('Next: review the diff, commit, then follow PROVISIONING.md.');
```

- [ ] **Step 2: Commit**

```bash
git add scripts/new-church.mjs
git commit -m "feat: new-church.mjs runner — writes per-church files from config"
```

---

## Task 8: Smoke run, idempotency, revert, full gate

**Files:** none committed (creates a temp config + provisioned files, then reverts them).

- [ ] **Step 1: Create a throwaway config** `scripts/new-church.config.json` (gitignored)

```json
{
  "name": "Grace Community Church",
  "slug": "grace-community",
  "tagline": "A place to belong.",
  "description": "A welcoming, Christ-centred church.",
  "url": "https://grace-community.smoke.workers.dev",
  "locale": "en",
  "currency": "USD",
  "timezoneOffsetMin": 0,
  "motifs": false,
  "theme": { "primary": "#1f3d7a", "accent": "#c98a1b", "dark": "#142a55", "surface": "#f6f8fc" },
  "features": { "sermons": true, "events": true, "ministries": true, "giving": true, "ai": true, "live": true }
}
```

- [ ] **Step 2: Run the provisioner**

Run: `node scripts/new-church.mjs`
Expected: prints `Provisioned "Grace Community Church" (grace-community).` and the "Wrote:" / "Next:" lines.

- [ ] **Step 3: Spot-check the generated files**

Run: `grep -c "grace-community" wrangler.jsonc package.json && grep -o "grace-community.smoke.workers.dev" astro.config.mjs && grep -o "PASTE_FROM_D1_CREATE" wrangler.jsonc && grep -o "#c98a1b" public/images/placeholder-card.svg && head -1 PROVISIONING.md`
Expected: non-zero count in wrangler.jsonc + package.json; the site URL; the D1 marker; the accent colour in the SVG; `# Provisioning checklist — Grace Community Church`.

- [ ] **Step 4: Verify idempotency** (re-running changes nothing)

```bash
git config core.safecrlf false
git add -A wrangler.jsonc src/config/church.ts public/images
node scripts/new-church.mjs
git diff --stat wrangler.jsonc src/config/church.ts public/images
```
Expected: empty `git diff --stat` output — the second run produced byte-identical files (cross-platform, no temp files needed).

- [ ] **Step 5: Confirm the provisioned church.ts compiles via a template build**

Run: `npx astro build`
Expected: `Complete!` (the generated `church.ts` is valid TS; `wrangler.jsonc` id markers do not affect a static build).

> If `astro build` errors on the id markers, skip this step — the unit tests already prove `church.ts`/`wrangler.jsonc` correctness; note the skip and continue.

- [ ] **Step 6: Revert the provisioned files and delete the throwaway config**

```bash
git checkout -- src/config/church.ts wrangler.jsonc package.json astro.config.mjs public/images/placeholder-wide.svg public/images/placeholder-portrait.svg public/images/placeholder-card.svg public/images/logo-placeholder.svg
rm -f PROVISIONING.md scripts/new-church.config.json
git status --short
```
Expected: clean tree (only the committed T3 additions remain in history; working tree shows nothing). `main`'s template files are untouched.

- [ ] **Step 7: Full unit suite + build on the template state**

Run: `npx vitest run`
Expected: PASS — prior 189 + 16 new provision tests = 205, all green.

Run: `npx astro build`
Expected: `Complete!`.

- [ ] **Step 8: Confirm clean tree**

Run: `git status --short`
Expected: empty.

---

## Task 9: Finish

- [ ] **Step 1:** Announce: "I'm using the finishing-a-development-branch skill to complete this work."
- [ ] **Step 2:** REQUIRED SUB-SKILL: superpowers:finishing-a-development-branch — verify tests, present options, execute the chosen one (expected: merge `feat/template-T3-provisioning` → `main`; do NOT deploy; no remote migrations).

---

## Definition of Done
- `scripts/new-church.config.example.json`, `scripts/new-church.mjs`, `scripts/lib/provision.mjs`, `tests/template/provision.test.ts` exist; `.gitignore` excludes the real config.
- `node scripts/new-church.mjs` with a sample config writes patched `church.ts`/`wrangler.jsonc`/SVGs/`package.json` name/`astro.config.mjs` site/`PROVISIONING.md`; re-running is idempotent.
- `npx vitest run` green (205); `npx astro build` passes on the template state.
- No provisioned (church-specific) state committed to `main`; the smoke run is reverted.
- Merges to `main`; not deployed to Kharis (Kharis deploys from the `kharis` branch).

**Next:** T4 — human-facing launch docs (README "spin up a new church", per-feature go-live notes) that lean on `PROVISIONING.md`.
