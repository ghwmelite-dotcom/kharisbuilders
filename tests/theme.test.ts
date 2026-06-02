import { describe, it, expect } from 'vitest';
import { resolveTheme, THEMES, DEFAULT_THEME } from '../src/lib/theme';

describe('resolveTheme', () => {
  it('returns a valid theme unchanged', () => {
    expect(resolveTheme('purple')).toBe('purple');
    expect(resolveTheme('sacred')).toBe('sacred');
  });

  it('falls back to the default for unknown values', () => {
    expect(resolveTheme('nonsense')).toBe(DEFAULT_THEME);
    expect(resolveTheme(undefined)).toBe(DEFAULT_THEME);
    expect(resolveTheme(null)).toBe(DEFAULT_THEME);
  });

  it('exposes exactly the two supported themes', () => {
    expect(THEMES).toEqual(['sacred', 'purple']);
  });
});
