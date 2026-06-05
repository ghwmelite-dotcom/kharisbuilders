import { describe, it, expect } from 'vitest';
import { CHURCH, feature } from '../../src/config/church';

describe('church config', () => {
  it('has identity, theme (4 hex), currency, tz, motifs, and 7 features', () => {
    expect(CHURCH.name.length).toBeGreaterThan(0);
    for (const k of ['primary', 'accent', 'dark', 'surface'] as const) {
      expect(CHURCH.theme[k]).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
    expect(typeof CHURCH.currency).toBe('string');
    expect(typeof CHURCH.timezoneOffsetMin).toBe('number');
    expect(typeof CHURCH.motifs).toBe('boolean');
    expect(Object.keys(CHURCH.features).sort()).toEqual(['ai', 'community', 'events', 'giving', 'live', 'ministries', 'sermons']);
  });
  it('feature() reads the flags', () => {
    expect(feature('giving')).toBe(CHURCH.features.giving);
  });
});
