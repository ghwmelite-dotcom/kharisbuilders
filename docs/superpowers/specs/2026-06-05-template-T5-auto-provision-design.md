# Template T5: One-Command Auto-Provision + Deploy — Design Spec

**Date:** 2026-06-05
**Status:** Approved (brainstorming)
**Depends on:** T3 (the dry provisioning script), T4 (docs).
**Working dir:** `stitch_kharisbuilders_church_web_design`

## 1. Goal

Turn the dry T3 provisioner into an optional **one-command** path that takes a filled config to a
**live, branded, working site**: `node scripts/new-church.mjs --provision`. It generates the per-church
files (as today), then creates the Cloudflare resources, writes their IDs back into `wrangler.jsonc`,
migrates + seeds the database, sets the dev Turnstile secret so forms work, builds, and deploys —
leaving only Cloudflare Access + optional real keys as manual steps. Built for repeat client onboarding.

## 2. Non-goals (YAGNI)

- Cloudflare Access automation (needs a Zero Trust API token + app config).
- Entering real Paystack / Turnstile / Resend keys (go-live steps, per-client secrets).
- Custom-domain DNS, resource teardown, multi-account management UI.
- Replacing the dry mode — it stays the safe default.

## 3. Behaviour

`node scripts/new-church.mjs` (no flag) → unchanged dry mode: generate files + `PROVISIONING.md`.

`node scripts/new-church.mjs --provision` →
1. Generate the per-church files (same as dry mode).
2. Require `CLOUDFLARE_ACCOUNT_ID` in the environment; if missing, print a clear error and exit non-zero.
3. **Confirm** before the first resource-creating step (a `y/N` prompt) unless `--yes` is passed.
4. Execute the provisioning plan (§5.3): create D1, KV (`<slug>-SESSION` title), R2, Vectorize (iff
   `features.ai`); apply migrations `--remote`; seed `seed.sql` + `seed_funds.sql` + `seed_lists.sql`;
   set the dev Turnstile secret; `npm run build`; `wrangler deploy`. IDs from D1/KV creates are parsed
   and written into `wrangler.jsonc` before the migrate/deploy steps.
5. Print the remaining manual steps (Cloudflare Access, real keys, AI reindex).

`node scripts/new-church.mjs --provision --dry-run` → print the exact command plan **without executing**
(safe preview; also how the orchestration is verified in dev).

`--yes` → skip the confirmation prompt (for CI / scripted onboarding).

**Idempotency:** if a create command fails because the resource already exists, look up the existing id
(`wrangler d1 info <name>` for D1; `wrangler kv namespace list` for KV, matched by title) and continue;
R2 / Vectorize "already exists" is treated as success. A re-run after a mid-run failure is safe.

**KV title:** uses `<slug>-SESSION` (binding stays `SESSION`) so the global KV-title namespace doesn't
collide when several churches live on one Cloudflare account.

## 4. Account / auth

- Target account via the `CLOUDFLARE_ACCOUNT_ID` environment variable (kept out of the committed config).
- Wrangler auth is assumed (the operator has run `npx wrangler login`); non-TTY wrangler prompts resolve
  to their safe fallbacks (verified in the T3 demo run: "add to config?" → no, "apply migrations?" → yes).

## 5. Architecture

Pure additions to the core (`scripts/lib/provision.mjs`, unit-tested) + a thin orchestration branch in
the runner (`scripts/new-church.mjs`) using `node:child_process`.

### 5.1 Pure core additions — `scripts/lib/provision.mjs`

- `parseD1Id(output): string | null` — extract the UUID from `"database_id": "<uuid>"` in
  `wrangler d1 create` / `d1 info` output.
- `parseKvId(output): string | null` — extract the id from `"id": "<id>"` in `kv namespace create`
  output.
- `parseKvIdFromList(output, title): string | null` — given `wrangler kv namespace list` output (JSON
  array of `{ id, title }`) and a title, return the matching id (for the already-exists path).
- `applyResourceIds(wranglerText, { databaseId, kvId }): string` — replace `PASTE_FROM_D1_CREATE` /
  `PASTE_FROM_KV_CREATE` markers with the real ids (only when provided).
- `provisionPlan(input): Step[]` — the ordered command plan. Each `Step` =
  `{ key, label, cmd: string[], capture?: 'd1Id' | 'kvId', optional?: boolean }`. Vectorize step is
  present only when `input.features.ai`. Names derive from `input.names` + `<slug>-SESSION`. The plan
  ends with the secret-set, build, and deploy steps (their `cmd` is descriptive; build/deploy/secret are
  executed specially by the orchestrator — see 5.2).

### 5.2 Orchestrator — `scripts/new-church.mjs` `--provision` branch

- Parse argv for `--provision`, `--dry-run`, `--yes`.
- After generating files: if not `--provision`, finish as today.
- If `--provision`:
  - Validate `CLOUDFLARE_ACCOUNT_ID`.
  - Build `provisionPlan(input)`.
  - If `--dry-run`: print each step's label + command; exit 0 (no execution, no confirm).
  - Else: confirm (unless `--yes`), then run each step via `execSync(cmd, { env: { ...process.env,
    CLOUDFLARE_ACCOUNT_ID }, encoding: 'utf8' })`:
    - `capture: 'd1Id'` → `parseD1Id(stdout)`; on create failure, run `wrangler d1 info <name>` and
      parse; write into `wrangler.jsonc` via `applyResourceIds`.
    - `capture: 'kvId'` → `parseKvId(stdout)`; on failure, `kv namespace list` + `parseKvIdFromList`;
      write back.
    - The Turnstile-secret step runs `wrangler secret put TURNSTILE_SECRET_KEY` with
      `{ input: DEV_TURNSTILE_SECRET }` (stdin — no shell `echo`, cross-platform).
    - Build = `npm run build`; deploy = `wrangler deploy`.
  - On any non-recoverable command error, print the failed step + stop (the operator can re-run; it's
    idempotent).
  - Print the remaining manual steps at the end.
- `DEV_TURNSTILE_SECRET = '1x0000000000000000000000000000000AA'` (always-pass test secret).

### 5.3 The plan (illustrative, feature-aware)

```
d1-create     npx wrangler d1 create <slug>                         (capture d1Id)
kv-create     npx wrangler kv namespace create <slug>-SESSION       (capture kvId)
r2-create     npx wrangler r2 bucket create <slug>-media
vectorize     npx wrangler vectorize create <slug>-sermons --dimensions=768 --metric=cosine   [iff ai]
migrate       npx wrangler d1 migrations apply <slug> --remote
seed-1        npx wrangler d1 execute <slug> --remote --file db/seed.sql
seed-2        npx wrangler d1 execute <slug> --remote --file db/seed_funds.sql
seed-3        npx wrangler d1 execute <slug> --remote --file db/seed_lists.sql
turnstile     npx wrangler secret put TURNSTILE_SECRET_KEY  (dev secret via stdin)
build         npm run build
deploy        npx wrangler deploy
```

## 6. Testing

Offline unit tests (`tests/template/provision.test.ts`, extend):
- `parseD1Id` extracts the UUID from a sample `d1 create` block; returns `null` when absent.
- `parseKvId` extracts the id from a sample `kv namespace create` block.
- `parseKvIdFromList` finds the id by title in a sample `kv namespace list` JSON; `null` when no match.
- `applyResourceIds` replaces both markers; leaves a marker untouched when its id is not provided.
- `provisionPlan`: command order; names derive from slug; `<slug>-SESSION` KV title; Vectorize step
  present iff `features.ai`; plan ends with build + deploy.

The live orchestration (execSync) is verified with `--provision --dry-run` (prints the plan, no side
effects). A real end-to-end run is the operator's, on a client account.

## 7. Definition of Done

- `node scripts/new-church.mjs` unchanged (dry).
- `node scripts/new-church.mjs --provision --dry-run` prints the full feature-aware command plan and
  exits 0, creating nothing.
- `--provision` (with `CLOUDFLARE_ACCOUNT_ID`) creates resources, writes IDs into `wrangler.jsonc`,
  migrates + seeds, sets the dev Turnstile secret, builds, and deploys; missing account id → clear error;
  confirmation unless `--yes`; idempotent on re-run.
- `npx vitest run` green (current 234 + new parser/plan tests); `npx astro build` passes.
- README + the generated `PROVISIONING.md` mention the `--provision` fast path.
- Merges to `main` (template tooling). Not deployed to Kharis (Kharis is already live; this is onboarding
  tooling). The `kharis` branch picks it up on the next `merge main`.

## 8. Open questions (resolved)

- Invocation = a `--provision` flag on `new-church.mjs` (dry stays default). ✔
- Goes all the way through `wrangler deploy`, sets the dev Turnstile secret. ✔
- Account via `CLOUDFLARE_ACCOUNT_ID` env. ✔
- Confirms before creating (with `--yes`); `--dry-run` previews. ✔
- KV title `<slug>-SESSION`; idempotent already-exists lookup. ✔
