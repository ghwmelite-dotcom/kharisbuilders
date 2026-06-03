const API = 'https://api.paystack.co';

export interface PaystackConfig {
  secret: string;
  fetchFn?: typeof fetch;
}

export interface InitializeParams {
  email: string;
  amount?: number; // minor units (pesewas); omit when subscribing via plan
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
  plan?: string; // Paystack plan_code for subscriptions
}

export type InitializeResult =
  | { ok: true; authorizationUrl: string; accessCode: string; reference: string }
  | { ok: false; error: string };

export async function initializeTransaction(params: InitializeParams, cfg: PaystackConfig): Promise<InitializeResult> {
  const doFetch = cfg.fetchFn ?? fetch;
  try {
    const payload: Record<string, unknown> = {
      email: params.email,
      currency: params.currency,
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: params.metadata,
    };
    if (params.plan) payload.plan = params.plan;
    else if (typeof params.amount === 'number') payload.amount = params.amount;
    const res = await doFetch(`${API}/transaction/initialize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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
  | { ok: true; status: string; channel: string | null; reference: string; amount: number | null; currency: string | null; paidAt?: string }
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
      data?: { status?: string; channel?: string; reference?: string; amount?: number; currency?: string; paid_at?: string };
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
      amount: typeof json.data.amount === 'number' ? json.data.amount : null,
      currency: json.data.currency ?? null,
      paidAt: json.data.paid_at,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network error' };
  }
}

export type CreatePlanResult = { ok: true; planCode: string } | { ok: false; error: string };

export async function createPlan(
  p: { name: string; amount: number; interval: string; currency: string },
  cfg: PaystackConfig,
): Promise<CreatePlanResult> {
  const doFetch = cfg.fetchFn ?? fetch;
  try {
    const res = await doFetch(`${API}/plan`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: p.name, amount: p.amount, interval: p.interval, currency: p.currency }),
    });
    const j = (await res.json()) as { status?: boolean; data?: { plan_code?: string }; message?: string };
    if (!res.ok || !j.status || !j.data?.plan_code) return { ok: false, error: j.message ?? `plan failed (${res.status})` };
    return { ok: true, planCode: j.data.plan_code };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network error' };
  }
}

export type DisableResult = { ok: true } | { ok: false; error: string };

export async function disableSubscription(
  s: { code: string; token: string },
  cfg: PaystackConfig,
): Promise<DisableResult> {
  const doFetch = cfg.fetchFn ?? fetch;
  try {
    const res = await doFetch(`${API}/subscription/disable`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: s.code, token: s.token }),
    });
    const j = (await res.json()) as { status?: boolean; message?: string };
    if (!res.ok || !j.status) return { ok: false, error: j.message ?? `disable failed (${res.status})` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network error' };
  }
}
