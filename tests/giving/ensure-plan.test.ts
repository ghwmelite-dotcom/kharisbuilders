import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { getPlanByKey } from '../../src/lib/db/plans';
import { ensurePlan } from '../../src/lib/giving/ensure-plan';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.dispose();
});

function planFetch() {
  return vi.fn(
    async () => new Response(JSON.stringify({ status: true, data: { plan_code: 'PLN_new' } }), { status: 200 }),
  ) as unknown as typeof fetch & { mock: { calls: unknown[] } };
}

describe('ensurePlan', () => {
  it('creates a Paystack plan on cache miss, then caches it', async () => {
    const fetchFn = planFetch();
    const res = await ensurePlan(ctx.db, { amount: 10000, interval: 'monthly', currency: 'GHS' }, { secret: 'sk', fetchFn });
    expect(res.ok && res.planCode).toBe('PLN_new');
    expect((fetchFn as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(1);
    expect((await getPlanByKey(ctx.db, 10000, 'monthly', 'GHS'))?.plan_code).toBe('PLN_new');
  });

  it('returns the cached plan without calling Paystack on a hit', async () => {
    const fetchFn = planFetch();
    const res = await ensurePlan(ctx.db, { amount: 10000, interval: 'monthly', currency: 'GHS' }, { secret: 'sk', fetchFn });
    expect(res.ok && res.planCode).toBe('PLN_new');
    expect((fetchFn as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(0); // cache hit, no network
  });
});
