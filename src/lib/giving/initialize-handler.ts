import { DonationInputSchema } from '../db/schemas';
import { validateAmount } from './money';
import { makeReference, makeSubReference } from './reference';
import { createPendingDonation } from '../db/donations';
import { createPendingSubscription } from '../db/subscriptions';
import { ensurePlan } from './ensure-plan';
import { getSetting } from '../db/settings';
import { initializeTransaction } from '../paystack/client';

const INTERVALS = ['weekly', 'monthly', 'annually'];

export interface InitializeEnv {
  DB: D1Database;
  PAYSTACK_SECRET_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
}

export interface InitializeDeps {
  origin: string;
  fetchFn?: typeof fetch;
}

export interface InitializeResult {
  status: number;
  redirect: string;
}

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

async function verifyTurnstileWith(
  fetchFn: typeof fetch,
  secret: string,
  token: string,
  ip?: string,
): Promise<boolean> {
  if (!token) return false;
  try {
    const body = new FormData();
    body.append('secret', secret);
    body.append('response', token);
    if (ip) body.append('remoteip', ip);
    const res = await fetchFn(SITEVERIFY_URL, { method: 'POST', body });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

function back(error: string): InitializeResult {
  return { status: 303, redirect: `/giving?error=${error}` };
}

/** Validate -> Turnstile -> create pending donation -> Paystack initialize -> redirect to checkout. */
export async function handleInitialize(
  env: InitializeEnv,
  form: FormData,
  ip: string | undefined,
  deps: InitializeDeps,
): Promise<InitializeResult> {
  const doFetch = deps.fetchFn ?? fetch;

  const parsed = DonationInputSchema.safeParse({
    email: form.get('email'),
    name: form.get('name') ?? '',
    amount: form.get('amount'),
    fund_id: form.get('fund_id') ?? undefined,
  });
  if (!parsed.success) return back('invalid');

  const amount = validateAmount(parsed.data.amount);
  if (!amount.ok) return back('amount');

  const token = String(form.get('cf-turnstile-response') ?? '');
  const turnstileOk = await verifyTurnstileWith(doFetch, env.TURNSTILE_SECRET_KEY ?? '', token, ip);
  if (!turnstileOk) return back('turnstile');

  const currency = (await getSetting(env.DB, 'currency').catch(() => null)) ?? 'GHS';
  const type = String(form.get('type') ?? 'one_time');

  if (type === 'recurring') {
    const interval = String(form.get('interval') ?? '');
    if (!INTERVALS.includes(interval)) return back('interval');

    const plan = await ensurePlan(
      env.DB,
      { amount: amount.minor, interval, currency },
      { secret: env.PAYSTACK_SECRET_KEY ?? '', fetchFn: doFetch },
    );
    if (!plan.ok) return back('init');

    const localRef = makeSubReference();
    const subId = await createPendingSubscription(env.DB, {
      local_ref: localRef,
      customer_email: parsed.data.email,
      plan_id: plan.planId,
      plan_code: plan.planCode,
      amount: amount.minor,
      interval,
      fund_id: parsed.data.fund_id,
    });

    const reference = makeReference();
    const metadata = { fund_id: parsed.data.fund_id ?? null, donor_name: parsed.data.name || null, recurring: true };
    await createPendingDonation(env.DB, {
      reference,
      email: parsed.data.email,
      name: parsed.data.name ?? '',
      amount: amount.minor,
      currency,
      fund_id: parsed.data.fund_id,
      type: 'recurring',
      metadata: JSON.stringify(metadata),
      subscription_id: subId,
    });

    const init = await initializeTransaction(
      { email: parsed.data.email, currency, reference, callbackUrl: `${deps.origin}/giving/callback`, metadata, plan: plan.planCode },
      { secret: env.PAYSTACK_SECRET_KEY ?? '', fetchFn: doFetch },
    );
    if (!init.ok) return back('init');
    return { status: 303, redirect: init.authorizationUrl };
  }

  // --- one-time ---
  const reference = makeReference();
  const metadata = { fund_id: parsed.data.fund_id ?? null, donor_name: parsed.data.name || null };

  await createPendingDonation(env.DB, {
    reference,
    email: parsed.data.email,
    name: parsed.data.name ?? '',
    amount: amount.minor,
    currency,
    fund_id: parsed.data.fund_id,
    type: 'one_time',
    metadata: JSON.stringify(metadata),
  });

  const init = await initializeTransaction(
    {
      email: parsed.data.email,
      amount: amount.minor,
      currency,
      reference,
      callbackUrl: `${deps.origin}/giving/callback`,
      metadata,
    },
    { secret: env.PAYSTACK_SECRET_KEY ?? '', fetchFn: doFetch },
  );
  if (!init.ok) return back('init');

  return { status: 303, redirect: init.authorizationUrl };
}
