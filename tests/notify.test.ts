import { describe, it, expect, vi, afterEach } from 'vitest';
import { notifyStaff } from '../src/lib/notify';

afterEach(() => vi.restoreAllMocks());

describe('notifyStaff', () => {
  it('is a no-op (no fetch) when no provider is configured', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    await notifyStaff({}, 'subj', 'body');
    expect(f).not.toHaveBeenCalled();
  });

  it('posts to Resend when configured, and never throws on failure', async () => {
    const f = vi.fn(async () => {
      throw new Error('boom');
    });
    vi.stubGlobal('fetch', f);
    await expect(
      notifyStaff({ RESEND_API_KEY: 'k', STAFF_EMAIL: 'staff@x.org', FROM_EMAIL: 'no-reply@x.org' }, 'subj', 'body'),
    ).resolves.toBeUndefined();
    expect(f).toHaveBeenCalledOnce();
  });
});
