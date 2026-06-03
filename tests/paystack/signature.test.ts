import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyWebhookSignature, hmacSha512Hex } from '../../src/lib/paystack/signature';

const secret = 'sk_test_abc123';
const body = JSON.stringify({ event: 'charge.success', data: { reference: 'kb_x' } });
const goodSig = createHmac('sha512', secret).update(body).digest('hex');

describe('hmacSha512Hex', () => {
  it('matches Node crypto for the same input', async () => {
    expect(await hmacSha512Hex(body, secret)).toBe(goodSig);
  });
});

describe('verifyWebhookSignature', () => {
  it('accepts a correct signature', async () => {
    expect(await verifyWebhookSignature(body, goodSig, secret)).toBe(true);
  });
  it('rejects a tampered body', async () => {
    expect(await verifyWebhookSignature(body + ' ', goodSig, secret)).toBe(false);
  });
  it('rejects a wrong secret', async () => {
    expect(await verifyWebhookSignature(body, goodSig, 'sk_test_wrong')).toBe(false);
  });
  it('rejects an empty signature', async () => {
    expect(await verifyWebhookSignature(body, '', secret)).toBe(false);
  });
});
