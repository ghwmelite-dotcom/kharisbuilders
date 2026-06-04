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
