const API = 'https://api.paystack.co';

export interface PaystackConfig {
  secret: string;
  fetchFn?: typeof fetch;
}

export interface InitializeParams {
  email: string;
  amount: number; // minor units (pesewas)
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}

export type InitializeResult =
  | { ok: true; authorizationUrl: string; accessCode: string; reference: string }
  | { ok: false; error: string };

export async function initializeTransaction(params: InitializeParams, cfg: PaystackConfig): Promise<InitializeResult> {
  const doFetch = cfg.fetchFn ?? fetch;
  try {
    const res = await doFetch(`${API}/transaction/initialize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: params.email,
        amount: params.amount,
        currency: params.currency,
        reference: params.reference,
        callback_url: params.callbackUrl,
        metadata: params.metadata,
      }),
    });
    const json = (await res.json()) as {
      status?: boolean;
      data?: { authorization_url?: string; access_code?: string; reference?: string };
      message?: string;
    };
    if (!res.ok || !json.status || !json.data?.authorization_url) {
      return { ok: false, error: json.message ?? `Paystack initialize failed (${res.status})` };
    }
    return {
      ok: true,
      authorizationUrl: json.data.authorization_url,
      accessCode: json.data.access_code ?? '',
      reference: json.data.reference ?? params.reference,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network error' };
  }
}

export type VerifyResult =
  | { ok: true; status: string; channel: string | null; reference: string; paidAt?: string }
  | { ok: false; error: string };

export async function verifyTransaction(reference: string, cfg: PaystackConfig): Promise<VerifyResult> {
  const doFetch = cfg.fetchFn ?? fetch;
  try {
    const res = await doFetch(`${API}/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${cfg.secret}` },
    });
    const json = (await res.json()) as {
      status?: boolean;
      data?: { status?: string; channel?: string; reference?: string; paid_at?: string };
      message?: string;
    };
    if (!res.ok || !json.status || !json.data?.status) {
      return { ok: false, error: json.message ?? `Paystack verify failed (${res.status})` };
    }
    return {
      ok: true,
      status: json.data.status,
      channel: json.data.channel ?? null,
      reference: json.data.reference ?? reference,
      paidAt: json.data.paid_at,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network error' };
  }
}
