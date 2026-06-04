import { describe, it, expect } from 'vitest';
import { contentDefaults } from '../../src/lib/content/fields';

describe('content defaults (generic template)', () => {
  const defaults = contentDefaults();
  it('every default is a non-empty string', () => {
    for (const [k, v] of Object.entries(defaults)) {
      expect(typeof v, k).toBe('string');
      expect(v.length, k).toBeGreaterThan(0);
    }
  });
  it('contains no Kharis-specific tokens', () => {
    const banned = /Kharis|Building Lives|Shaping Destinies|Glass Atrium|Anderson|Architects of Faith/i;
    for (const [k, v] of Object.entries(defaults)) {
      expect(banned.test(v), `${k} = "${v}"`).toBe(false);
    }
  });
  it('image defaults point at placeholder SVGs', () => {
    for (const [k, v] of Object.entries(defaults)) {
      if (k.endsWith('_image') || k.endsWith('_hero')) {
        expect(v.endsWith('.svg'), `${k} = "${v}"`).toBe(true);
      }
    }
  });
});
