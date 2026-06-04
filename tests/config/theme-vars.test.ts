import { describe, it, expect } from 'vitest';
import { brandVars } from '../../src/config/theme-vars';

describe('brandVars', () => {
  it('emits the four brand custom properties', () => {
    const css = brandVars({ primary: '#4a2a6b', accent: '#a87f2e', dark: '#2c1745', surface: '#faf6fe' });
    expect(css).toContain('--brand-primary: #4a2a6b');
    expect(css).toContain('--brand-accent: #a87f2e');
    expect(css).toContain('--brand-dark: #2c1745');
    expect(css).toContain('--brand-surface: #faf6fe');
  });
});
