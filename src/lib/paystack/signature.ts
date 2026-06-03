const encoder = new TextEncoder();

/** Hex HMAC-SHA512 of `message` keyed by `secret`, via WebCrypto (Workers + Node 18+). */
export async function hmacSha512Hex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

/** Verify Paystack's `x-paystack-signature` (HMAC-SHA512 of the raw body, keyed by the secret key). */
export async function verifyWebhookSignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  if (!signature || !secret) return false;
  const expected = await hmacSha512Hex(rawBody, secret);
  return timingSafeEqualHex(expected, signature);
}
