import { describe, it, expect } from 'vitest';
import { makeContent } from '../../src/lib/content/content';

describe('makeContent', () => {
  it('returns the stored value when present', () => {
    const c = makeContent({ 'home.hero_line1': 'New Headline' });
    expect(c('home.hero_line1')).toBe('New Headline');
  });
  it('falls back to the registry default when missing', () => {
    const c = makeContent({});
    expect(c('home.hero_line1')).toBe('A Place to');
  });
  it('treats a blank/whitespace stored value as "use default"', () => {
    const c = makeContent({ 'home.hero_line1': '   ' });
    expect(c('home.hero_line1')).toBe('A Place to');
  });
  it('returns empty string for an unknown key', () => {
    expect(makeContent({})('home.nope')).toBe('');
  });
});
