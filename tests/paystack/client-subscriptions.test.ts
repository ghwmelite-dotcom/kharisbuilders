import { describe, it, expect } from 'vitest';
import { createPlan, disableSubscription, initializeTransaction } from '../../src/lib/paystack/client';

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
}

describe('createPlan', () => {
  it('posts plan details and returns the plan code', async () => {
    let body: Record<string, unknown> | null = null;
    const fetchFn = (async (_url: string, init: RequestInit) => {
      body = JSON.parse(init.body as string);
      return json({ status: true, data: { plan_code: 'PLN_x' } });
    }) as unknown as typeof fetch;
    const res = await createPlan(
      { name: 'Kharis Monthly GHS 100', amount: 10000, interval: 'monthly', currency: 'GHS' },
      { secret: 'sk', fetchFn },
    );
    expect(res).toEqual({ ok: true, planCode: 'PLN_x' });
    expect(body).toMatchObject({ name: 'Kharis Monthly GHS 100', amount: 10000, interval: 'monthly', currency: 'GHS' });
  });
  it('returns ok:false on error', async () => {
    const fetchFn = (async () => json({ status: false, message: 'bad' }, 400)) as unknown as typeof fetch;
    expect((await createPlan({ name: 'n', amount: 1, interval: 'monthly', currency: 'GHS' }, { secret: 'x', fetchFn })).ok).toBe(false);
  });
});

describe('disableSubscription', () => {
  it('posts code + token', async () => {
    let body: Record<string, unknown> | null = null;
    const fetchFn = (async (url: string, init: RequestInit) => {
      body = JSON.parse(init.body as string);
      expect(url).toBe('https://api.paystack.co/subscription/disable');
      return json({ status: true });
    }) as unknown as typeof fetch;
    const res = await disableSubscription({ code: 'SUB_A', token: 'tok' }, { secret: 'sk', fetchFn });
    expect(res.ok).toBe(true);
    expect(body).toEqual({ code: 'SUB_A', token: 'tok' });
  });
});

describe('initializeTransaction with plan', () => {
  it('sends plan and omits amount', async () => {
    let body: Record<string, unknown> | null = null;
    const fetchFn = (async (_url: string, init: RequestInit) => {
      body = JSON.parse(init.body as string);
      return json({ status: true, data: { authorization_url: 'u', access_code: 'a', reference: 'r' } });
    }) as unknown as typeof fetch;
    await initializeTransaction(
      { email: 'g@x.com', currency: 'GHS', reference: 'r', callbackUrl: 'c', metadata: {}, plan: 'PLN_x' },
      { secret: 'sk', fetchFn },
    );
    expect(body!.plan).toBe('PLN_x');
    expect('amount' in body!).toBe(false);
  });
});
