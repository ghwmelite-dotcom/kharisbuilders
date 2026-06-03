import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { createFund } from '../../src/lib/db/funds';
import {
  createPendingSubscription,
  activateSubscription,
  getSubscriptionByCode,
  getActiveSubscriptionForCharge,
  setSubscriptionStatus,
  listSubscriptions,
} from '../../src/lib/db/subscriptions';

let ctx: TestDb;
let fundId: number;
beforeAll(async () => {
  ctx = await createTestDb();
  fundId = await createFund(
    ctx.db,
    { name: 'General', slug: 'general', description: '', sort_order: 1, active: true },
    'a@x',
  );
});
afterAll(async () => {
  await ctx.dispose();
});

describe('subscriptions data access', () => {
  let pendingId: number;
  it('creates pending, activates by (email, plan_code), and looks up', async () => {
    pendingId = await createPendingSubscription(ctx.db, {
      local_ref: 'kb_sub_1',
      customer_email: 'g@x.com',
      plan_id: null,
      plan_code: 'PLN_A',
      amount: 10000,
      interval: 'monthly',
      fund_id: fundId,
    });
    expect(pendingId).toBeGreaterThan(0);

    await activateSubscription(ctx.db, {
      customerEmail: 'g@x.com',
      planCode: 'PLN_A',
      subscriptionCode: 'SUB_A',
      emailToken: 'tok',
      customerCode: 'CUS_A',
      nextPaymentAt: '2026-07-03 00:00:00',
    });
    const sub = await getSubscriptionByCode(ctx.db, 'SUB_A');
    expect(sub?.status).toBe('active');
    expect(sub?.email_token).toBe('tok');
    expect(sub?.fund_id).toBe(fundId);

    const forCharge = await getActiveSubscriptionForCharge(ctx.db, { customerEmail: 'g@x.com', planCode: 'PLN_A' });
    expect(forCharge?.id).toBe(pendingId);
  });

  it('activate with no pending row inserts an unattributed active subscription', async () => {
    await activateSubscription(ctx.db, {
      customerEmail: 'h@x.com',
      planCode: 'PLN_Z',
      subscriptionCode: 'SUB_Z',
      emailToken: 't2',
      customerCode: 'CUS_Z',
      nextPaymentAt: null,
    });
    const sub = await getSubscriptionByCode(ctx.db, 'SUB_Z');
    expect(sub?.status).toBe('active');
    expect(sub?.fund_id).toBeNull();
  });

  it('activate is idempotent for the same code', async () => {
    await activateSubscription(ctx.db, {
      customerEmail: 'h@x.com',
      planCode: 'PLN_Z',
      subscriptionCode: 'SUB_Z',
      emailToken: 't2',
      customerCode: 'CUS_Z',
      nextPaymentAt: null,
    });
    const { results } = await ctx.db
      .prepare("SELECT COUNT(*) AS n FROM subscriptions WHERE subscription_code='SUB_Z'")
      .all<{ n: number }>();
    expect(results[0].n).toBe(1);
  });

  it('sets status and lists', async () => {
    await setSubscriptionStatus(ctx.db, 'SUB_A', 'cancelled');
    expect((await getSubscriptionByCode(ctx.db, 'SUB_A'))?.status).toBe('cancelled');
    const active = await listSubscriptions(ctx.db, { status: 'active' });
    expect(active.find((s) => s.subscription_code === 'SUB_A')).toBeUndefined();
    expect((await listSubscriptions(ctx.db, {})).length).toBeGreaterThanOrEqual(2);
  });
});
