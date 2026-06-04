# Template T2: Generic Starter Content & Placeholder Assets — Design Spec

**Date:** 2026-06-04
**Status:** Approved (design), pending spec review
**Project:** KharisBuilders church platform → reusable **template**. T1 extracted code-level identity into `church.config`. **T2 makes `main` itself a clean, generic church** (neutral copy, license-clean placeholder assets, hybrid seeds) so a fresh deploy looks finished out of the box — while Kharis stays live and unchanged on its own branch.

---

## 1. Purpose & Goals

Turn the repo `main` into the **generic template**: a fresh clone + provision + deploy presents as a polished, denomination-neutral church with no Kharis-specific words, people, imagery, or licensing baggage. The existing Kharis live site is preserved by moving Kharis's identity to a `kharis` deploy branch and snapshotting Kharis's effective copy into its remote D1 first.

**Success criteria**
- A fresh database + `main` build renders a complete, professional-looking generic church (home/about/visit/ministries/giving) with warm, universal copy — nothing reads "unfinished" and nothing says "Kharis", "Building Lives", "Glass Atrium", etc.
- No redistributable file carries unknown-license imagery: the 24 Stitch JPGs + `kharis-logo.png` are gone from `main`; image slots default to authored SVG placeholders.
- Kharis's **live** site is visually and behaviourally unchanged after T2 (its copy now lives explicitly in remote D1; its config lives on the `kharis` branch; its worker is not redeployed from generic `main`).
- A new church customises by editing `church.config` + uploading real images in admin — no code edits to get a generic-but-finished baseline.

**Decisions locked in (brainstorming):**
- Copy tone = **plausible generic church** (warm, universal, finished — not bracketed placeholders).
- Imagery = **brand-tinted SVG placeholders** + monogram logo (license-clean); Stitch JPGs removed from `main`.
- Seeds = **hybrid** (seed structural funds/ministries/home-cards; leave people/journey/sermons/events empty).
- Placement = **generic `main` + preserve Kharis** (Kharis → `kharis` branch + remote-D1 backfill).

---

## 2. Scope

**In scope (T2):**
- `church.config` default values → generic identity (name, tagline, description, url, logo, ogImage, currency, motifs, theme).
- `src/lib/content/fields.ts` → every `default:` string rewritten generic; image defaults repoint to placeholder SVGs.
- Placeholder assets: `public/images/{placeholder-wide,placeholder-portrait,placeholder-card,logo-placeholder}.svg`; **delete** the 24 `*.jpg` + `kharis-logo.png` from `main`.
- Page-component index-based image fallbacks (leaders/journey/home-cards/sermon/event/ministry) repoint to placeholder SVGs.
- Seed files: `db/seed.sql` (settings + generic ministries; drop `default_theme:'sacred'`; neutralize address/email), `db/seed_lists.sql` (keep home_cards generic; **remove** leaders + journey rows), `db/seed_funds.sql` (already generic — keep), `db/seed_sermons_events.sql` (**remove all rows incl. the rickroll URL**; file becomes empty/optional-sample).
- Code sweep: route remaining hardcoded `Kharisbuilders` literals (page `<title>` suffixes, Footer brand blurb) through `SITE.name` / `CHURCH.description`.
- Kharis preservation: remote-D1 `page_content` backfill (`INSERT OR IGNORE` from current Kharis defaults); create `kharis` branch retaining Kharis config + assets.

**Out of scope:**
- **T3** — the `new-church` provisioning script (wrangler.jsonc resource templating, per-church SVG re-tint, fresh-DB bootstrap, resource creation).
- **T4** — launch / customization docs.
- Runtime brand-adaptive placeholders (static SVGs bake the template theme; re-tint is a T3 concern).
- Changing Kharis's remote content beyond the additive backfill.
- `wrangler.jsonc` resource templating (stays pointed at Kharis resources for now; T3 templatizes).

---

## 3. Architecture

```
TWO TRACKS
  main (generic template)            kharis (Kharis's deploy)
  ├─ church.config = generic         ├─ church.config = Kharis (verbatim T1 values)
  ├─ fields.ts defaults = generic    ├─ fields.ts defaults = Kharis (current)
  ├─ seeds = hybrid generic          ├─ seeds = Kharis
  ├─ images = placeholder SVGs       ├─ images = 24 JPGs + kharis-logo.png
  └─ wrangler.jsonc (Kharis res.*)   └─ wrangler.jsonc (Kharis res.)
        *T3 templatizes resources

PRESERVATION ORDER (must run before genericizing main)
  1. Backfill Kharis remote D1 page_content with current Kharis registry
     defaults (INSERT OR IGNORE) -> Kharis copy no longer depends on fields.ts.
  2. Create `kharis` branch at current main HEAD (Kharis state).
  3. Genericize main (this spec's edits).
  4. Kharis worker stays on its current deployed version; future Kharis
     deploys come from `kharis` (merge main -> kharis for features).
```

Compile-time generic defaults; Kharis content is data (remote D1) + a branch. No new runtime code paths — only default *values*, asset files, and seed contents change, plus a small literal sweep.

---

## 4. Components & Boundaries

**`src/config/church.ts` (generic values).** Proposed:
```ts
name: 'Grace Community Church',
tagline: 'A place to belong.',
description: 'A welcoming, Christ-centred church — sermons, events, ministries, and a community to call home.',
url: 'https://example.com',
logo: '/images/logo-placeholder.svg',
ogImage: '/images/placeholder-wide.svg',
locale: 'en', currency: 'USD', timezoneOffsetMin: 0,
motifs: false, // Adinkra/kente are Ghana-specific; a church enables them
theme: { primary: '#3b3a6b', accent: '#b08a3e', dark: '#23223f', surface: '#f7f7fb' }, // calm indigo + warm gold
features: { sermons: true, events: true, ministries: true, giving: true, ai: true, live: true },
```
Type/interface unchanged.

**`src/lib/content/fields.ts` (generic copy).** Rewrite every `default:`; structure/keys unchanged so the editor, allowlist, and `contentDefaults()`/`makeContent` fallback all keep working. Representative new defaults:
- `home.hero_kicker` "Welcome Home" · `home.hero_line1` "A Place to" · `home.hero_line2` "Belong." · CTAs "Plan a Visit" `/visit`, "Watch Online" `/sermons`.
- `home.gathering_schedule` keep the same generic Sun/Sun/Wed JSON (it's already non-Kharis).
- `home.pastor_*` generic warm welcome, signature "Lead Pastor".
- `home.scripture_verse` "For where two or three gather in my name, there am I with them." · ref "Matthew 18:20".
- `home.giving_*` "Generosity" / "Give Generously" / generic body.
- `about.*` "Who We Are" / "Our Vision" + "Our Mission" plain text.
- `visit.*` generic "Plan Your Visit", "What to Expect" (dress/kids/service/afterward) with no Kharis-specific names.
- Image defaults → `/images/placeholder-wide.svg` (heros, scripture/giving bands), `/images/placeholder-portrait.svg` (pastor), `/images/placeholder-card.svg` (about vision, visit afterward), and `pages.*` heros → wide/card as fits.

**Placeholder assets.** Author 4 SVGs in `public/images/`:
- `placeholder-wide.svg` (≈1600×900) — soft diagonal brand gradient (`--brand` colors baked from template theme), faint centered monogram, small "Replace in Admin" label bottom-right.
- `placeholder-portrait.svg` (≈800×1000) — same treatment, portrait.
- `placeholder-card.svg` (≈1200×900) — same treatment, landscape card.
- `logo-placeholder.svg` (≈512²) — monogram (first letter of template name) in brand colors on transparent.
**Delete from `main`:** all `public/images/*.jpg` (24) + `kharis-logo.png`. Components that fell back to JPG-by-index (`about.astro` leaders/journey, `index.astro` home-cards, `SermonCard`/`EventCard` cycles, ministries bento) repoint their fallback to the matching placeholder SVG.

> Static-SVG limitation: an `<img src>`/background SVG can't read the host page's `--brand-*`, so placeholders bake the **template** theme. They read as intentional on any palette; re-tinting to a church's exact colors is a T3 job (by then real photos are being uploaded). Accepted.

**Seeds (hybrid).**
- `db/seed.sql`: keep the `service_times` JSON (generic), set `contact_email`/`phone`/`address` to neutral blanks or `example.com` placeholders, `socials` empty, **remove** `default_theme` row (theme retired in T1). Ministries → 4 generic (Worship & Arts, Children's Ministry, Youth, Community Outreach) with no leader names (or leader blank).
- `db/seed_lists.sql`: keep the 3 generic `home_cards`; **remove** the `leaders` and `journey` INSERTs (those pages render empty-states).
- `db/seed_funds.sql`: unchanged (General Offering, Tithe, Building Fund, Missions & Outreach are generic).
- `db/seed_sermons_events.sql`: **remove all INSERT rows** (no fake sermons/events, no rickroll URL); leave a commented header explaining a church adds these in admin.

**Code sweep.** Route remaining hardcoded literals through config:
- Page `<title>` props that hardcode `| Kharisbuilders` → `| ${SITE.name}` (import `SITE` where missing).
- `Footer.astro`: brand blurb paragraph → `CHURCH.description` (or tagline); **the hardcoded settings fallbacks** `address ?? '12 Cathedral Way, West End, London'` and `email ?? 'hello@kharisbuilders.org'` → neutral fallbacks (`''` / `'hello@example.com'`) so an unseeded footer shows nothing Kharis-/London-specific.
- Grep `src/` for `Kharis` and neutralize any stray literal (none expected in logic).

---

## 5. Error Handling / Safety
- All changes are default *values*, static assets, or seed contents — no control-flow changes; the fallback chain (`stored ?? default ?? ''`) is untouched.
- Removing image JPGs is safe on `main` because every reference repoints to an SVG that exists; Kharis keeps the JPGs on its branch.
- The Kharis D1 backfill is additive (`INSERT OR IGNORE`) — it can never overwrite a staff edit and is idempotent.
- Empty seed tables render existing graceful empty-states (verified in E2/E3), never a broken page.

## 6. Security
- No new routes, secrets, inputs, or data flows. SVGs are static, hand-authored (no script). Seed/backfill are parameterless SQL run by the maintainer.

## 7. Testing Strategy
**Unit:**
- `contentDefaults()` integrity: every value is non-empty; assert NONE match `/Kharis|Building Lives|Shaping Destinies|Glass Atrium|Anderson/`.
- `church.ts` config integrity test still passes (4 hex theme colors, 6 features) with generic values.
- Seed-file sanity: `db/*.sql` parse (apply to a scratch in-memory D1 in a test) without error.
- Existing 181 stay green (nothing logic-level changed).

**Build/visual:**
- `npm run build` passes with generic config.
- **Fresh-DB render check:** apply migrations + generic seeds to a local D1, screenshot home/about/visit (reduced-motion, 1280) and confirm a finished generic church (placeholder SVGs intentional, no Kharis words, no broken images, indigo/gold theme).

## 8. Rollout
1. **Backfill Kharis remote D1** `page_content` (INSERT OR IGNORE from current Kharis defaults).
2. **Create `kharis` branch** at current HEAD (Kharis config + assets + seeds).
3. **Genericize `main`** (all §4 edits) on a feature branch → tests + build + fresh-DB screenshot → merge to `main`.
4. **Kharis live worker untouched** (stays on its current deploy). Optionally redeploy Kharis from `kharis` branch to confirm parity (no change expected).
5. No remote migrations (none added). Generic seeds are for *new* churches' fresh DBs, not Kharis's.

## 9. Open Questions (resolved defaults)
- Generic identity values (name/currency/theme) are proposals in §4 — adjustable, but locked as written unless changed at spec review.
- Static SVG placeholders bake the template theme (re-tint = T3); accepted.
- `wrangler.jsonc` keeps Kharis resources for now (T3 templatizes); generic `main` is simply not deployed to Kharis's worker.
- Kharis remains deployable via the `kharis` branch; feature updates flow `main → kharis`.
