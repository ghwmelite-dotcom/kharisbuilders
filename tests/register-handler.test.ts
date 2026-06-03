import { describe, it, expect, beforeAll, afterAll, vi, afterEach } from 'vitest';
import { createTestDb, type TestDb } from './helpers/d1';
import { handleRegister } from '../src/lib/register-handler';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
  await ctx.db.batch([
    ctx.db.prepare(
      "INSERT INTO events (id, title, slug, start_at, published, registration_enabled, capacity) VALUES (1, 'Gala', 'gala', '2999-01-01 10:00:00', 1, 1, 3)",
    ),
    ctx.db.prepare(
      "INSERT INTO events (id, title, slug, start_at, published, registration_enabled, capacity) VALUES (2, 'Closed', 'closed', '2999-01-01 10:00:00', 1, 0, NULL)",
    ),
  ]);
});
afterAll(async () => {
  await ctx.dispose();
});
afterEach(() => vi.restoreAllMocks());

const pass = () => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: true }))));
function env() {
  return { DB: ctx.db, TURNSTILE_SECRET_KEY: 'secret' };
}
function fd(f: Record<string, string>) {
  const x = new FormData();
  for (const [k, v] of Object.entries(f)) x.append(k, v);
  return x;
}

describe('handleRegister', () => {
  it('400 on invalid input', async () => {
    pass();
    expect(
      (await handleRegister(env(), fd({ event_id: '1', name: '', email: 'bad', 'cf-turnstile-response': 't' }))).status,
    ).toBe(400);
  });

  it('400 when registration is disabled', async () => {
    pass();
    expect(
      (await handleRegister(env(), fd({ event_id: '2', name: 'A', email: 'a@x.org', 'cf-turnstile-response': 't' })))
        .status,
    ).toBe(400);
  });

  it('400 when Turnstile fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: false }))));
    expect(
      (await handleRegister(env(), fd({ event_id: '1', name: 'A', email: 'a@x.org', 'cf-turnstile-response': 't' })))
        .status,
    ).toBe(400);
  });

  it('303 + redirect on success and inserts the registration', async () => {
    pass();
    const res = await handleRegister(
      env(),
      fd({ event_id: '1', name: 'Ada', email: 'ada@x.org', guests: '1', 'cf-turnstile-response': 't' }),
    );
    expect(res.status).toBe(303);
    expect(res.redirect).toBe('/events/gala?registered=1');
    const row = await ctx.db.prepare("SELECT name FROM event_registrations WHERE email='ada@x.org'").first<{ name: string }>();
    expect(row?.name).toBe('Ada');
  });

  it('409 + full redirect when capacity is exceeded', async () => {
    pass();
    // event 1 capacity 3; 2 seats taken (Ada + 1 guest). Requesting 2 more (self + 1 guest) -> 4 > 3.
    const res = await handleRegister(
      env(),
      fd({ event_id: '1', name: 'Bob', email: 'bob@x.org', guests: '1', 'cf-turnstile-response': 't' }),
    );
    expect(res.status).toBe(409);
    expect(res.redirect).toBe('/events/gala?full=1');
  });
});
