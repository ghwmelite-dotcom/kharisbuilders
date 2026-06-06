# Template T5: One-Command Auto-Provision + Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development). Steps use checkbox (`- [ ]`) syntax.

**Goal:** `node scripts/new-church.mjs --provision` generates the per-church files, then creates the Cloudflare resources, writes their IDs back, migrates + seeds, sets the dev Turnstile secret, builds, and deploys — a one-command path to a live, branded site. Dry generate-only stays the default.

**Architecture:** Add pure, unit-tested helpers to `scripts/lib/provision.mjs` (ID parsers, `applyResourceIds`, `provisionPlan`) + a thin `--provision` orchestration branch in `scripts/new-church.mjs` using `node:child_process`. The live path is previewed/verified with `--provision --dry-run` (no side effects).

**Tech Stack:** Plain Node ESM (no new deps; `node:child_process`, `node:readline`), Cloudflare Wrangler v4, Vitest. Spec: `docs/superpowers/specs/2026-06-05-template-T5-auto-provision-design.md`.

**Working dir:** `C:\dev\Projects\KharisBuilders Project\stitch_kharisbuilders_church_web_design`.

---

## File Structure

```
scripts/lib/provision.mjs        # MODIFY — parsers, applyResourceIds, provisionPlan (Tasks 1-2)
tests/template/provision.test.ts # MODIFY — tests for the above (Tasks 1-2)
scripts/new-church.mjs           # MODIFY — argv + --provision orchestrator (Task 3)
README.md                        # MODIFY — note the --provision fast path (Task 4)
scripts/lib/provision.mjs (buildChecklist) # MODIFY — one-line note (Task 4)
```

---

## Task 1: Pure helpers — ID parsers + writeback

**Files:** Modify `scripts/lib/provision.mjs`, `tests/template/provision.test.ts`.

- [ ] **Step 1: Confirm clean tree + branch**

Run: `git status --short && git rev-parse --abbrev-ref HEAD`
Expected: empty, `main`. Then: `git checkout -b feat/T5-auto-provision`

- [ ] **Step 2: Add the failing tests** — append to `tests/template/provision.test.ts`:

```ts
import { parseD1Id, parseKvId, parseKvIdFromList, applyResourceIds } from '../../scripts/lib/provision.mjs';

describe('wrangler output parsers', () => {
  it('parseD1Id pulls the database_id', () => {
    const out = `✅ Created DB\n{\n  "d1_databases": [\n    { "binding": "DB", "database_name": "grace", "database_id": "a5bb3493-a21c-4ce0-8de9-320acd564056" }\n  ]\n}`;
    expect(parseD1Id(out)).toBe('a5bb3493-a21c-4ce0-8de9-320acd564056');
    expect(parseD1Id('no id here')).toBeNull();
  });
  it('parseKvId pulls the namespace id', () => {
    expect(parseKvId('✨ Success!\n      "id": "0e45875a4d87416eab4da7d189896c37"')).toBe('0e45875a4d87416eab4da7d189896c37');
    expect(parseKvId('nope')).toBeNull();
  });
  it('parseKvIdFromList finds the id by title', () => {
    const out = `Resource location: remote\n[\n  { "id": "aaa", "title": "other-SESSION" },\n  { "id": "bbb", "title": "grace-SESSION" }\n]`;
    expect(parseKvIdFromList(out, 'grace-SESSION')).toBe('bbb');
    expect(parseKvIdFromList(out, 'missing')).toBeNull();
    expect(parseKvIdFromList('not json', 'x')).toBeNull();
  });
  it('applyResourceIds replaces only the provided markers', () => {
    const w = '"database_id": "PASTE_FROM_D1_CREATE"\n"id": "PASTE_FROM_KV_CREATE"';
    expect(applyResourceIds(w, { databaseId: 'd1', kvId: 'kv' })).toBe('"database_id": "d1"\n"id": "kv"');
    expect(applyResourceIds(w, { databaseId: 'd1' })).toContain('PASTE_FROM_KV_CREATE');
  });
});
```

- [ ] **Step 3: Run → fail**

Run: `npx vitest run tests/template/provision.test.ts`
Expected: FAIL (functions not exported).

- [ ] **Step 4: Append the helpers to `scripts/lib/provision.mjs`** (after `buildChecklist`):

```js
/** Extract the database_id from `wrangler d1 create` / `d1 info` output. */
export function parseD1Id(output) {
  const m = String(output).match(/"database_id":\s*"([^"]+)"/);
  return m ? m[1] : null;
}

/** Extract the namespace id from `wrangler kv namespace create` output. */
export function parseKvId(output) {
  const m = String(output).match(/"id":\s*"([^"]+)"/);
  return m ? m[1] : null;
}

/** Find a KV namespace id by title in `wrangler kv namespace list` output. */
export function parseKvIdFromList(output, title) {
  try {
    const m = String(output).match(/\[[\s\S]*\]/);
    if (!m) return null;
    const arr = JSON.parse(m[0]);
    const found = Array.isArray(arr) ? arr.find((x) => x && x.title === title) : null;
    return found ? found.id : null;
  } catch {
    return null;
  }
}

/** Replace the PASTE_FROM_* id markers in wrangler.jsonc with real ids (only when provided). */
export function applyResourceIds(wranglerText, ids) {
  let t = wranglerText;
  if (ids.databaseId) t = t.replace('PASTE_FROM_D1_CREATE', ids.databaseId);
  if (ids.kvId) t = t.replace('PASTE_FROM_KV_CREATE', ids.kvId);
  return t;
}
```

- [ ] **Step 5: Run → pass**

Run: `npx vitest run tests/template/provision.test.ts`
Expected: PASS (existing + 4 new).

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/provision.mjs tests/template/provision.test.ts
git commit -m "feat: provision — wrangler id parsers + applyResourceIds"
```

---

## Task 2: `provisionPlan`

**Files:** Modify `scripts/lib/provision.mjs`, `tests/template/provision.test.ts`.

- [ ] **Step 1: Add the failing test** — append:

```ts
import { provisionPlan } from '../../scripts/lib/provision.mjs';

describe('provisionPlan', () => {
  const base = validateChurchInput(valid).value;
  it('orders the steps and derives names from the slug', () => {
    const keys = provisionPlan(base).map((s) => s.key);
    expect(keys).toEqual(['d1', 'kv', 'r2', 'vectorize', 'migrate', 'seed1', 'seed2', 'seed3', 'turnstile', 'build', 'deploy']);
    const d1 = provisionPlan(base).find((s) => s.key === 'd1');
    expect(d1.cmd).toBe('npx wrangler d1 create grace-community');
    expect(d1.capture).toBe('d1Id');
    const kv = provisionPlan(base).find((s) => s.key === 'kv');
    expect(kv.cmd).toBe('npx wrangler kv namespace create grace-community-SESSION');
    expect(kv.kvTitle).toBe('grace-community-SESSION');
    expect(provisionPlan(base).find((s) => s.key === 'deploy').cmd).toBe('npx wrangler deploy');
  });
  it('omits the vectorize step when ai is off', () => {
    const off = provisionPlan({ ...base, features: { ...base.features, ai: false } });
    expect(off.some((s) => s.key === 'vectorize')).toBe(false);
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/template/provision.test.ts`
Expected: FAIL (`provisionPlan` not exported).

- [ ] **Step 3: Append `provisionPlan` to `scripts/lib/provision.mjs`**

```js
export const DEV_TURNSTILE_SECRET = '1x0000000000000000000000000000000AA';

/**
 * Ordered, feature-aware provisioning plan. Each step:
 *   { key, label, cmd, capture?: 'd1Id'|'kvId', kvTitle?, idempotent?: boolean, stdin?: string }
 * The orchestrator runs cmd via execSync; `capture` writes the parsed id back into wrangler.jsonc;
 * `idempotent` swallows an "already exists" error; `stdin` is piped to the command's stdin.
 * @param {ChurchInput} input
 */
export function provisionPlan(input) {
  const n = input.names;
  const kvTitle = `${input.slug}-SESSION`;
  const steps = [
    { key: 'd1', label: 'Create D1 database', cmd: `npx wrangler d1 create ${n.database}`, capture: 'd1Id' },
    { key: 'kv', label: 'Create KV namespace (SESSION)', cmd: `npx wrangler kv namespace create ${kvTitle}`, capture: 'kvId', kvTitle },
    { key: 'r2', label: 'Create R2 bucket', cmd: `npx wrangler r2 bucket create ${n.bucket}`, idempotent: true },
  ];
  if (input.features.ai) {
    steps.push({
      key: 'vectorize',
      label: 'Create Vectorize index',
      cmd: `npx wrangler vectorize create ${n.vectorize} --dimensions=768 --metric=cosine`,
      idempotent: true,
    });
  }
  steps.push(
    { key: 'migrate', label: 'Apply migrations (remote)', cmd: `npx wrangler d1 migrations apply ${n.database} --remote` },
    { key: 'seed1', label: 'Seed settings + ministries', cmd: `npx wrangler d1 execute ${n.database} --remote --file db/seed.sql` },
    { key: 'seed2', label: 'Seed funds', cmd: `npx wrangler d1 execute ${n.database} --remote --file db/seed_funds.sql` },
    { key: 'seed3', label: 'Seed home cards', cmd: `npx wrangler d1 execute ${n.database} --remote --file db/seed_lists.sql` },
    { key: 'turnstile', label: 'Set dev Turnstile secret', cmd: 'npx wrangler secret put TURNSTILE_SECRET_KEY', stdin: DEV_TURNSTILE_SECRET },
    { key: 'build', label: 'Build the site', cmd: 'npm run build' },
    { key: 'deploy', label: 'Deploy', cmd: 'npx wrangler deploy' },
  );
  return steps;
}
```

- [ ] **Step 4: Run → pass**

Run: `npx vitest run tests/template/provision.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/provision.mjs tests/template/provision.test.ts
git commit -m "feat: provision — provisionPlan (feature-aware command plan)"
```

---

## Task 3: The `--provision` orchestrator

**Files:** Modify `scripts/new-church.mjs`.

- [ ] **Step 1: Rewrite `scripts/new-church.mjs`** to add argv handling + the orchestrator (the dry generation is unchanged; the provision branch is new):

```js
// Provision the template for one church. Reads scripts/new-church.config.json,
// validates it, and writes the per-church files.
//   node scripts/new-church.mjs                 -> dry: write files + PROVISIONING.md
//   node scripts/new-church.mjs --provision      -> also create CF resources + deploy
//   node scripts/new-church.mjs --provision --dry-run   -> print the command plan, run nothing
//   --yes  -> skip the confirmation prompt
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import {
  validateChurchInput,
  renderChurchConfigTs,
  renderWranglerJsonc,
  retintSvg,
  buildChecklist,
  provisionPlan,
  parseD1Id,
  parseKvId,
  parseKvIdFromList,
  applyResourceIds,
} from './lib/provision.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const doProvision = args.includes('--provision');
const dryRun = args.includes('--dry-run');
const skipConfirm = args.includes('--yes');
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
writeFileSync(join(root, 'package.json'), readFileSync(join(root, 'package.json'), 'utf8').replace(/("name":\s*)"[^"]*"/, `$1"${input.slug}"`));
writeFileSync(join(root, 'astro.config.mjs'), readFileSync(join(root, 'astro.config.mjs'), 'utf8').replace(/(site:\s*)'[^']*'/, `$1'${input.url}'`));

console.log(`Generated files for "${input.name}" (${input.slug}).`);

if (!doProvision) {
  console.log('Wrote: src/config/church.ts, wrangler.jsonc, 4 placeholder SVGs, package.json name, astro.config.mjs site, PROVISIONING.md');
  console.log('Next: review the diff, commit, then follow PROVISIONING.md  (or re-run with --provision to do it automatically).');
  process.exit(0);
}

// ----- automated provisioning -----
const plan = provisionPlan(input);

if (dryRun) {
  console.log('\n[--dry-run] Would run, in order:');
  for (const s of plan) console.log(`  - ${s.label}: ${s.cmd}${s.stdin ? '   (value piped via stdin)' : ''}`);
  console.log('\nThen, manually: set up Cloudflare Access, add real keys, reindex AI (see PROVISIONING.md).');
  process.exit(0);
}

const acct = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!acct) {
  console.error('CLOUDFLARE_ACCOUNT_ID is not set. Set it to your Cloudflare account id and re-run.');
  console.error('  Find it with: npx wrangler whoami');
  process.exit(1);
}

if (!skipConfirm) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((res) =>
    rl.question(`\nThis CREATES Cloudflare resources on account ${acct} and DEPLOYS "${input.name}". Continue? [y/N] `, (a) => { rl.close(); res(a); }),
  );
  if (String(answer).trim().toLowerCase() !== 'y') {
    console.log('Aborted. (No resources were created.)');
    process.exit(0);
  }
}

const wranglerPath = join(root, 'wrangler.jsonc');
const childEnv = { ...process.env, CLOUDFLARE_ACCOUNT_ID: acct };
const writeIds = (ids) => writeFileSync(wranglerPath, applyResourceIds(readFileSync(wranglerPath, 'utf8'), ids));
const tryRun = (cmd) => {
  try {
    return execSync(cmd, { cwd: root, env: childEnv, encoding: 'utf8' });
  } catch (e) {
    return String(e.stdout ?? '') + String(e.stderr ?? '');
  }
};

for (const step of plan) {
  console.log(`\n> ${step.label}`);
  let out = '';
  try {
    out = execSync(step.cmd, { cwd: root, env: childEnv, encoding: 'utf8', input: step.stdin });
    process.stdout.write(out);
  } catch (e) {
    out = String(e.stdout ?? '') + String(e.stderr ?? '');
    if (step.capture === 'd1Id') {
      const id = parseD1Id(tryRun(`npx wrangler d1 info ${input.names.database}`));
      if (id) { writeIds({ databaseId: id }); console.log(`  (already existed — reused database_id ${id})`); continue; }
    } else if (step.capture === 'kvId') {
      const id = parseKvIdFromList(tryRun('npx wrangler kv namespace list'), step.kvTitle);
      if (id) { writeIds({ kvId: id }); console.log(`  (already existed — reused namespace id ${id})`); continue; }
    } else if (step.idempotent && /already (exists|created)/i.test(out)) {
      console.log('  (already exists — continuing)');
      continue;
    }
    console.error(`\nStep failed: ${step.label}\n${out}`);
    console.error('Fix the issue and re-run `node scripts/new-church.mjs --provision` (it is safe to re-run).');
    process.exit(1);
  }
  if (step.capture === 'd1Id') {
    const id = parseD1Id(out);
    if (id) writeIds({ databaseId: id });
  } else if (step.capture === 'kvId') {
    const id = parseKvId(out);
    if (id) writeIds({ kvId: id });
  }
}

console.log(`\nDone. "${input.name}" is deployed at ${input.url}`);
console.log('Remaining manual steps:');
console.log('  - Cloudflare Access: protect path "admin" + "api/admin" (Zero Trust -> Access).');
console.log('  - Optional real keys: Paystack, Turnstile, Resend (see PROVISIONING.md).');
console.log('  - AI search: Admin -> Sermons -> "Reindex AI search".');
```

- [ ] **Step 2: Verify the dry-run plan** (no resources created)

```bash
cp scripts/new-church.config.example.json scripts/new-church.config.json
# the example slug is the sentinel 'example-church' which is rejected — set a real slug for the preview:
node -e "const f='scripts/new-church.config.json';const c=JSON.parse(require('fs').readFileSync(f));c.slug='grace-preview';c.name='Grace Preview';require('fs').writeFileSync(f,JSON.stringify(c,null,2))"
node scripts/new-church.mjs --provision --dry-run
```
Expected: prints "Generated files…", then the `[--dry-run] Would run, in order:` list of all steps (d1 create grace-preview, kv create grace-preview-SESSION, r2, vectorize, migrate, 3 seeds, turnstile, build, deploy), then the manual-steps note. Creates NO Cloudflare resources.

- [ ] **Step 3: Revert the generated files + remove the temp config**

```bash
git checkout -- src/config/church.ts wrangler.jsonc package.json astro.config.mjs public/images
rm -f PROVISIONING.md scripts/new-church.config.json
git status --short
```
Expected: clean (only the committed Task 1–2 changes remain; the runner change is staged next).

- [ ] **Step 4: Commit**

```bash
git add scripts/new-church.mjs
git commit -m "feat: new-church.mjs --provision (auto create resources + deploy) with --dry-run/--yes"
```

---

## Task 4: Docs

**Files:** Modify `scripts/lib/provision.mjs` (the `buildChecklist` intro), `README.md`.

- [ ] **Step 1: Add a fast-path note in `buildChecklist`** — in `scripts/lib/provision.mjs`, find the line `L.push('Generated by \`scripts/new-church.mjs\`. Run these from the repo root, in order.');` and insert after it:

```js
  L.push('');
  L.push('> **Fast path:** run `node scripts/new-church.mjs --provision` (with `CLOUDFLARE_ACCOUNT_ID` set)');
  L.push('> to do steps 1–5 automatically. Preview first with `--provision --dry-run`.');
```

- [ ] **Step 2: Add the fast-path to the README** — in `README.md`, under the "Spin up a new church" section, after the `node scripts/new-church.mjs` step, add:

```markdown
> **One-command path:** with `CLOUDFLARE_ACCOUNT_ID` set and `wrangler` logged in, run
> `node scripts/new-church.mjs --provision` to also create the Cloudflare resources, migrate + seed,
> and deploy automatically — leaving only Cloudflare Access + optional keys. Preview it first with
> `node scripts/new-church.mjs --provision --dry-run`.
```

- [ ] **Step 3: Verify the checklist note renders** (regenerate a sample PROVISIONING.md via dry-run, check the note, revert)

```bash
cp scripts/new-church.config.example.json scripts/new-church.config.json
node -e "const f='scripts/new-church.config.json';const c=JSON.parse(require('fs').readFileSync(f));c.slug='grace-preview';require('fs').writeFileSync(f,JSON.stringify(c,null,2))"
node scripts/new-church.mjs >/dev/null
grep -c "Fast path" PROVISIONING.md
git checkout -- src/config/church.ts wrangler.jsonc package.json astro.config.mjs public/images
rm -f PROVISIONING.md scripts/new-church.config.json
```
Expected: `grep -c "Fast path"` prints `1`.

- [ ] **Step 4: Commit**

```bash
git add scripts/lib/provision.mjs README.md
git commit -m "docs: note the --provision fast path in PROVISIONING.md + README"
```

---

## Task 5: Final gate

- [ ] **Step 1: Full suite**

Run: `npx vitest run`
Expected: PASS — prior 234 + new (4 parser + 2 plan) = 240, all green.

- [ ] **Step 2: Build**

Run: `npx astro build`
Expected: `Complete!`.

- [ ] **Step 3: Clean tree**

Run: `git status --short`
Expected: empty.

---

## Task 6: Finish

- [ ] **Step 1:** Announce: "I'm using the finishing-a-development-branch skill to complete this work."
- [ ] **Step 2:** REQUIRED SUB-SKILL: superpowers:finishing-a-development-branch → merge `feat/T5-auto-provision` → `main`. (Template tooling — not deployed to Kharis; the `kharis` branch picks it up on the next `merge main`.)

---

## Definition of Done
- `node scripts/new-church.mjs` unchanged (dry); `--provision --dry-run` prints the full feature-aware plan, creating nothing; `--provision` creates resources + writes IDs + migrates + seeds + sets dev Turnstile + builds + deploys; missing `CLOUDFLARE_ACCOUNT_ID` → clear error; confirms unless `--yes`; idempotent on re-run.
- `npx vitest run` green (~240); `npx astro build` passes; clean tree.
- README + generated `PROVISIONING.md` mention the fast path.
- Merges to `main`.

**Next:** roadmap D3 (small-group finder).
```
