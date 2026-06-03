import { describe, it, expect } from 'vitest';
import { slugify, uniqueSlug } from '../src/lib/slug';

describe('slugify', () => {
  it('lowercases, trims, and hyphenates', () => {
    expect(slugify('  The Architecture of Faith: Part IV ')).toBe('the-architecture-of-faith-part-iv');
  });
  it('strips punctuation and collapses separators', () => {
    expect(slugify('Grace & Truth!!  Now')).toBe('grace-truth-now');
  });
  it('falls back to "item" for empty input', () => {
    expect(slugify('—')).toBe('item');
  });
});

describe('uniqueSlug', () => {
  it('returns the base when free, else appends -2, -3, ...', async () => {
    const existing = new Set(['gala', 'gala-2']);
    const check = async (s: string) => existing.has(s);
    expect(await uniqueSlug(check, 'gala')).toBe('gala-3');
    expect(await uniqueSlug(check, 'new')).toBe('new');
  });
});
