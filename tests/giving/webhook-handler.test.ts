import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { createFund } from '../../src/lib/db/funds';
import { createPendingDonation, getDonationByReference } from '../../src/lib/db/donations';
import { handlePaystackEvent } from '../../src/lib/giving/webhook-handler';

let ctx: TestDb;
beforeAll(async () => {
  ctx = await createTestDb();
  const f = await createFund(ctx.db, { name: 'G', slug: 'g', description: '', sort_order: 1, active: true }, 'a@x');
  await createPendingDonation(ctx.db, {
    reference: 'kb_w1',
    email: 'g@x.com',
    name: '',
    amount: 10000,
    currency: 'GHS',
    fund_id: f,
    type: 'one_time',
    metadata: '{}',
  });
});
afterAll(async () => {
  await ctx.dispose();
});

describe('handlePaystackEvent', () => {
  it('marks the donation success on charge.success', async () => {
    await handlePaystackEvent(ctx.db, {
      event: 'charge.success',
      data: { reference: 'kb_w1', channel: 'mobile_money', status: 'success', paid_at: '2026-06-03 10:00:00' },
    });
    expect((await getDonationByReference(ctx.db, 'kb_w1'))?.status).toBe('success');
  });
  it('ignores unknown events', async () => {
    await handlePaystackEvent(ctx.db, { event: 'transfer.success', data: { reference: 'kb_w1' } });
    expect((await getDonationByReference(ctx.db, 'kb_w1'))?.status).toBe('success'); // unchanged
  });
  it('no-ops on unknown reference', async () => {
    await handlePaystackEvent(ctx.db, { event: 'charge.success', data: { reference: 'kb_does_not_exist', status: 'success' } });
    expect(await getDonationByReference(ctx.db, 'kb_does_not_exist')).toBeNull();
  });
});
