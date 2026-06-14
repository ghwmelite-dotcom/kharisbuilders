import { describe, it, expect } from 'vitest';
import { nextIndex } from '../../src/lib/slider';

describe('nextIndex', () => {
  it('advances by one', () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(1, 3)).toBe(2);
  });
  it('wraps around at the end', () => {
    expect(nextIndex(2, 3)).toBe(0);
  });
  it('returns 0 when there are no slides', () => {
    expect(nextIndex(0, 0)).toBe(0);
  });
});
