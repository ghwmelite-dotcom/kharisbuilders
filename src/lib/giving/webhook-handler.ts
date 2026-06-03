import { getDonationByReference, markDonationSuccess, createRecurringDonation } from '../db/donations';
import {
  activateSubscription,
  getActiveSubscriptionForCharge,
  getSoleActiveSubscriptionForEmail,
  setSubscriptionStatus,
} from '../db/subscriptions';

export interface PaystackEvent {
  event: string;
  data?: {
    reference?: string;
    channel?: string;
    status?: string;
    amount?: number;
    currency?: string;
    paid_at?: string;
    email_token?: string;
    subscription_code?: string;
    next_payment_date?: string;
    customer?: { email?: string; customer_code?: string };
    plan?: { plan_code?: string };
    subscription?: { subscription_code?: string };
  };
}

type EventData = NonNullable<PaystackEvent['data']>;

async function handleChargeSuccess(db: D1Database, data: EventData): Promise<void> {
  if (!data.reference) return;
  const existing = await getDonationByReference(db, data.reference);
  if (existing) {
    // first charge (or already recorded) — amount-checked, idempotent (B1 behaviour)
    if (typeof data.amount === 'number' && data.amount !== existing.amount) return;
    await markDonationSuccess(db, data.reference, {
      channel: data.channel,
      paystackStatus: data.status,
      paidAt: data.paid_at,
    });
    return;
  }
  // automatic cycle charge: correlate the subscription by (email, plan_code)
  const email = data.customer?.email;
  const planCode = data.plan?.plan_code;
  if (!email) return; // cannot attribute without an email — drop (not a giving charge we initiated)
  // Correlate by (email, plan_code); if the event omits plan_code, fall back to the giver's
  // sole active subscription so the cycle charge stays attributed to its fund.
  const sub =
    (planCode ? await getActiveSubscriptionForCharge(db, { customerEmail: email, planCode }) : null) ??
    (await getSoleActiveSubscriptionForEmail(db, email));
  await createRecurringDonation(db, {
    reference: data.reference,
    email,
    name: null,
    amount: data.amount ?? sub?.amount ?? 0,
    currency: data.currency ?? 'GHS',
    fund_id: sub?.fund_id ?? null,
    subscription_id: sub?.id ?? null,
    channel: data.channel,
    paidAt: data.paid_at,
  });
}

async function handleSubscriptionCreate(db: D1Database, data: EventData): Promise<void> {
  const email = data.customer?.email;
  const planCode = data.plan?.plan_code;
  if (!email || !planCode || !data.subscription_code) return;
  await activateSubscription(db, {
    customerEmail: email,
    planCode,
    subscriptionCode: data.subscription_code,
    emailToken: data.email_token,
    customerCode: data.customer?.customer_code,
    nextPaymentAt: data.next_payment_date,
  });
}

/** Dispatch a verified Paystack webhook event. Idempotent; unknown events are no-ops. */
export async function handlePaystackEvent(db: D1Database, event: PaystackEvent): Promise<void> {
  const data = event.data;
  if (!data) return;
  switch (event.event) {
    case 'charge.success':
      return handleChargeSuccess(db, data);
    case 'subscription.create':
      return handleSubscriptionCreate(db, data);
    case 'invoice.payment_failed':
      if (data.subscription?.subscription_code) {
        await setSubscriptionStatus(db, data.subscription.subscription_code, 'attention');
      }
      return;
    case 'subscription.disable':
    case 'subscription.not_renew':
      if (data.subscription_code) await setSubscriptionStatus(db, data.subscription_code, 'cancelled');
      return;
    default:
      return;
  }
}
