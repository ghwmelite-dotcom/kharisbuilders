import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { contentHash } from '../../src/lib/ai/hash';

describe('contentHash', () => {
  it('matches node sha-256 and changes with content', async () => {
    const oracle = createHash('sha256').update('hello').digest('hex');
    expect(await contentHash('hello')).toBe(oracle);
    expect(await contentHash('hello')).not.toBe(await contentHash('hello!'));
  });
});
