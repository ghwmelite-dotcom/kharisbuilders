import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { createFund } from '../../src/lib/db/funds';
import { createPendingSubscription } from '../../src/lib/db/subscriptions';
import {
  createPendingDonation,
  createRecurringDonation,
  getDonationByReference,
  donationTotals,
} from '../../src/lib/db/donations';

let ctx: TestDb;
let fundId: number;
let subId: number;
beforeAll(async () => {
  ctx = await createTestDb();
  fundId = await createFund(ctx.db, { name: 'G', slug: 'g', description: '', sort_order: 1, active: true }, 'a@x');
  subId = await createPendingSubscription(ctx.db, {
    local_ref: 'kb_sub_dr',
    customer_email: 'g@x.com',
    plan_id: null,
    plan_code: 'PLN_DR',
    amount: 10000,
    interval: 'monthly',
    fund_id: fundId,
  });
});
afterAll(async () => {
  await ctx.dispose();
});

describe('recurring donations', () => {
  it('createPendingDonation accepts subscription_id', async () => {
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
    expect((await getDonationByReference(ctx.db, 'kb_first'))?.subscription_id).toBe(subId);
  });

  it('createRecurringDonation inserts a success row, idempotent on reference', async () => {
    await createRecurringDonation(ctx.db, {
      reference: 'kb_cycle1',
      email: 'g@x.com',
      name: null,
      amount: 10000,
      currency: 'GHS',
      fund_id: fundId,
      subscription_id: subId,
      channel: 'card',
      paidAt: '2026-07-03 10:00:00',
    });
    const d = await getDonationByReference(ctx.db, 'kb_cycle1');
    expect(d?.status).toBe('success');
    expect(d?.type).toBe('recurring');
    expect(d?.subscription_id).toBe(subId);
    // idempotent: second call with same reference does not duplicate or change
    await createRecurringDonation(ctx.db, {
      reference: 'kb_cycle1',
      email: 'g@x.com',
      name: null,
      amount: 999,
      currency: 'GHS',
      fund_id: fundId,
      subscription_id: subId,
      channel: 'card',
      paidAt: 'x',
    });
    expect((await getDonationByReference(ctx.db, 'kb_cycle1'))?.amount).toBe(10000);
    const totals = await donationTotals(ctx.db);
    expect(totals.total).toBe(10000); // only the one successful cycle row counts
  });
});
