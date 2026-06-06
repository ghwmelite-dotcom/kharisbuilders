import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { handleGroupInterest } from '../../src/lib/community/group-interest-handler';
import { createGroup } from '../../src/lib/db/groups';
import { listGroupInterests } from '../../src/lib/db/group-interests';

let ctx: TestDb;
let pubId: number;
let draftId: number;
beforeAll(async () => {
  ctx = await createTestDb();
  pubId = await createGroup(
    ctx.db,
    { name: 'Open Group', description: '', day: 'Tuesday', time: '', location: '', format: 'in_person', audience: 'everyone', leader: '', sort_order: 0, published: true },
    'a@x',
  );
  draftId = await createGroup(
    ctx.db,
    { name: 'Hidden', description: '', day: '', time: '', location: '', format: 'in_person', audience: 'everyone', leader: '', sort_order: 0, published: false },
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
const env = () => ({ DB: ctx.db, TURNSTILE_SECRET_KEY: 'x' }) as unknown as Parameters<typeof handleGroupInterest>[0];

describe('handleGroupInterest', () => {
  it('captures interest in a published group with the snapshot name', async () => {
    vi.stubGlobal('fetch', okFetch);
    const r = await handleGroupInterest(
      env(),
      form({ group_id: String(pubId), name: 'Ada', email: 'a@x.com', 'cf-turnstile-response': 't' }),
      '1.1.1.1',
    );
    expect(r).toEqual({ status: 303, redirect: '/groups?interest=ok' });
    const rows = await listGroupInterests(ctx.db);
    expect(rows[0].group_name).toBe('Open Group');
    vi.unstubAllGlobals();
  });
  it('rejects a missing or unpublished group without storing', async () => {
    const before = (await listGroupInterests(ctx.db)).length;
    const r1 = await handleGroupInterest(env(), form({ group_id: '99999', name: 'X', email: 'x@x.com', 'cf-turnstile-response': 't' }), undefined);
    const r2 = await handleGroupInterest(env(), form({ group_id: String(draftId), name: 'X', email: 'x@x.com', 'cf-turnstile-response': 't' }), undefined);
    expect(r1.redirect).toBe('/groups?interest=err');
    expect(r2.redirect).toBe('/groups?interest=err');
    expect((await listGroupInterests(ctx.db)).length).toBe(before);
  });
});
