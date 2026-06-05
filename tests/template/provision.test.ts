import { describe, it, expect } from 'vitest';
import {
  validateChurchInput,
  deriveNames,
  renderChurchConfigTs,
  renderWranglerJsonc,
  retintSvg,
  buildChecklist,
} from '../../scripts/lib/provision.mjs';

// Strip // line comments so the JSONC body can be JSON.parsed.
function parseJsonc(text: string) {
  return JSON.parse(text.replace(/^\s*\/\/.*$/gm, ''));
}

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
  features: { sermons: true, events: true, ministries: true, giving: true, ai: true, live: true, community: true },
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

describe('renderChurchConfigTs', () => {
  const out = renderChurchConfigTs(validateChurchInput(valid).value);
  it('emits a valid CHURCH literal with the church identity', () => {
    expect(out).toContain('export const CHURCH: ChurchConfig = {');
    expect(out).toContain('name: "Grace Community Church"');
    expect(out).toContain('currency: "USD"');
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

describe('renderWranglerJsonc', () => {
  const out = renderWranglerJsonc(deriveNames('grace-community'));
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

describe('retintSvg', () => {
  const theme = { primary: '#112233', accent: '#445566', dark: '#778899', surface: '#ffffff' };
  it('renders four valid SVGs that carry the new colours, not the generic ones', () => {
    for (const key of ['wide', 'portrait', 'card', 'logo'] as const) {
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
