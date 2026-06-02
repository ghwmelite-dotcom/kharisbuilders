import { describe, it, expect } from 'vitest';
import { getBindings } from '../src/lib/env';

describe('getBindings', () => {
  it('returns the runtime env from Astro locals', () => {
    const fakeEnv = { DB: {}, MEDIA: {} };
    const locals = { runtime: { env: fakeEnv } } as unknown as App.Locals;
    expect(getBindings(locals)).toBe(fakeEnv);
  });

  it('throws a clear error when runtime is missing', () => {
    const locals = {} as unknown as App.Locals;
    expect(() => getBindings(locals)).toThrow(/Cloudflare runtime/);
  });
});
