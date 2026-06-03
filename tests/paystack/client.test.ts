import { describe, it, expect } from 'vitest';
import { initializeTransaction, verifyTransaction } from '../../src/lib/paystack/client';

function jsonResponse(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
}

describe('initializeTransaction', () => {
  it('posts and returns the authorization url + reference', async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    const fetchFn = (async (url: string, init: RequestInit) => {
      captured = { url, init };
      return jsonResponse({
        status: true,
        data: { authorization_url: 'https://paystack/checkout/xyz', access_code: 'ac', reference: 'kb_ref1' },
      });
    }) as unknown as typeof fetch;

    const res = await initializeTransaction(
      {
        email: 'g@x.com',
        amount: 10000,
        currency: 'GHS',
        reference: 'kb_ref1',
        callbackUrl: 'https://site/giving/callback',
        metadata: { fund_id: 1 },
      },
      { secret: 'sk_test', fetchFn },
    );
    expect(res).toEqual({
      ok: true,
      authorizationUrl: 'https://paystack/checkout/xyz',
      accessCode: 'ac',
      reference: 'kb_ref1',
    });
    expect(captured!.url).toBe('https://api.paystack.co/transaction/initialize');
    expect((captured!.init.headers as Record<string, string>).Authorization).toBe('Bearer sk_test');
    expect(JSON.parse(captured!.init.body as string)).toMatchObject({
      email: 'g@x.com',
      amount: 10000,
      currency: 'GHS',
      reference: 'kb_ref1',
    });
  });

  it('returns ok:false on a Paystack error payload', async () => {
    const fetchFn = (async () => jsonResponse({ status: false, message: 'Invalid key' }, 401)) as unknown as typeof fetch;
    const res = await initializeTransaction(
      { email: 'g@x.com', amount: 10000, currency: 'GHS', reference: 'r', callbackUrl: 'c', metadata: {} },
      { secret: 'bad', fetchFn },
    );
    expect(res.ok).toBe(false);
  });

  it('returns ok:false on network error', async () => {
    const fetchFn = (async () => {
      throw new Error('network');
    }) as unknown as typeof fetch;
    const res = await initializeTransaction(
      { email: 'g@x.com', amount: 1, currency: 'GHS', reference: 'r', callbackUrl: 'c', metadata: {} },
      { secret: 'sk', fetchFn },
    );
    expect(res.ok).toBe(false);
  });
});

describe('verifyTransaction', () => {
  it('maps a successful verification', async () => {
    const fetchFn = (async (url: string) => {
      expect(url).toBe('https://api.paystack.co/transaction/verify/kb_ref1');
      return jsonResponse({
        status: true,
        data: { status: 'success', channel: 'mobile_money', reference: 'kb_ref1', paid_at: '2026-06-03T10:00:00Z' },
      });
    }) as unknown as typeof fetch;
    const res = await verifyTransaction('kb_ref1', { secret: 'sk', fetchFn });
    expect(res).toEqual({
      ok: true,
      status: 'success',
      channel: 'mobile_money',
      reference: 'kb_ref1',
      paidAt: '2026-06-03T10:00:00Z',
    });
  });
  it('maps a failed verification', async () => {
    const fetchFn = (async () =>
      jsonResponse({ status: true, data: { status: 'failed', channel: 'card', reference: 'r' } })) as unknown as typeof fetch;
    const res = await verifyTransaction('r', { secret: 'sk', fetchFn });
    expect(res).toEqual({ ok: true, status: 'failed', channel: 'card', reference: 'r', paidAt: undefined });
  });
});
