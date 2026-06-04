# Template T3: `new-church` Provisioning Script — Design Spec

**Date:** 2026-06-04
**Status:** Approved (brainstorming)
**Depends on:** T1 (brand/config extraction), T2 (generic content & placeholder assets)
**Working dir:** `stitch_kharisbuilders_church_web_design`

## 1. Goal

Turn the generic template (`main`) into a configured, ready-to-deploy instance for a specific church with minimal friction:

1. Fill **one input file**.
2. Run **one script**.
3. Follow the **emitted command checklist**.

The script is **dry**: it patches files deterministically on the working tree and **never mutates a Cloudflare account** itself. All account-creating actions (D1/R2/KV/Vectorize create, migrate, seed, secrets, deploy) are emitted as an ordered, copy-pasteable checklist for the user to run.

**Operating model:** one church = one clone of the template = one Cloudflare Worker. The user clones the template repo for a new church, fills the config, runs the script, commits the patched files, then works the checklist.

## 2. Non-goals (YAGNI)

- Automatically creating Cloudflare resources (explicitly rejected — too risky/non-idempotent for a live account).
- Multi-tenant single-deployment (each church is its own worker/clone).
- Automated Cloudflare Access app creation or secret provisioning (documented as manual checklist steps).
- Custom-domain DNS automation.
- Interactive prompts or CLI flags (single input file chosen instead).

## 3. Input file

`scripts/new-church.config.example.json` is committed and ships with **sentinel values** (`slug: "example-church"`, etc.) so an unedited copy is rejected by `validateChurchInput`. The user copies it to `scripts/new-church.config.json` (gitignored) and fills it in. The block below is an *illustrative filled* example; shape mirrors `ChurchConfig` (`src/config/church.ts`) plus a `slug`:

```jsonc
{
  "name": "Grace Community Church",
  "slug": "grace-community",            // lowercase, [a-z0-9-], 2..40 chars — drives all CF resource names
  "tagline": "A place to belong.",
  "description": "A welcoming, Christ-centred church ...",
  "url": "https://grace-community.<account>.workers.dev",
  "locale": "en",
  "currency": "USD",
  "timezoneOffsetMin": 0,
  "motifs": false,
  "theme": { "primary": "#3b3a6b", "accent": "#b08a3e", "dark": "#23223f", "surface": "#f7f7fb" },
  "features": { "sermons": true, "events": true, "ministries": true, "giving": true, "ai": true, "live": true }
}
```

**Derived resource names (from `slug`):**

| Resource | Value |
|---|---|
| Worker `name` (wrangler.jsonc + package.json) | `slug` |
| D1 `database_name` | `slug` |
| R2 `bucket_name` | `${slug}-media` |
| Vectorize `index_name` | `${slug}-sermons` |
| KV binding | `SESSION` (unchanged; id provisioned at create time) |

## 4. Architecture

Two layers — a **pure, unit-tested core** and a **thin fs runner** — so all transformation logic is testable offline (consistent with the project rule: keep testable logic in pure functions; bindings/fs at the edges).

**Runtime:** plain Node ESM (`.mjs`), zero new dependencies, run with `node` directly (no `vite-node`/TS build — `vite-node` is not installed and the script must run on a fresh clone with only `npm install` done). Validation is hand-rolled (no zod) so the script imports nothing outside `node:` builtins.

### 4.1 Pure core — `scripts/lib/provision.mjs`

No `fs`, no network, no third-party imports. Exported functions:

- **`validateChurchInput(raw): { ok: true, value: ChurchInput } | { ok: false, errors: string[] }`**
  - Hand-rolled checks: `slug` matches `/^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])$/`; each `theme.*` matches `/^#[0-9a-fA-F]{6}$/`; `currency` is 3 uppercase letters; `features.*` booleans; `timezoneOffsetMin` integer in `[-720, 840]`; required strings non-empty.
  - Rejects the example sentinel (`slug === 'example-church'`) with a clear "copy and edit the config first" error.
  - On success, `value` includes a derived `names` object (`{ worker, database, bucket, vectorize }`).
  - `ChurchInput` is a JSDoc typedef (no static TS).

- **`renderChurchConfigTs(input: ChurchInput): string`**
  - Emits the full `src/config/church.ts` from a fixed template string. The `interface` blocks and `feature()` helper are reproduced verbatim; only the `CHURCH` object literal is filled from the input. Strings are JSON-escaped to be safe inside single-or-template quotes.

- **`renderWranglerJsonc(names): string`**
  - Emits a fresh `wrangler.jsonc` with slug-derived names. `database_id` and the SESSION `id` are emitted as literal markers `"PASTE_FROM_D1_CREATE"` / `"PASTE_FROM_KV_CREATE"` (real IDs do not exist until the user runs `wrangler create`). `compatibility_date`, flags, `main`, `assets`, `observability`, `ai`, and the R2/Vectorize blocks match the current template, with names substituted.

- **`retintSvg`** — an object of 4 renderers `{ wide, portrait, card, logo }`, each `(theme) => string`. They reproduce the T2 placeholder SVG geometry but substitute the gradient stops with `theme.primary` (light stop) and `theme.dark` (dark stop), the ring stroke with `theme.accent`, and the logo center with `theme.primary`.

- **`buildChecklist(input: ChurchInput): string`**
  - Returns the `PROVISIONING.md` body as markdown. **Feature-aware:** Vectorize-create + AI-reindex steps only when `features.ai`; Paystack secret + giving settings only when `features.giving`; live notes only when `features.live`. Always includes D1/KV/R2 create, migrate, seed, Turnstile secret (forms), Access app, deploy, and post-deploy settings.

### 4.2 Thin runner — `scripts/new-church.mjs` (run via `node scripts/new-church.mjs`)

Side-effecting orchestration only:

1. Read `scripts/new-church.config.json` (error with guidance if missing).
2. `validateChurchInput` → on failure, print the zod issues and exit non-zero.
3. Write outputs:
   - `src/config/church.ts` ← `renderChurchConfigTs`
   - `wrangler.jsonc` ← `renderWranglerJsonc`
   - `public/images/placeholder-wide.svg`, `placeholder-portrait.svg`, `placeholder-card.svg`, `logo-placeholder.svg` ← `retintSvg.*`
   - `package.json` — patch only the `"name"` field (read, replace value, write; preserve formatting via a targeted regex on the `"name"` line).
   - `astro.config.mjs` — patch only the `site:` string to `input.url`.
   - `PROVISIONING.md` (repo root) ← `buildChecklist`
4. Print a summary (what was written, what to do next: "review the diff, commit, then follow PROVISIONING.md").

**Idempotent:** re-running with the same config reproduces byte-identical files. The runner performs no network or `wrangler` calls.

## 5. The emitted checklist (`PROVISIONING.md`)

Ordered, copy-pasteable. Illustrative (feature-aware) sequence:

1. `npx wrangler d1 create <slug>` → paste `database_id` into `wrangler.jsonc`.
2. `npx wrangler kv namespace create SESSION` → paste `id` into `wrangler.jsonc`.
3. `npx wrangler r2 bucket create <slug>-media`.
4. *(ai)* `npx wrangler vectorize create <slug>-sermons --dimensions=768 --metric=cosine`.
5. `npx wrangler d1 migrations apply <slug> --remote`.
6. Seed: `npx wrangler d1 execute <slug> --remote --file db/seed.sql` (repeat for `db/seed_funds.sql`, `db/seed_lists.sql`).
7. Secrets: `npx wrangler secret put TURNSTILE_SECRET_KEY`; *(giving)* `... PAYSTACK_SECRET_KEY`; *(email)* `... RESEND_API_KEY`.
8. **Manual** — Cloudflare Access: add a self-hosted (Workers) application covering path `admin` **and** path `api/admin` on the worker's hostname; Allow policy with staff emails (OTP/Google).
9. `npm run deploy`.
10. Post-deploy (admin → Settings): set `paystack_public_key`, `currency`, `giving_enabled=true` *(giving)*; create a Turnstile widget → set secret + `turnstile_site_key`; *(ai)* admin → Sermons → "Reindex AI search".

## 6. Testing

`tests/template/provision.test.ts` (vitest, offline; imports `../../scripts/lib/provision.mjs`):

- `validateChurchInput`: rejects bad slug (uppercase, leading hyphen, too short), bad hex, bad currency; rejects the example sentinel; accepts a valid input and derives the four resource names correctly.
- `renderChurchConfigTs`: output contains the church `name`/`currency`/feature flags; contains `export const CHURCH` and `export function feature`; no leftover template placeholders.
- `renderWranglerJsonc`: parses as JSONC (strip comments → `JSON.parse`); has `name`/`database_name`/`bucket_name`/`index_name` derived from slug; contains the two `PASTE_FROM_…` markers.
- `retintSvg.*`: each output `trimStart().startsWith('<svg')`, contains the new `primary/accent/dark` hex values and not the generic `#3b3a6b`/`#b08a3e` when a different theme is supplied.
- `buildChecklist`: includes Vectorize/AI steps iff `features.ai`; includes Paystack secret iff `features.giving`; always includes D1 create + deploy.

No test touches `fs`/network; the runner is verified manually by a smoke run that regenerates the current generic template values and confirms a clean `git diff` (i.e., feeding the generic config reproduces today's files) — plus a re-skin smoke (a sample church) reverted afterward.

## 7. Definition of Done

- `scripts/new-church.config.example.json`, `scripts/new-church.mjs`, `scripts/lib/provision.mjs`, `tests/template/provision.test.ts` exist; `.gitignore` excludes `scripts/new-church.config.json`.
- `node scripts/new-church.mjs` with a sample config writes patched `church.ts`/`wrangler.jsonc`/SVGs/`package.json`/`astro.config.mjs`/`PROVISIONING.md`; output is idempotent.
- Feeding a config equal to the current generic identity reproduces the existing files (clean `git diff` on `church.ts`/`wrangler.jsonc` apart from the intended id markers).
- `npx vitest run` stays green (existing 189 + new provision tests).
- `npx astro build` passes after a provision run.
- Merges to `main`; **not** deployed to Kharis. (Kharis deploys from the `kharis` branch.)

## 8. Open questions (resolved)

- Scope = dry generate-files-+-checklist (no account mutation). ✔
- Input = single JSON file. ✔
- `wrangler.jsonc` regenerated fresh from template (safe on a clone). ✔
- SVGs re-tinted to brand colors. ✔
- `PROVISIONING.md` at repo root. ✔
