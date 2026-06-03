import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/d1';
import { createFund } from '../../src/lib/db/funds';
import { getDonationByReference, listDonations } from '../../src/lib/db/donations';
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

function form(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

// Turnstile + Paystack fetch stub: siteverify -> success; paystack initialize -> authorization_url
const okFetch = (async (url: string) => {
  if (String(url).includes('siteverify')) return new Response(JSON.stringify({ success: true }), { status: 200 });
  return new Response(
    JSON.stringify({ status: true, data: { authorization_url: 'https://paystack/checkout/abc', access_code: 'ac', reference: 'X' } }),
    { status: 200 },
  );
}) as unknown as typeof fetch;

const env = { DB: undefined as unknown as D1Database, PAYSTACK_SECRET_KEY: 'sk_test', TURNSTILE_SECRET_KEY: 'ts' };

describe('handleInitialize', () => {
  it('rejects invalid input before calling Paystack', async () => {
    const res = await handleInitialize(
      { ...env, DB: ctx.db },
      form({ email: 'not-an-email', amount: '100', 'cf-turnstile-response': 'x' }),
      '1.1.1.1',
      { origin: 'https://site', fetchFn: okFetch },
    );
    expect(res.status).toBe(303);
    expect(res.redirect).toContain('/giving?error=');
  });

  it('rejects an out-of-range amount', async () => {
    const res = await handleInitialize(
      { ...env, DB: ctx.db },
      form({ email: 'g@x.com', amount: '0.5', fund_id: String(fundId), 'cf-turnstile-response': 'x' }),
      undefined,
      { origin: 'https://site', fetchFn: okFetch },
    );
    expect(res.redirect).toContain('error=');
  });

  it('creates a pending donation and redirects to Paystack on success', async () => {
    const res = await handleInitialize(
      { ...env, DB: ctx.db },
      form({ email: 'g@x.com', name: 'Gift', amount: '100', fund_id: String(fundId), 'cf-turnstile-response': 'x' }),
      '2.2.2.2',
      { origin: 'https://site', fetchFn: okFetch },
    );
    expect(res.status).toBe(303);
    expect(res.redirect).toBe('https://paystack/checkout/abc');
    const all = await listDonations(ctx.db, { limit: 10, offset: 0 });
    const pending = all.find((d) => d.email === 'g@x.com' && d.amount === 10000);
    expect(pending).toBeDefined();
    expect(pending!.status).toBe('pending');
    expect(await getDonationByReference(ctx.db, pending!.reference)).not.toBeNull();
  });

  it('rejects when Turnstile fails', async () => {
    const failTurnstile = (async (url: string) => {
      if (String(url).includes('siteverify')) return new Response(JSON.stringify({ success: false }), { status: 200 });
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    const res = await handleInitialize(
      { ...env, DB: ctx.db },
      form({ email: 'g@x.com', amount: '100', fund_id: String(fundId), 'cf-turnstile-response': 'x' }),
      undefined,
      { origin: 'https://site', fetchFn: failTurnstile },
    );
    expect(res.redirect).toContain('error=');
  });
});
