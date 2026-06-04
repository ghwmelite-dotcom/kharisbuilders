import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { PLACEHOLDER } from '../../src/lib/images';

describe('placeholder assets', () => {
  it('exposes the four placeholder paths', () => {
    expect(PLACEHOLDER.wide).toBe('/images/placeholder-wide.svg');
    expect(PLACEHOLDER.portrait).toBe('/images/placeholder-portrait.svg');
    expect(PLACEHOLDER.card).toBe('/images/placeholder-card.svg');
    expect(PLACEHOLDER.logo).toBe('/images/logo-placeholder.svg');
  });
  it('each placeholder file exists and is valid SVG', () => {
    for (const p of Object.values(PLACEHOLDER)) {
      const file = `public${p}`;
      expect(existsSync(file)).toBe(true);
      expect(readFileSync(file, 'utf8').trimStart().startsWith('<svg')).toBe(true);
    }
  });
});
