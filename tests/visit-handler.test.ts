import { describe, it, expect, beforeAll, afterAll, vi, afterEach } from 'vitest';
import { createTestDb, type TestDb } from './helpers/d1';
import { handleVisit } from '../src/lib/visit-handler';

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

describe('handleVisit', () => {
  it('rejects invalid input with 400 (no DB write)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: true }))));
    const res = await handleVisit(env(), fd({ name: '', email: 'bad', 'cf-turnstile-response': 't' }));
    expect(res.status).toBe(400);
  });

  it('rejects when Turnstile fails with 400', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: false }))));
    const res = await handleVisit(env(), fd({ name: 'Jane', email: 'jane@x.org', 'cf-turnstile-response': 't' }));
    expect(res.status).toBe(400);
  });

  it('inserts and redirects on success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: true }))));
    const res = await handleVisit(
      env(),
      fd({ name: 'Jane', email: 'jane@x.org', visiting_service: 'Sunday 09:00 AM', 'cf-turnstile-response': 't' }),
    );
    expect(res.status).toBe(303);
    expect(res.redirect).toBe('/visit?submitted=1');
    const row = await ctx.db.prepare("SELECT name FROM visitors WHERE email = 'jane@x.org'").first<{ name: string }>();
    expect(row?.name).toBe('Jane');
  });
});
