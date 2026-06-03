import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import {
  createFund,
  updateFund,
  deleteFund,
  setFundActive,
  listActiveFunds,
  listAllFunds,
  getFundById,
} from '../../src/lib/db/funds';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.dispose();
});

const base = { name: 'Building Fund', slug: '', description: 'For the building', sort_order: 2, active: true };

describe('funds data access', () => {
  it('creates with unique slug + records updated_by', async () => {
    const id1 = await createFund(ctx.db, base, 'a@x');
    const id2 = await createFund(ctx.db, { ...base }, 'a@x'); // slug collision
    expect((await getFundById(ctx.db, id1))?.slug).toBe('building-fund');
    expect((await getFundById(ctx.db, id2))?.slug).toBe('building-fund-2');
  });
  it('lists active vs all and respects sort_order', async () => {
    const hidden = await createFund(ctx.db, { ...base, name: 'Hidden', active: false }, 'a@x');
    const active = await listActiveFunds(ctx.db);
    const all = await listAllFunds(ctx.db);
    expect(active.find((f) => f.id === hidden)).toBeUndefined();
    expect(all.find((f) => f.id === hidden)).toBeDefined();
  });
  it('updates, toggles active, and deletes', async () => {
    const id = await createFund(ctx.db, { ...base, name: 'Temp', slug: 'temp' }, 'a@x');
    await updateFund(ctx.db, id, { ...base, name: 'Temp Renamed', slug: 'temp' }, 'b@x');
    expect((await getFundById(ctx.db, id))?.name).toBe('Temp Renamed');
    await setFundActive(ctx.db, id, false);
    expect((await getFundById(ctx.db, id))?.active).toBe(0);
    await deleteFund(ctx.db, id);
    expect(await getFundById(ctx.db, id)).toBeNull();
  });
});
