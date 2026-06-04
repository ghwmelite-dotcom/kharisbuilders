import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Guards the TEMPLATE against re-introducing Kharis's LIVE deploy identifiers, which would
// make a fresh clone connect to Kharis's real D1/R2/KV on `npm run dev`/deploy. Kharis deploys
// from the `kharis` branch, so these must never appear in the template's deploy config.
// (Only checks identifiers unique to Kharis's live resources — so it stays green for any
// church that provisions its own clone via scripts/new-church.mjs.)
const KHARIS_LIVE = [
  'kharisbuilders', // worker name / D1 name / R2 prefix / email domain
  'missdiasporagh', // Kharis Cloudflare account subdomain
  'kharis-sermons', // Kharis Vectorize index
  '1f3056ca-a44d-4a63-bfbf-c38ba9fb957b', // Kharis D1 database_id
  'e1406f2f0b334423a197928f55fd90f8', // Kharis SESSION KV id
];

const FILES = ['wrangler.jsonc', 'package.json', 'astro.config.mjs', 'src/lib/notify.ts', '.dev.vars.example'];

describe('template deploy config is Kharis-free', () => {
  for (const file of FILES) {
    it(`${file} carries no Kharis live identifiers`, () => {
      const text = readFileSync(file, 'utf8');
      for (const id of KHARIS_LIVE) expect(text, `${file} contains "${id}"`).not.toContain(id);
    });
  }
});
