import { describe, it, expect } from 'vitest';
import { CONTENT_PAGES, contentDefaults, contentKeySet, getContentPage } from '../../src/lib/content/fields';

describe('content registry', () => {
  it('every field has a namespaced key, label, and default; keys are unique', () => {
    const seen = new Set<string>();
    for (const page of CONTENT_PAGES) {
      for (const group of page.groups) {
        for (const f of group.fields) {
          expect(f.key).toMatch(/^[a-z]+\.[a-z0-9_]+$/);
          expect(f.label.length).toBeGreaterThan(0);
          expect(typeof f.default).toBe('string');
          expect(seen.has(f.key)).toBe(false);
          seen.add(f.key);
        }
      }
    }
    expect(seen.size).toBeGreaterThan(20);
  });
  it('derives defaults + allowlist consistently', () => {
    const defaults = contentDefaults();
    const keys = contentKeySet();
    expect(Object.keys(defaults).length).toBe(keys.size);
    expect(keys.has('home.hero_line1')).toBe(true);
    expect(defaults['home.hero_line1']).toBe('A Place to');
  });
  it('looks up a page by slug', () => {
    expect(getContentPage('about')?.title).toBeTruthy();
    expect(getContentPage('nope')).toBeUndefined();
  });
});
