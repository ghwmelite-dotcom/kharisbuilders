import { getDonationByReference, markDonationSuccess } from '../db/donations';

export interface PaystackEvent {
  event: string;
  data?: { reference?: string; channel?: string; status?: string; amount?: number; paid_at?: string };
}

/**
 * Dispatch a verified Paystack webhook event. Idempotent; unknown events/refs are no-ops.
 * Defense-in-depth: only confirms when Paystack's reported amount matches the amount we
 * initialized for that reference (a pending row is never flipped on an amount mismatch).
 */
export async function handlePaystackEvent(db: D1Database, event: PaystackEvent): Promise<void> {
  if (event.event !== 'charge.success' || !event.data?.reference) return;
  const donation = await getDonationByReference(db, event.data.reference);
  if (!donation) return; // unknown reference
  if (typeof event.data.amount === 'number' && event.data.amount !== donation.amount) return; // amount mismatch
  await markDonationSuccess(db, event.data.reference, {
    channel: event.data.channel,
    paystackStatus: event.data.status,
    paidAt: event.data.paid_at,
  });
}
