// Provision the template for one church. Reads scripts/new-church.config.json,
// validates it, and writes the per-church files.
//   node scripts/new-church.mjs                          -> dry: write files + PROVISIONING.md
//   node scripts/new-church.mjs --provision               -> also create CF resources + deploy
//   node scripts/new-church.mjs --provision --dry-run     -> print the command plan, run nothing
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
  ['wrangler.jsonc', renderWranglerJsonc(input.names, input.customDomain)],
  ['public/images/placeholder-wide.svg', retintSvg.wide(input.theme)],
  ['public/images/placeholder-portrait.svg', retintSvg.portrait(input.theme)],
  ['public/images/placeholder-card.svg', retintSvg.card(input.theme)],
  ['public/images/logo-placeholder.svg', retintSvg.logo(input.theme)],
  ['PROVISIONING.md', buildChecklist(input)],
];
for (const [rel, content] of writes) writeFileSync(join(root, rel), content);
writeFileSync(
  join(root, 'package.json'),
  readFileSync(join(root, 'package.json'), 'utf8').replace(/("name":\s*)"[^"]*"/, `$1"${input.slug}"`),
);
writeFileSync(
  join(root, 'astro.config.mjs'),
  readFileSync(join(root, 'astro.config.mjs'), 'utf8').replace(/(site:\s*)'[^']*'/, `$1'${input.url}'`),
);

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
    rl.question(`\nThis CREATES Cloudflare resources on account ${acct} and DEPLOYS "${input.name}". Continue? [y/N] `, (a) => {
      rl.close();
      res(a);
    }),
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
      if (id) {
        writeIds({ databaseId: id });
        console.log(`  (already existed — reused database_id ${id})`);
        continue;
      }
    } else if (step.capture === 'kvId') {
      const id = parseKvIdFromList(tryRun('npx wrangler kv namespace list'), step.kvTitle);
      if (id) {
        writeIds({ kvId: id });
        console.log(`  (already existed — reused namespace id ${id})`);
        continue;
      }
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
