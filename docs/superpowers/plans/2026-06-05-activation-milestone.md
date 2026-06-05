# Activation Milestone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This is an **ops/runbook** plan (no new app code), so tasks are exact commands + verification + explicit **CONFIRMATION GATES** the executor must clear with the user before any live/outward/destructive action.

**Goal:** Validate the full template→deploy stack on a throwaway demo, then re-found and deploy `kharis` so it ships C2 + all stranded work and its AI is verified live, and hand over a go-live runbook for the external-account activations.

**Architecture:** Three phases — (1) provision+deploy+verify+teardown a demo on Missdiasporagh's account; (2) re-found `kharis` (`main` + Kharis identity files + `merge=ours`) and deploy it; (3) write `docs/GO-LIVE.md`. No application code changes — the 218-test suite stays the correctness gate.

**Tech Stack:** Cloudflare Wrangler v4 (D1/KV/R2/Vectorize/Workers AI/secrets/deploy), git branch surgery, Astro build. Spec: `docs/superpowers/specs/2026-06-05-activation-milestone-design.md`.

**Working dir:** `C:\dev\Projects\KharisBuilders Project\stitch_kharisbuilders_church_web_design`.

**Conventions used below:**
- `ACCT=233d917842862e30ed5207cf7b95bc33` (Missdiasporagh). Prefix wrangler with `CLOUDFLARE_ACCOUNT_ID=$ACCT` to target it.
- Wrangler subdomain for this account is `missdiasporagh` (Kharis serves at `kharisbuilders.missdiasporagh.workers.dev`), so the demo will serve at `demo-church.missdiasporagh.workers.dev`.
- `wrangler secret put` is interactive; run it non-interactively by piping: `echo "VALUE" | npx wrangler secret put NAME`.
- Dev always-pass Turnstile **secret** = `1x0000000000000000000000000000000AA`.

---

## File Structure

```
scripts/new-church.config.json   # CREATE on demo branch (gitignored) — demo input; not committed (Task 1)
docs/GO-LIVE.md                  # CREATE on main — external-account activation runbook (Task 11)
.gitattributes                   # CREATE on kharis branch — merge=ours for identity files (Task 8)
kharis.config.json               # CREATE on kharis branch — Kharis provisioner input (Task 8)
```
No `src/` changes anywhere. Phase 1 happens on a throwaway `demo/activation` branch (never merged). Phase 2 rewrites the `kharis` branch. Phase 3 adds one doc to `main`.

---

## PHASE 1 — Demo validation (account: Missdiasporagh; all resources torn down after)

### Task 1: Provision the demo on a throwaway branch

**Files:** Create `scripts/new-church.config.json` (gitignored).

- [ ] **Step 1: Confirm clean tree on main**

Run: `git status --short && git rev-parse --abbrev-ref HEAD`
Expected: empty, `main`.

- [ ] **Step 2: Create the throwaway branch**

```bash
git checkout -b demo/activation
```

- [ ] **Step 3: Write the demo config** `scripts/new-church.config.json`

```json
{
  "name": "Grace Demo Church",
  "slug": "demo-church",
  "tagline": "A place to belong.",
  "description": "A live demo of the church website template — sermons, events, ministries, giving, and more.",
  "url": "https://demo-church.missdiasporagh.workers.dev",
  "locale": "en",
  "currency": "USD",
  "timezoneOffsetMin": 0,
  "motifs": false,
  "theme": { "primary": "#1f6f5c", "accent": "#c98a1b", "dark": "#123b32", "surface": "#f5faf8" },
  "features": { "sermons": true, "events": true, "ministries": true, "giving": true, "ai": true, "live": true }
}
```

- [ ] **Step 4: Run the provisioner**

Run: `node scripts/new-church.mjs`
Expected: `Provisioned "Grace Demo Church" (demo-church).` plus the "Wrote:" lines. (Generates `church.ts`, `wrangler.jsonc` with `PASTE_FROM_*` markers, re-tinted SVGs, `PROVISIONING.md`, patched `package.json`/`astro.config.mjs`.)

- [ ] **Step 5: Sanity-check the generated config**

Run: `grep -c "demo-church" wrangler.jsonc && grep -o "PASTE_FROM_D1_CREATE" wrangler.jsonc`
Expected: ≥4 and the marker present.

---

### Task 2: Create the demo Cloudflare resources

> **CONFIRMATION GATE:** these create real resources on Missdiasporagh's account. Confirm with the user before running Task 2.

- [ ] **Step 1: Create D1**

Run: `CLOUDFLARE_ACCOUNT_ID=233d917842862e30ed5207cf7b95bc33 npx wrangler d1 create demo-church`
Expected: prints a `database_id` (UUID). **Copy it.**

- [ ] **Step 2: Put the D1 id into `wrangler.jsonc`** — replace `PASTE_FROM_D1_CREATE` with the printed UUID (Edit the file).

- [ ] **Step 3: Create the KV SESSION namespace**

Run: `CLOUDFLARE_ACCOUNT_ID=233d917842862e30ed5207cf7b95bc33 npx wrangler kv namespace create SESSION`
Expected: prints an `id`. **Copy it** and replace `PASTE_FROM_KV_CREATE` in `wrangler.jsonc`.

- [ ] **Step 4: Create R2 + Vectorize**

```bash
CLOUDFLARE_ACCOUNT_ID=233d917842862e30ed5207cf7b95bc33 npx wrangler r2 bucket create demo-church-media
CLOUDFLARE_ACCOUNT_ID=233d917842862e30ed5207cf7b95bc33 npx wrangler vectorize create demo-church-sermons --dimensions=768 --metric=cosine
```
Expected: both succeed (bucket created; index created).

- [ ] **Step 5: Verify no markers remain**

Run: `grep -o "PASTE_FROM" wrangler.jsonc ; echo "exit:$?"`
Expected: no output, `exit:1` (both ids pasted).

---

### Task 3: Migrate, seed, set the dev Turnstile secret

- [ ] **Step 1: Apply migrations to the remote demo DB**

Run: `CLOUDFLARE_ACCOUNT_ID=233d917842862e30ed5207cf7b95bc33 npx wrangler d1 migrations apply demo-church --remote`
Expected: applies all migrations (`0001`..), "Executed N commands".

- [ ] **Step 2: Seed the demo DB**

```bash
for f in seed.sql seed_funds.sql seed_lists.sql; do
  CLOUDFLARE_ACCOUNT_ID=233d917842862e30ed5207cf7b95bc33 npx wrangler d1 execute demo-church --remote --file db/$f
done
```
Expected: each applies cleanly.

- [ ] **Step 3: Insert a few demo sermons WITH transcripts** (so the library + AI have content)

```bash
CLOUDFLARE_ACCOUNT_ID=233d917842862e30ed5207cf7b95bc33 npx wrangler d1 execute demo-church --remote --command "INSERT INTO sermons (title, slug, speaker, series, scripture_ref, video_url, video_provider, description, transcript, sermon_date, published, updated_by) VALUES ('Finding Peace in Anxiety', 'finding-peace', 'Pastor Demo', 'Foundations', 'Philippians 4:6-7', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube', 'How faith answers worry.', 'Do not be anxious about anything, but in every situation, by prayer and petition, present your requests to God. The peace of God, which transcends all understanding, guards our hearts. Worry does not add a single hour to our lives; trust does. When anxiety rises, we turn it into prayer, naming our fears before a Father who cares for us.', '2026-01-04', 1, 'seed'), ('The Heart of Generosity', 'heart-of-generosity', 'Pastor Demo', 'Foundations', '2 Corinthians 9:7', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube', 'Why we give cheerfully.', 'Each of us should give what we have decided in our heart to give, not reluctantly or under compulsion, for God loves a cheerful giver. Generosity is not about the amount but the heart. When we hold our resources loosely, we reflect a God who gave everything. Giving breaks the grip of greed and roots us in gratitude.', '2026-01-11', 1, 'seed');"
```
Expected: "Executed 1 commands" (2 rows inserted).

- [ ] **Step 4: Set the dev always-pass Turnstile secret**

Run: `echo "1x0000000000000000000000000000000AA" | CLOUDFLARE_ACCOUNT_ID=233d917842862e30ed5207cf7b95bc33 npx wrangler secret put TURNSTILE_SECRET_KEY`
Expected: "Success! Uploaded secret TURNSTILE_SECRET_KEY".

---

### Task 4: Deploy the demo

> **CONFIRMATION GATE:** this publishes a live Worker. Confirm with the user before Task 4.

- [ ] **Step 1: Build + deploy**

```bash
npm run build
CLOUDFLARE_ACCOUNT_ID=233d917842862e30ed5207cf7b95bc33 npx wrangler deploy
```
Expected: build `Complete!`; deploy prints `https://demo-church.missdiasporagh.workers.dev` (and binds DB/MEDIA/SESSION/AI/SERMONS/ASSETS). If the printed URL's subdomain differs, update `church.ts` `url` + `astro.config.mjs` `site` to match and redeploy.

---

### Task 5: Verify the demo live

- [ ] **Step 1: Public pages return 200**

```bash
for p in "" about sermons visit giving ministries; do
  printf "%s -> " "/$p"; curl -s -o /dev/null -w "%{http_code}\n" "https://demo-church.missdiasporagh.workers.dev/$p"
done
```
Expected: every line `200`.

- [ ] **Step 2: The themed home renders the demo identity**

Run: `curl -s https://demo-church.missdiasporagh.workers.dev/ | grep -o "Grace Demo Church" | head -1`
Expected: `Grace Demo Church`.

- [ ] **Step 3: Workers AI is live — study guide generates**

Run: `curl -s "https://demo-church.missdiasporagh.workers.dev/api/ai/study-guide?sermon=finding-peace" | head -c 400`
Expected: JSON `{"available":true,"guide":{...}}` with a real `summary` (proves Workers AI generation live). (First call may take a few seconds.)

- [ ] **Step 4: The Ask endpoint is live**

Run: `curl -s -X POST "https://demo-church.missdiasporagh.workers.dev/api/ai/ask" -H "content-type: application/json" -d '{"question":"What does the Bible say about worry?","cf-turnstile-response":"x"}' | head -c 500`
Expected: JSON `{"answer":"...","citations":[...]}`. (The demo's Vectorize index is unpopulated — no admin reindex — so a grounded fallback answer with empty citations is the expected, correct result here; it proves the endpoint + Turnstile + no-match path live. Full retrieval-with-citations is verified on Kharis in Phase 2.)

- [ ] **Step 5: Record the outcome** — note in the run summary that the demo validated provisioning + deploy + live Workers AI + the Ask endpoint.

---

### Task 6: Tear down the demo + drop the branch

> **CONFIRMATION GATE:** destructive deletes. Confirm with the user before Task 6.

- [ ] **Step 1: Delete the demo resources** (run while still on the `demo/activation` branch, so the worker delete reads the demo `wrangler.jsonc`)

```bash
CLOUDFLARE_ACCOUNT_ID=233d917842862e30ed5207cf7b95bc33 npx wrangler delete                       # deletes the demo-church Worker (from wrangler.jsonc)
CLOUDFLARE_ACCOUNT_ID=233d917842862e30ed5207cf7b95bc33 npx wrangler d1 delete demo-church
CLOUDFLARE_ACCOUNT_ID=233d917842862e30ed5207cf7b95bc33 npx wrangler r2 bucket delete demo-church-media
CLOUDFLARE_ACCOUNT_ID=233d917842862e30ed5207cf7b95bc33 npx wrangler vectorize delete demo-church-sermons
CLOUDFLARE_ACCOUNT_ID=233d917842862e30ed5207cf7b95bc33 npx wrangler kv namespace delete --namespace-id <SESSION id from Task 2 Step 3>
```
Expected: each confirms deletion. These commands may prompt for confirmation; pass the non-interactive flag the installed wrangler offers (e.g. `--yes`/`-y`/`--force`) or answer the prompt. The demo uploaded no media, so the R2 bucket is empty and deletes cleanly.

- [ ] **Step 2: Return to main, delete the throwaway branch**

```bash
git checkout main
git branch -D demo/activation
rm -f scripts/new-church.config.json
git status --short
```
Expected: clean tree on `main` (the demo config was gitignored; nothing committed).

---

## PHASE 2 — Re-found & activate Kharis

### Task 7: Build the re-founded `kharis` on a staging branch

**Files:** none committed yet (staging branch `kharis-next`).

- [ ] **Step 1: Note the current kharis tip (for recovery)**

Run: `git rev-parse kharis`
Expected: `65b292e...` — record it; the old tip stays recoverable via reflog after the move.

- [ ] **Step 2: Stage the new kharis from main**

```bash
git checkout -b kharis-next main
```

- [ ] **Step 3: Restore Kharis's identity files from the old branch**

```bash
git checkout kharis -- src/config/church.ts wrangler.jsonc astro.config.mjs
git checkout kharis -- public/images/about-1.jpg public/images/about-2.jpg public/images/about-3.jpg public/images/about-4.jpg public/images/about-5.jpg public/images/about-6.jpg public/images/about-7.jpg public/images/about-8.jpg
git checkout kharis -- public/images/home-1.jpg public/images/home-2.jpg public/images/home-3.jpg public/images/home-4.jpg public/images/home-5.jpg public/images/home-6.jpg public/images/home-7.jpg
git checkout kharis -- public/images/ministries-1.jpg public/images/ministries-2.jpg public/images/ministries-3.jpg public/images/ministries-4.jpg public/images/ministries-5.jpg public/images/ministries-6.jpg
git checkout kharis -- public/images/visit-1.jpg public/images/visit-2.jpg public/images/kharis-logo.png
```
Expected: no errors (all restored from the `kharis` ref).

---

### Task 8: Add the merge model + Kharis config, then verify

**Files:** Create `.gitattributes`, `kharis.config.json` (on `kharis-next`).

- [ ] **Step 1: Create `.gitattributes`** (protect Kharis's identity files from `git merge main`)

```
# Kharis-specific deploy/identity files: keep ours when merging the generic template (main).
# Enable once per clone: `git config merge.ours.driver true`
src/config/church.ts merge=ours
wrangler.jsonc merge=ours
astro.config.mjs merge=ours
```

- [ ] **Step 2: Create `kharis.config.json`** (Kharis's provisioner input — the durable identity source; lets `church.ts` be regenerated if the template's config STRUCTURE changes)

```json
{
  "name": "Kharisbuilders",
  "slug": "kharisbuilders",
  "tagline": "Building Lives, Shaping Destinies.",
  "description": "Kharisbuilders is a modern, Christ-centred church — sermons, events, ministries, and a place to belong. Building Lives, Shaping Destinies.",
  "url": "https://kharisbuilders.missdiasporagh.workers.dev",
  "locale": "en",
  "currency": "GHS",
  "timezoneOffsetMin": 0,
  "motifs": true,
  "theme": { "primary": "#4a2a6b", "accent": "#a87f2e", "dark": "#2c1745", "surface": "#faf6fe" },
  "features": { "sermons": true, "events": true, "ministries": true, "giving": true, "ai": true, "live": true }
}
```
> Note: `wrangler.jsonc` is maintained independently (merge=ours) — Kharis's resource names are legacy (`kharis-sermons`, not the provisioner's `kharisbuilders-sermons` convention), so do NOT regenerate `wrangler.jsonc` from this config. This config regenerates `church.ts` only.

- [ ] **Step 3: Commit the staging branch**

```bash
git add -A
git commit -m "chore: re-found kharis on main + Kharis identity (church.ts/wrangler/astro/images) + merge=ours"
```

- [ ] **Step 4: Verify it builds and is Kharis-branded**

```bash
npm run build
grep -c "Kharisbuilders" src/config/church.ts
grep -o "1f3056ca-a44d-4a63-bfbf-c38ba9fb957b" wrangler.jsonc
grep -o "kharis-sermons" wrangler.jsonc
grep -o "kharisbuilders.missdiasporagh.workers.dev" astro.config.mjs
ls public/images/home-1.jpg
```
Expected: build `Complete!`; church.ts has "Kharisbuilders"; the real `database_id`, `kharis-sermons`, and Kharis site URL are present; `home-1.jpg` exists.

- [ ] **Step 5: Confirm C2 is present on this branch**

Run: `ls src/pages/sermons/ask.astro src/lib/ai/ask.ts`
Expected: both exist (Kharis now has C2).

---

### Task 9: Move the `kharis` branch to the re-founded state

> **CONFIRMATION GATE:** this rewrites the `kharis` branch (its deploy source). Confirm with the user. The old tip (`65b292e`, recorded in Task 7) remains in reflog: recover with `git branch kharis-old 65b292e` if ever needed.

- [ ] **Step 1: Replace `kharis`**

```bash
git checkout main
git branch -D kharis
git branch -m kharis-next kharis
git log --oneline -1 kharis
```
Expected: `kharis` now points at the re-found commit ("chore: re-found kharis ...").

- [ ] **Step 2: Enable the ours-merge driver in this clone** (so future `git merge main` honours `.gitattributes`)

Run: `git config merge.ours.driver true`
Expected: no output (config set).

---

### Task 10: Deploy Kharis + reindex + verify live

> **CONFIRMATION GATE:** this deploys to Kharis's LIVE site. Confirm with the user before Step 2.

- [ ] **Step 1: Check out kharis + build**

```bash
git checkout kharis
npm install
npm run build
```
Expected: build `Complete!`.

- [ ] **Step 2: Deploy Kharis** (reuses existing D1/R2/KV/Vectorize — no provisioning, no new migrations)

Run: `CLOUDFLARE_ACCOUNT_ID=233d917842862e30ed5207cf7b95bc33 npx wrangler deploy`
Expected: deploys to `kharisbuilders.missdiasporagh.workers.dev`, a new version id printed.

- [ ] **Step 3: Smoke the deploy**

```bash
curl -s -o /dev/null -w "/ %{http_code}\n" https://kharisbuilders.missdiasporagh.workers.dev/
curl -s -o /dev/null -w "/sermons/ask %{http_code}\n" https://kharisbuilders.missdiasporagh.workers.dev/sermons/ask
curl -s https://kharisbuilders.missdiasporagh.workers.dev/ | grep -o "Building Lives" | head -1
```
Expected: `/ 200`, `/sermons/ask 200` (C2 page live), `Building Lives` (Kharis branding intact).

- [ ] **Step 4: USER ACTION — run the one-time AI reindex**

> Tell the user: open `https://kharisbuilders.missdiasporagh.workers.dev/admin/sermons`, sign in via Cloudflare Access (one-time PIN), and click **"Reindex AI search"**. Wait for the redirect showing the reindexed count.

- [ ] **Step 5: Verify C1 search + C2 Ask live** (after the user confirms reindex done)

```bash
curl -s "https://kharisbuilders.missdiasporagh.workers.dev/sermons?q=faith" | grep -o "result" | head -1
curl -s -X POST "https://kharisbuilders.missdiasporagh.workers.dev/api/ai/ask" -H "content-type: application/json" -d '{"question":"What does it mean to have faith?","cf-turnstile-response":"x"}' | head -c 500
```
Expected: search page shows results; the Ask POST returns `{"answer":"...","citations":[...]}` with non-empty citations (grounded answer with sermon links).
> Contingency: if the Ask POST returns a 403/`verify you are human` body, Kharis's prod `TURNSTILE_SECRET_KEY` isn't the dev always-pass secret. With user OK, set it for verification: `echo "1x0000000000000000000000000000000AA" | CLOUDFLARE_ACCOUNT_ID=233d917842862e30ed5207cf7b95bc33 npx wrangler secret put TURNSTILE_SECRET_KEY` and redeploy is NOT needed (secrets apply live); re-run the curl. (Real Turnstile is set in Phase 3.)

---

## PHASE 3 — Go-live runbook

### Task 11: Write `docs/GO-LIVE.md` on main

**Files:** Create `docs/GO-LIVE.md` (on `main`).

- [ ] **Step 1: Return to main**

```bash
git checkout main
```

- [ ] **Step 2: Create `docs/GO-LIVE.md`**

```markdown
# Go-Live Checklist — Activating the External Services

The site deploys and runs without these, but giving, real spam-protection, and staff email stay
**off / on test keys** until you complete the steps below. Each step is one sitting. Replace
`<your-site>` with your deployed origin (e.g. `kharisbuilders.missdiasporagh.workers.dev`).

> Secrets are set with `wrangler secret put NAME` (it prompts for the value). If your account has
> several Cloudflare accounts, prefix with `CLOUDFLARE_ACCOUNT_ID=<id>`.

## 1. Online giving (Paystack)
1. Create a Paystack account (Ghana for GHS) → Settings → API Keys & Webhooks → copy the **test**
   public + secret keys.
2. `wrangler secret put PAYSTACK_SECRET_KEY` (paste the secret key).
3. In **Admin → Settings**: set `paystack_public_key` (the public key), `currency` (e.g. `GHS`),
   and `giving_enabled` = `true`.
4. In Paystack → Webhooks, set the URL to `https://<your-site>/api/webhooks/paystack`.
5. Make a **test-mode** gift on `/giving` and confirm it appears in **Admin → Giving**.
6. When happy, swap both keys to **live** (repeat 2–3 with live keys).

## 2. Real spam protection (Cloudflare Turnstile)
The visit, registration, and Ask forms currently use Cloudflare's always-pass **test** keys.
1. Cloudflare dashboard → Turnstile → add a widget for your site's hostname → copy the **site key**
   and **secret key**.
2. `wrangler secret put TURNSTILE_SECRET_KEY` (paste the secret key).
3. **Admin → Settings**: set `turnstile_site_key` (the site key).
4. Submit the visit form to confirm the real challenge appears and the submission succeeds.

## 3. Staff email notifications (Resend)
Until this is set, visit/registration notifications are silently skipped (no error).
1. Create a Resend account → verify your sending domain → create an API key.
2. `wrangler secret put RESEND_API_KEY` (paste the key).
3. Set `STAFF_EMAIL` (recipient) and `FROM_EMAIL` (a verified-domain address) — as Worker vars
   (dashboard → Settings → Variables) or secrets.
4. Submit the visit form and confirm the staff inbox receives the notification.

## 4. Admin access (Cloudflare Access)
Admin (`/admin` + `/api/admin`) is protected by Cloudflare Access.
1. Zero Trust → Access → Applications → your "Admin" app → Policies.
2. Confirm each staff member's email is in the **Allow** policy (One-time PIN or Google).
3. New admin paths outside `/admin` + `/api/admin` must be added to the application's destinations.

## 5. AI sermon search (one-time, after each big batch of sermons)
Admin → Sermons → **"Reindex AI search"** rebuilds the semantic search + Ask index. Run it once
after first launch and after importing many sermons. (Individual sermon saves auto-index.)
```

- [ ] **Step 3: Commit**

```bash
git add docs/GO-LIVE.md
git commit -m "docs: go-live runbook for external services (Paystack/Turnstile/Resend/Access)"
```

---

## Task 12: Final regression gate + wrap

- [ ] **Step 1: On main, run the suite + build** (no app code changed — confirm still green)

```bash
git checkout main
npx vitest run
npx astro build
```
Expected: 218 tests pass; build `Complete!`.

- [ ] **Step 2: Confirm branch state**

Run: `git branch && git status --short`
Expected: branches `main` + `kharis` (kharis re-founded); clean tree.

- [ ] **Step 3: Update project memory** with: demo validated+torn down; `kharis` re-founded (merge model: `git merge main` keeps the 3 identity files via `merge=ours`; per-clone `git config merge.ours.driver true`; regenerate `church.ts` from `kharis.config.json` only if config structure changes); Kharis deployed current with C1/C2 verified live; `docs/GO-LIVE.md` is the external-account runbook.

---

## Definition of Done
- Demo provisioned + deployed on Missdiasporagh's account, public + Workers-AI + Ask-endpoint verified live, then fully torn down; `main` untouched by Phase 1.
- `kharis` re-founded as `main` + Kharis identity (`church.ts`/`wrangler.jsonc`/`astro.config.mjs`/raster images) with `.gitattributes merge=ours` + `kharis.config.json`; builds; carries C2.
- Kharis deployed live (current); after the user's one-time reindex, C1 search + study guides + C2 Ask verified live with real citations.
- `docs/GO-LIVE.md` committed on `main`.
- 218 tests + `astro build` green on `main`; clean tree; old `kharis` tip recoverable via reflog.

**Next:** roadmap D (community & care: prayer wall + connect/next-steps workflow), then F (member accounts) / G (PWA+push). Plus the user-driven go-live steps in `docs/GO-LIVE.md`.
```
