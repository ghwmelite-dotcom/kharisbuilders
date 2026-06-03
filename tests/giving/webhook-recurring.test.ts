import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { createFund } from '../../src/lib/db/funds';
import { createPendingSubscription, getSubscriptionByCode } from '../../src/lib/db/subscriptions';
import { createPendingDonation, getDonationByReference } from '../../src/lib/db/donations';
import { handlePaystackEvent } from '../../src/lib/giving/webhook-handler';

let ctx: TestDb;
let fundId: number;
let subId: number;
beforeAll(async () => {
  ctx = await createTestDb();
  fundId = await createFund(ctx.db, { name: 'G', slug: 'g', description: '', sort_order: 1, active: true }, 'a@x');
  subId = await createPendingSubscription(ctx.db, {
    local_ref: 'kb_sub_1',
    customer_email: 'g@x.com',
    plan_id: null,
    plan_code: 'PLN_A',
    amount: 10000,
    interval: 'monthly',
    fund_id: fundId,
  });
  // first-charge pending donation tied to the subscription
  await createPendingDonation(ctx.db, {
    reference: 'kb_first',
    email: 'g@x.com',
    name: '',
    amount: 10000,
    currency: 'GHS',
    fund_id: fundId,
    type: 'recurring',
    metadata: '{}',
    subscription_id: subId,
  });
});
afterAll(async () => {
  await ctx.dispose();
});

describe('recurring webhooks', () => {
  it('subscription.create activates the pending subscription', async () => {
    await handlePaystackEvent(ctx.db, {
      event: 'subscription.create',
      data: {
        subscription_code: 'SUB_A',
        email_token: 'tok',
        next_payment_date: '2026-07-03 00:00:00',
        customer: { email: 'g@x.com', customer_code: 'CUS_A' },
        plan: { plan_code: 'PLN_A' },
      },
    });
    const sub = await getSubscriptionByCode(ctx.db, 'SUB_A');
    expect(sub?.status).toBe('active');
    expect(sub?.fund_id).toBe(fundId);
  });

  it('first charge.success marks the pending donation (by reference)', async () => {
    await handlePaystackEvent(ctx.db, {
      event: 'charge.success',
      data: { reference: 'kb_first', amount: 10000, channel: 'card', status: 'success', paid_at: '2026-06-03 10:00:00' },
    });
    expect((await getDonationByReference(ctx.db, 'kb_first'))?.status).toBe('success');
  });

  it('a cycle charge.success (new reference) records a recurring donation with the sub fund', async () => {
    await handlePaystackEvent(ctx.db, {
      event: 'charge.success',
      data: {
        reference: 'kb_cycle1',
        amount: 10000,
        currency: 'GHS',
        channel: 'card',
        status: 'success',
        paid_at: '2026-07-03 10:00:00',
        customer: { email: 'g@x.com' },
        plan: { plan_code: 'PLN_A' },
      },
    });
    const d = await getDonationByReference(ctx.db, 'kb_cycle1');
    expect(d?.type).toBe('recurring');
    expect(d?.status).toBe('success');
    expect(d?.fund_id).toBe(fundId);
    expect(d?.subscription_id).toBe(subId);
  });

  it('duplicate cycle charge is idempotent', async () => {
    await handlePaystackEvent(ctx.db, {
      event: 'charge.success',
      data: { reference: 'kb_cycle1', amount: 1, channel: 'card', status: 'success', customer: { email: 'g@x.com' }, plan: { plan_code: 'PLN_A' } },
    });
    expect((await getDonationByReference(ctx.db, 'kb_cycle1'))?.amount).toBe(10000); // unchanged
  });

  it('invoice.payment_failed flags the subscription; disable cancels it', async () => {
    await handlePaystackEvent(ctx.db, { event: 'invoice.payment_failed', data: { subscription: { subscription_code: 'SUB_A' } } });
    expect((await getSubscriptionByCode(ctx.db, 'SUB_A'))?.status).toBe('attention');
    await handlePaystackEvent(ctx.db, { event: 'subscription.disable', data: { subscription_code: 'SUB_A' } });
    expect((await getSubscriptionByCode(ctx.db, 'SUB_A'))?.status).toBe('cancelled');
  });
});
