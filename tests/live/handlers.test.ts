import { describe, it, expect, beforeAll, afterAll, vi, afterEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { handleOnlineConnect } from '../../src/lib/live/online-connect-handler';
import { handlePrayer } from '../../src/lib/live/prayer-handler';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.dispose();
});
afterEach(() => vi.restoreAllMocks());

function env() {
  return { DB: ctx.db, TURNSTILE_SECRET_KEY: 'secret' };
}
function fd(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}
const pass = () => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: true }))));
const fail = () => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: false }))));

describe('handleOnlineConnect', () => {
  it('rejects invalid input (no DB write)', async () => {
    pass();
    const res = await handleOnlineConnect(env(), fd({ name: '', email: 'bad', 'cf-turnstile-response': 't' }));
    expect(res.redirect).toBe('/live?connect=err');
  });
  it('rejects when Turnstile fails', async () => {
    fail();
    const res = await handleOnlineConnect(env(), fd({ name: 'A', email: 'a@x.com', 'cf-turnstile-response': 't' }));
    expect(res.redirect).toBe('/live?connect=err');
  });
  it('inserts + redirects ok', async () => {
    pass();
    const res = await handleOnlineConnect(env(), fd({ name: 'Bea', email: 'bea@x.com', location: 'Kumasi', 'cf-turnstile-response': 't' }));
    expect(res.status).toBe(303);
    expect(res.redirect).toBe('/live?connect=ok');
    const row = await ctx.db.prepare("SELECT location FROM online_attendances WHERE email='bea@x.com'").first<{ location: string }>();
    expect(row?.location).toBe('Kumasi');
  });
});

describe('handlePrayer', () => {
  it('rejects empty request', async () => {
    pass();
    const res = await handlePrayer(env(), fd({ request: '', 'cf-turnstile-response': 't' }));
    expect(res.redirect).toBe('/live?prayer=err');
  });
  it('inserts + redirects ok', async () => {
    pass();
    const res = await handlePrayer(env(), fd({ name: 'C', request: 'Healing please', 'cf-turnstile-response': 't' }));
    expect(res.status).toBe(303);
    expect(res.redirect).toBe('/live?prayer=ok');
    const row = await ctx.db.prepare("SELECT request FROM prayer_requests WHERE name='C'").first<{ request: string }>();
    expect(row?.request).toBe('Healing please');
  });
});
