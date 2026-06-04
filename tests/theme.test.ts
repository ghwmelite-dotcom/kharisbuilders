import { describe, it, expect } from 'vitest';
import { resolveTheme, THEMES, DEFAULT_THEME } from '../src/lib/theme';

describe('resolveTheme', () => {
  it('returns a valid theme unchanged', () => {
    expect(resolveTheme('purple')).toBe('purple');
  });

  it('falls back to the default for unknown values', () => {
    expect(resolveTheme('sacred')).toBe(DEFAULT_THEME); // retired theme
    expect(resolveTheme('nonsense')).toBe(DEFAULT_THEME);
    expect(resolveTheme(undefined)).toBe(DEFAULT_THEME);
    expect(resolveTheme(null)).toBe(DEFAULT_THEME);
  });

  it('exposes exactly the one brand theme', () => {
    expect(THEMES).toEqual(['purple']);
  });
});
