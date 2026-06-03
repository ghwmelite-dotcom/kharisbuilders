import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { getPlanByKey, insertPlan, getPlanByCode } from '../../src/lib/db/plans';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.dispose();
});

describe('plans data access', () => {
  it('inserts and looks up by business key + code', async () => {
    const id = await insertPlan(ctx.db, {
      plan_code: 'PLN_1',
      name: 'Kharis Monthly GHS 100',
      amount: 10000,
      interval: 'monthly',
      currency: 'GHS',
    });
    expect(id).toBeGreaterThan(0);
    const byKey = await getPlanByKey(ctx.db, 10000, 'monthly', 'GHS');
    expect(byKey?.plan_code).toBe('PLN_1');
    expect((await getPlanByCode(ctx.db, 'PLN_1'))?.id).toBe(id);
    expect(await getPlanByKey(ctx.db, 999, 'monthly', 'GHS')).toBeNull();
  });
});
