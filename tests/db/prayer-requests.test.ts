import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import {
  createPrayerRequest,
  listPublicPrayers,
  incrementPrayCount,
  setPrayerStatus,
  deletePrayerRequest,
  listPrayerRequests,
} from '../../src/lib/db/prayer-requests';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
  // 1: public, will be approved | 2: public, stays new | 3: private | 4: public, hidden
  await createPrayerRequest(ctx.db, { name: 'Ada', email: 'a@x.com', request: 'Public one', is_private: false });
  await createPrayerRequest(ctx.db, { name: '', email: '', request: 'Awaiting', is_private: false });
  await createPrayerRequest(ctx.db, { name: 'Priv', email: 'p@x.com', request: 'Private one', is_private: true });
  await createPrayerRequest(ctx.db, { name: 'Hid', email: '', request: 'Hidden one', is_private: false });
  await setPrayerStatus(ctx.db, 1, 'approved');
  await setPrayerStatus(ctx.db, 4, 'hidden');
});
afterAll(async () => {
  await ctx.dispose();
});

describe('listPublicPrayers', () => {
  it('returns only approved public rows, without email', async () => {
    const rows = await listPublicPrayers(ctx.db);
    expect(rows.map((r) => r.request)).toEqual(['Public one']);
    expect(rows[0]).not.toHaveProperty('email');
    expect(rows[0].pray_count).toBe(0);
  });
});

describe('incrementPrayCount', () => {
  it('bumps an approved-public row and returns the new count', async () => {
    expect(await incrementPrayCount(ctx.db, 1)).toBe(1);
    expect(await incrementPrayCount(ctx.db, 1)).toBe(2);
  });
  it('is a no-op (returns 0) for private or unapproved rows', async () => {
    expect(await incrementPrayCount(ctx.db, 2)).toBe(0); // new, not approved
    expect(await incrementPrayCount(ctx.db, 3)).toBe(0); // private
    expect(await incrementPrayCount(ctx.db, 999)).toBe(0); // missing
  });
});

describe('moderation', () => {
  it('setPrayerStatus + delete work; admin list includes pray_count', async () => {
    const all = await listPrayerRequests(ctx.db);
    expect(all.find((r) => r.id === 1)?.pray_count).toBe(2);
    await deletePrayerRequest(ctx.db, 2);
    expect((await listPrayerRequests(ctx.db)).some((r) => r.id === 2)).toBe(false);
  });
});
