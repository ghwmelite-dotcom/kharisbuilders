import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { handleVolunteerSignup } from '../../src/lib/community/volunteer-handler';
import { createRole } from '../../src/lib/db/volunteer-roles';
import { listVolunteerSignups } from '../../src/lib/db/volunteer-signups';

let ctx: TestDb;
let pubId: number;
let draftId: number;
beforeAll(async () => {
  ctx = await createTestDb();
  pubId = await createRole(
    ctx.db,
    { name: 'Open Role', description: '', area: 'kids', commitment: 'weekly', schedule: '', requirements: '', leader: '', sort_order: 0, published: true },
    'a@x',
  );
  draftId = await createRole(
    ctx.db,
    { name: 'Hidden', description: '', area: 'kids', commitment: 'weekly', schedule: '', requirements: '', leader: '', sort_order: 0, published: false },
    'a@x',
  );
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
const env = () => ({ DB: ctx.db, TURNSTILE_SECRET_KEY: 'x' }) as unknown as Parameters<typeof handleVolunteerSignup>[0];

describe('handleVolunteerSignup', () => {
  it('captures a signup for a published role with the snapshot name', async () => {
    vi.stubGlobal('fetch', okFetch);
    const r = await handleVolunteerSignup(
      env(),
      form({ role_id: String(pubId), name: 'Ada', email: 'a@x.com', phone: '0800', 'cf-turnstile-response': 't' }),
      '1.1.1.1',
    );
    expect(r).toEqual({ status: 303, redirect: '/serve?signup=ok' });
    const rows = await listVolunteerSignups(ctx.db);
    expect(rows[0].role_name).toBe('Open Role');
    expect(rows[0].phone).toBe('0800');
    vi.unstubAllGlobals();
  });
  it('rejects a missing or unpublished role without storing', async () => {
    const before = (await listVolunteerSignups(ctx.db)).length;
    const r1 = await handleVolunteerSignup(env(), form({ role_id: '99999', name: 'X', email: 'x@x.com', 'cf-turnstile-response': 't' }), undefined);
    const r2 = await handleVolunteerSignup(env(), form({ role_id: String(draftId), name: 'X', email: 'x@x.com', 'cf-turnstile-response': 't' }), undefined);
    expect(r1.redirect).toBe('/serve?signup=err');
    expect(r2.redirect).toBe('/serve?signup=err');
    expect((await listVolunteerSignups(ctx.db)).length).toBe(before);
  });
});
