# Activation Milestone — Design Spec

**Date:** 2026-06-05
**Status:** Approved (brainstorming)
**Working dir:** `stitch_kharisbuilders_church_web_design`

## 1. Problem & goal

A large amount of built functionality is unreachable by a live congregation:

- `kharis` (the live-deploy branch) is **33 commits behind `main`** and sits at the pre-genericize
  snapshot (`65b292e`). It lacks C2 ("Ask the Pastor") and the entire template arc. It cannot simply
  `git merge main`, because `main` carries the *genericization* (neutral `church.ts`, stripped
  `wrangler.jsonc`, deleted Kharis raster images) that would de-brand and break Kharis.
- The AI search/Ask path (C1 + C2) has **never been verified live** — it needs a one-time admin
  "Reindex AI search", which was a deferred user action.
- Giving (B1+B2), real Turnstile, and email (Resend) are all dark / on dev keys.

**Goal:** validate the full template→deploy stack on a throwaway demo, then unstick and activate
Kharis (deploy it current + verify AI live), and hand over a single runbook for the external-account
activations only the user can do.

This milestone introduces **no new application code** — so the existing 218-test suite remains the
correctness gate. The work is git/branch reconciliation, Cloudflare ops (driven by the assistant,
authed as `ghwmelite@gmail.com` with access to Missdiasporagh's account `233d917842862e30ed5207cf7b95bc33`),
and documentation.

## 2. Key finding — reconciliation is small

Diffing `kharis..main`, only **four things** must remain Kharis-specific; everything else from `main`
(C2, config-driven branding refactors, docs, provisioning script, placeholder SVGs) is safe for Kharis
to take, because Kharis keeps its own `church.ts` and its real content lives in remote D1 (which
overrides the generic defaults):

1. `src/config/church.ts` — Kharis identity/theme/currency/motifs.
2. `wrangler.jsonc` — Kharis's real resource names + IDs.
3. `astro.config.mjs` — Kharis's `site` URL (canonical/sitemap).
4. Kharis's raster images — `public/images/{about-*,home-*,ministries-*,visit-*}.jpg` +
   `public/images/kharis-logo.png` — its default imagery (its D1 content points at
   `/images/home-1.jpg` etc., so these files must exist).

The generic `fields.ts` content defaults and empty seeds are harmless to Kharis: its D1 backfill
already supplies stored values that win over defaults, and the live D1 is already seeded.

## 3. Phase 1 — Demo validation (risk-free)

Account: Missdiasporagh `233d917842862e30ed5207cf7b95bc33` (known to support Workers AI + Vectorize).
All demo resources are name-isolated and torn down afterward. `main` is never mutated.

1. `git checkout -b demo/activation` from `main` (throwaway; never merged).
2. Write `scripts/new-church.config.json` with demo values (slug `demo-church`, USD, neutral theme,
   all features on). Run `node scripts/new-church.mjs` (proves T3). Review the generated diff.
3. Drive wrangler against the account (`CLOUDFLARE_ACCOUNT_ID=233d917842862e30ed5207cf7b95bc33`):
   - `wrangler d1 create demo-church` → paste `database_id` into `wrangler.jsonc`.
   - `wrangler kv namespace create SESSION` → paste `id`.
   - `wrangler r2 bucket create demo-church-media`.
   - `wrangler vectorize create demo-church-sermons --dimensions=768 --metric=cosine`.
   - `wrangler d1 migrations apply demo-church --remote`; seed `db/seed.sql`, `db/seed_funds.sql`,
     `db/seed_lists.sql`.
   - `wrangler secret put TURNSTILE_SECRET_KEY` = the dev always-pass secret
     `1x0000000000000000000000000000000AA` (so forms work without a real widget).
   - `npm run build && wrangler deploy` → capture the `*.workers.dev` URL. If the URL differs from the
     config, update `church.ts` `url` + `astro.config.mjs` `site` and redeploy.
4. Insert a few demo sermons **with transcripts** via `wrangler d1 execute demo-church --remote
   --command "INSERT ..."` so the library is non-empty.
5. **Verify live** (assistant, via curl/fetch):
   - public pages return 200 and are themed (home/about/sermons/visit/giving);
   - the visit form POST succeeds (dev Turnstile passes);
   - `GET /api/ai/study-guide?sermon=<slug>` returns a generated guide (proves **Workers AI live**);
   - `POST /api/ai/ask` with a question returns JSON: either a grounded fallback (index not yet
     populated) or — if reindex is reachable — a real answer. Reaching the admin reindex on the demo
     is NOT required; the public study-guide + ask-endpoint checks prove the live AI path.
6. **Teardown:** delete the demo worker + D1 + R2 + KV + Vectorize (assistant, with confirmation);
   `git checkout main && git branch -D demo/activation`.

**Definition of done (Phase 1):** a demo deployed, public + Workers-AI-generation verified live, then
fully torn down; `main` clean.

## 4. Phase 2 — Re-found & activate Kharis

### 4.1 Re-found the `kharis` branch (assistant; confirmed before the branch move)

1. `git checkout -b kharis-next main`.
2. Restore Kharis's four identity items from the old branch:
   `git checkout kharis -- src/config/church.ts wrangler.jsonc astro.config.mjs` and restore the
   raster images (`git checkout kharis -- public/images/about-*.jpg public/images/home-*.jpg
   public/images/ministries-*.jpg public/images/visit-*.jpg public/images/kharis-logo.png`).
3. Add `.gitattributes` with `merge=ours` for the three config files; add a `kharis.config.json`
   (Kharis's provisioner input) as the durable source of truth; commit.
4. Verify `npm run build` succeeds and a spot-check confirms Kharis identity (name "Kharisbuilders",
   purple theme, real `database_id`).
5. **Confirm with the user**, then move the branch: `git branch -f kharis kharis-next` (old tip
   recoverable via reflog) and delete `kharis-next`.
6. Document the ongoing flow: per-clone `git config merge.ours.driver true`; future features =
   `git checkout kharis && git merge main` (the three config files stay Kharis's); if the template's
   config *structure* changes, re-run `node scripts/new-church.mjs` from `kharis.config.json`.

### 4.2 Deploy Kharis (assistant; confirmed before the live deploy)

`git checkout kharis` → `npm run build && wrangler deploy` against Missdiasporagh's account, reusing
Kharis's existing D1/R2/KV/Vectorize (no new provisioning, no migrations beyond what's already
applied). This ships C2 + all stranded work to the live site.

### 4.3 Reindex + verify (user does the click; assistant verifies)

- **User:** log into Kharis `/admin/sermons` (Cloudflare Access OTP) → click **"Reindex AI search"**.
- **Assistant verifies via curl:** `GET /sermons?q=faith` returns matching results; `POST /api/ai/ask`
  with a question returns a cited answer (Kharis's dev Turnstile secret lets the call through);
  `/sermons/ask` renders; a sermon's study guide loads. C1 + C2 confirmed live.

**Definition of done (Phase 2):** `kharis` re-founded with the merge model documented; Kharis deployed
current; C1 search + study guides + C2 Ask verified live with real citations.

## 5. Phase 3 — Go-live runbook (external accounts; user executes)

Commit `docs/GO-LIVE.md` — a single, ordered, copy-pasteable checklist for the activations only the
user can perform, each with exact commands/dashboard steps and a verification line:

- **Paystack:** create account → keys → `wrangler secret put PAYSTACK_SECRET_KEY` → admin Settings
  `paystack_public_key` / `currency` / `giving_enabled=true` → set webhook
  `https://<origin>/api/webhooks/paystack` → test-mode gift → swap to live keys.
- **Turnstile (real):** create a widget for the hostname → `wrangler secret put TURNSTILE_SECRET_KEY`
  → admin Settings `turnstile_site_key` (replaces the dev always-pass keys).
- **Email (Resend):** account + verified domain + API key → `wrangler secret put RESEND_API_KEY` +
  `STAFF_EMAIL` / `FROM_EMAIL` → so `notifyStaff` actually emails on visit/registration.
- **Cloudflare Access:** confirm staff emails are in the Allow policy over `admin` + `api/admin`.

**Definition of done (Phase 3):** `docs/GO-LIVE.md` committed; giving/email/real-Turnstile remain
safe-dark until the user completes it.

## 6. Safety & rollback

- No application code changes → 218 tests unchanged; run them once at the end as a regression gate.
- `main` is never mutated by Phase 1 (throwaway branch) and only gains `docs/GO-LIVE.md` + this spec/plan.
- The `kharis` branch rewrite is confirmed beforehand; the previous `kharis` tip (`65b292e`) is
  recoverable via reflog and noted before the move.
- Every live/outward action (demo deploy, demo teardown, Kharis branch move, Kharis deploy) is
  confirmed with the user immediately before execution.
- Demo resources are explicitly torn down to avoid lingering cost/footprint.

## 7. Open questions (resolved)

- Sequence = demo-first, then Kharis. ✔
- Assistant drives wrangler; user does the reindex click + Phase 3 external accounts. ✔
- Demo account = Missdiasporagh `233d917842862e30ed5207cf7b95bc33`, name-isolated, torn down. ✔
- Branch model = re-found `kharis` (main + 4 identity items) + `merge=ours` + provisioner-as-reconciler. ✔
