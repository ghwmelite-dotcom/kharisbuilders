import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { handlePrayer } from '../../src/lib/live/prayer-handler';
import { listPrayerRequests } from '../../src/lib/db/prayer-requests';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.dispose();
});

function form(f: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(f)) fd.append(k, v);
  return fd;
}
const okFetch = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
const env = () => ({ DB: ctx.db, TURNSTILE_SECRET_KEY: 'x' }) as unknown as Parameters<typeof handlePrayer>[0];

describe('handlePrayer', () => {
  it('redirects to the given page on success and stores the request', async () => {
    vi.stubGlobal('fetch', okFetch);
    const r = await handlePrayer(
      env(),
      form({ request: 'Pray please', visibility: 'public', 'cf-turnstile-response': 't' }),
      '1.1.1.1',
      { page: '/prayer' },
    );
    expect(r).toEqual({ status: 303, redirect: '/prayer?prayer=ok' });
    const all = await listPrayerRequests(ctx.db);
    expect(all[0].request).toBe('Pray please');
    expect(all[0].is_private).toBe(0); // visibility=public -> NOT private (despite z.coerce gotcha)
    vi.unstubAllGlobals();
  });
  it('treats anything other than visibility=public as private; defaults page to /live', async () => {
    vi.stubGlobal('fetch', okFetch);
    const r = await handlePrayer(env(), form({ request: 'Quiet one', visibility: 'private', 'cf-turnstile-response': 't' }), undefined);
    expect(r.redirect).toBe('/live?prayer=ok');
    expect((await listPrayerRequests(ctx.db))[0].is_private).toBe(1);
    vi.unstubAllGlobals();
  });
  it('redirects to <page>?prayer=err on invalid input', async () => {
    const r = await handlePrayer(env(), form({ request: '', 'cf-turnstile-response': 't' }), undefined, { page: '/prayer' });
    expect(r.redirect).toBe('/prayer?prayer=err');
  });
});
