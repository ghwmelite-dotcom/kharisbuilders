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

  it('falls back to DEV_ADMIN_EMAIL when no header (local dev)', () => {
    expect(getAdminEmail(req(), { DEV_ADMIN_EMAIL: 'dev@local' })).toBe('dev@local');
  });

  it('returns null when neither is present', () => {
    expect(getAdminEmail(req(), {})).toBeNull();
  });

  it('prefers the Access header over the dev fallback', () => {
    const r = req({ 'cf-access-authenticated-user-email': 'real@church.org' });
    expect(getAdminEmail(r, { DEV_ADMIN_EMAIL: 'dev@local' })).toBe('real@church.org');
  });
});
