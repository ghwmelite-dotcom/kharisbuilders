import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { createFund } from '../../src/lib/db/funds';
import { listSubscriptions } from '../../src/lib/db/subscriptions';
import { listDonations } from '../../src/lib/db/donations';
import { getPlanByKey } from '../../src/lib/db/plans';
import { handleInitialize } from '../../src/lib/giving/initialize-handler';

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

function form(f: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(f)) fd.append(k, v);
  return fd;
}

// siteverify -> ok; /plan -> plan code; /transaction/initialize -> auth url
const okFetch = (async (url: string) => {
  if (String(url).includes('siteverify')) return new Response(JSON.stringify({ success: true }), { status: 200 });
  if (String(url).includes('/plan')) return new Response(JSON.stringify({ status: true, data: { plan_code: 'PLN_m' } }), { status: 200 });
  return new Response(
    JSON.stringify({ status: true, data: { authorization_url: 'https://pay/checkout', access_code: 'a', reference: 'r' } }),
    { status: 200 },
  );
}) as unknown as typeof fetch;

const env = { DB: undefined as unknown as D1Database, PAYSTACK_SECRET_KEY: 'sk', TURNSTILE_SECRET_KEY: 'ts' };

describe('handleInitialize (recurring)', () => {
  it('rejects an invalid interval', async () => {
    const res = await handleInitialize(
      { ...env, DB: ctx.db },
      form({ type: 'recurring', interval: 'daily', email: 'g@x.com', amount: '100', fund_id: String(fundId), 'cf-turnstile-response': 'x' }),
      undefined,
      { origin: 'https://s', fetchFn: okFetch },
    );
    expect(res.redirect).toContain('error=');
  });

  it('ensures a plan, records a pending subscription + pending donation, and redirects', async () => {
    const res = await handleInitialize(
      { ...env, DB: ctx.db },
      form({ type: 'recurring', interval: 'monthly', email: 'g@x.com', name: 'Gift', amount: '100', fund_id: String(fundId), 'cf-turnstile-response': 'x' }),
      '1.1.1.1',
      { origin: 'https://s', fetchFn: okFetch },
    );
    expect(res.status).toBe(303);
    expect(res.redirect).toBe('https://pay/checkout');
    expect((await getPlanByKey(ctx.db, 10000, 'monthly', 'USD'))?.plan_code).toBe('PLN_m');
    const subs = await listSubscriptions(ctx.db, {});
    const sub = subs.find((s) => s.customer_email === 'g@x.com' && s.plan_code === 'PLN_m');
    expect(sub?.status).toBe('pending');
    expect(sub?.fund_id).toBe(fundId);
    const don = (await listDonations(ctx.db, { limit: 10, offset: 0 })).find(
      (d) => d.type === 'recurring' && d.email === 'g@x.com',
    );
    expect(don?.status).toBe('pending');
    expect(don?.subscription_id).toBe(sub?.id);
  });

  it('still handles one-time gifts (regression)', async () => {
    const res = await handleInitialize(
      { ...env, DB: ctx.db },
      form({ type: 'one_time', email: 'o@x.com', amount: '50', fund_id: String(fundId), 'cf-turnstile-response': 'x' }),
      undefined,
      { origin: 'https://s', fetchFn: okFetch },
    );
    expect(res.status).toBe(303);
    expect(res.redirect).toBe('https://pay/checkout');
  });
});
