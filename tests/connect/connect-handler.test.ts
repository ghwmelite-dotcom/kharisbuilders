import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { handleConnect } from '../../src/lib/connect/connect-handler';
import { listConnections } from '../../src/lib/db/connections';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.dispose();
});

function form(fields: Record<string, string>, steps: string[] = []): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  for (const s of steps) fd.append('steps', s);
  return fd;
}
const okFetch = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
const env = () => ({ DB: ctx.db, TURNSTILE_SECRET_KEY: 'x' }) as unknown as Parameters<typeof handleConnect>[0];

describe('handleConnect', () => {
  it('stores a connection with the chosen steps and redirects ok', async () => {
    vi.stubGlobal('fetch', okFetch);
    const r = await handleConnect(env(), form({ name: 'Ada', email: 'a@x.com', 'cf-turnstile-response': 't' }, ['serve', 'group']), '1.1.1.1');
    expect(r).toEqual({ status: 303, redirect: '/connect?connect=ok' });
    const rows = await listConnections(ctx.db);
    expect(rows[0].steps).toEqual(['serve', 'group']);
    vi.unstubAllGlobals();
  });
  it('drops unknown step keys', async () => {
    vi.stubGlobal('fetch', okFetch);
    await handleConnect(env(), form({ name: 'Bo', email: 'b@x.com', 'cf-turnstile-response': 't' }, ['serve', 'hacker']), undefined);
    expect((await listConnections(ctx.db))[0].steps).toEqual(['serve']);
    vi.unstubAllGlobals();
  });
  it('rejects an empty submission (no steps, no message) without storing', async () => {
    const before = (await listConnections(ctx.db)).length;
    const r = await handleConnect(env(), form({ name: 'Cy', email: 'c@x.com', 'cf-turnstile-response': 't' }, []), undefined);
    expect(r.redirect).toBe('/connect?connect=err');
    expect((await listConnections(ctx.db)).length).toBe(before);
  });
  it('accepts a message-only submission', async () => {
    vi.stubGlobal('fetch', okFetch);
    const r = await handleConnect(env(), form({ name: 'Di', email: 'd@x.com', message: 'Hello!', 'cf-turnstile-response': 't' }, []), undefined);
    expect(r.redirect).toBe('/connect?connect=ok');
    vi.unstubAllGlobals();
  });
});
