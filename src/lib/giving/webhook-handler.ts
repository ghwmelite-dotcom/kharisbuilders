import { markDonationSuccess } from '../db/donations';

export interface PaystackEvent {
  event: string;
  data?: { reference?: string; channel?: string; status?: string; paid_at?: string };
}

/** Dispatch a verified Paystack webhook event. Idempotent; unknown events/refs are no-ops. */
export async function handlePaystackEvent(db: D1Database, event: PaystackEvent): Promise<void> {
  if (event.event === 'charge.success' && event.data?.reference) {
    await markDonationSuccess(db, event.data.reference, {
      channel: event.data.channel,
      paystackStatus: event.data.status,
      paidAt: event.data.paid_at,
    });
  }
}
