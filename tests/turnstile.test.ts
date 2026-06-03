import { describe, it, expect, vi, afterEach } from 'vitest';
import { verifyTurnstile } from '../src/lib/turnstile';

afterEach(() => vi.restoreAllMocks());

describe('verifyTurnstile', () => {
  it('returns true when siteverify succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: true }))));
    expect(await verifyTurnstile('secret', 'token')).toBe(true);
  });

  it('returns false when siteverify fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ success: false, 'error-codes': ['invalid-input-response'] }))),
    );
    expect(await verifyTurnstile('secret', 'token')).toBe(false);
  });

  it('returns false when the token is empty (no network call)', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    expect(await verifyTurnstile('secret', '')).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  it('returns false when fetch throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network');
      }),
    );
    expect(await verifyTurnstile('secret', 'token')).toBe(false);
  });
});
