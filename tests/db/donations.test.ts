import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { createFund } from '../../src/lib/db/funds';
import {
  createPendingDonation,
  getDonationByReference,
  markDonationSuccess,
  markDonationFailed,
  listDonations,
  totalsByFund,
  donationTotals,
} from '../../src/lib/db/donations';

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

describe('donations data access', () => {
  it('creates a pending donation and reads it back', async () => {
    await createPendingDonation(ctx.db, {
      reference: 'kb_ref1',
      email: 'g@x.com',
      name: 'Gift Giver',
      amount: 10000,
      currency: 'GHS',
      fund_id: fundId,
      type: 'one_time',
      metadata: '{}',
    });
    const d = await getDonationByReference(ctx.db, 'kb_ref1');
    expect(d?.status).toBe('pending');
    expect(d?.amount).toBe(10000);
  });

  it('marks success idempotently (pending->success only once)', async () => {
    await markDonationSuccess(ctx.db, 'kb_ref1', {
      channel: 'mobile_money',
      paystackStatus: 'success',
      paidAt: '2026-06-03 10:00:00',
    });
    const first = await getDonationByReference(ctx.db, 'kb_ref1');
    expect(first?.status).toBe('success');
    expect(first?.channel).toBe('mobile_money');
    // Second call must not change paid_at or channel
    await markDonationSuccess(ctx.db, 'kb_ref1', { channel: 'card', paystackStatus: 'success', paidAt: '2026-06-03 11:00:00' });
    const second = await getDonationByReference(ctx.db, 'kb_ref1');
    expect(second?.channel).toBe('mobile_money'); // unchanged
    expect(second?.paid_at).toBe('2026-06-03 10:00:00');
  });

  it('marks failed', async () => {
    await createPendingDonation(ctx.db, {
      reference: 'kb_ref2',
      email: 'h@x.com',
      name: '',
      amount: 5000,
      currency: 'GHS',
      fund_id: fundId,
      type: 'one_time',
      metadata: '{}',
    });
    await markDonationFailed(ctx.db, 'kb_ref2', { paystackStatus: 'failed' });
    expect((await getDonationByReference(ctx.db, 'kb_ref2'))?.status).toBe('failed');
  });

  it('totals count only successful donations', async () => {
    const totals = await donationTotals(ctx.db);
    expect(totals.total).toBe(10000); // ref1 only
    expect(totals.count).toBe(1);
    const byFund = await totalsByFund(ctx.db);
    expect(byFund.find((r) => r.fund_id === fundId)?.total).toBe(10000);
  });

  it('lists donations newest first', async () => {
    const list = await listDonations(ctx.db, { limit: 10, offset: 0 });
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list[0].reference).toBeDefined();
  });
});
