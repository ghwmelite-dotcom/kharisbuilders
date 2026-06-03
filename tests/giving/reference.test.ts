import { describe, it, expect } from 'vitest';
import { makeReference } from '../../src/lib/giving/reference';

describe('makeReference', () => {
  it('produces a kb_-prefixed 24-hex-char reference', () => {
    expect(makeReference()).toMatch(/^kb_[0-9a-f]{24}$/);
  });
  it('is unique across many calls', () => {
    const set = new Set(Array.from({ length: 2000 }, () => makeReference()));
    expect(set.size).toBe(2000);
  });
});
