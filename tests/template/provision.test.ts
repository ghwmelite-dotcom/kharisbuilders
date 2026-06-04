import { describe, it, expect } from 'vitest';
import { validateChurchInput, deriveNames } from '../../scripts/lib/provision.mjs';

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
  features: { sermons: true, events: true, ministries: true, giving: true, ai: true, live: true },
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
