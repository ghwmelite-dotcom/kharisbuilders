import { describe, it, expect } from 'vitest';
import { getAdminEmail } from '../src/lib/admin-auth';

function req(headers: Record<string, string> = {}) {
  return new Request('https://x/admin', { headers });
}

describe('getAdminEmail', () => {
  it('returns the Cloudflare Access email header when present', () => {
    const r = req({ 'cf-access-authenticated-user-email': 'pastor@church.org' });
    expect(getAdminEmail(r, {})).toBe('pastor@church.org');
  });

  it('falls back to DEV_ADMIN_EMAIL only in dev mode', () => {
    expect(getAdminEmail(req(), { DEV_ADMIN_EMAIL: 'dev@local' }, true)).toBe('dev@local');
  });

  it('ignores DEV_ADMIN_EMAIL when not in dev mode (production safety)', () => {
    expect(getAdminEmail(req(), { DEV_ADMIN_EMAIL: 'dev@local' }, false)).toBeNull();
  });

  it('returns null when neither is present', () => {
    expect(getAdminEmail(req(), {}, true)).toBeNull();
  });

  it('prefers the Access header over the dev fallback', () => {
    const r = req({ 'cf-access-authenticated-user-email': 'real@church.org' });
    expect(getAdminEmail(r, { DEV_ADMIN_EMAIL: 'dev@local' }, true)).toBe('real@church.org');
  });
});
