export interface DonationRow {
  id: number;
  reference: string;
  email: string;
  name: string | null;
  amount: number;
  currency: string;
  fund_id: number | null;
  type: string;
  status: string;
  channel: string | null;
  paystack_status: string | null;
  paid_at: string | null;
  metadata: string | null;
  created_at: string;
}

export interface CreatePendingInput {
  reference: string;
  email: string;
  name: string;
  amount: number;
  currency: string;
  fund_id?: number;
  type: string;
  metadata: string;
}

const COLS =
  'id, reference, email, name, amount, currency, fund_id, type, status, channel, paystack_status, paid_at, metadata, created_at';

export async function createPendingDonation(db: D1Database, d: CreatePendingInput): Promise<void> {
  await db
    .prepare(
      `INSERT INTO donations (reference, email, name, amount, currency, fund_id, type, status, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    )
    .bind(d.reference, d.email, d.name || null, d.amount, d.currency, d.fund_id ?? null, d.type, d.metadata)
    .run();
}

export async function getDonationByReference(db: D1Database, reference: string): Promise<DonationRow | null> {
  const row = await db.prepare(`SELECT ${COLS} FROM donations WHERE reference = ?`).bind(reference).first<DonationRow>();
  return row ?? null;
}

/** Idempotent: only transitions pending -> success; sets paid_at/channel once. */
export async function markDonationSuccess(
  db: D1Database,
  reference: string,
  info: { channel?: string; paystackStatus?: string; paidAt?: string },
): Promise<void> {
  await db
    .prepare(
      `UPDATE donations SET status='success', channel=?, paystack_status=?, paid_at=?
       WHERE reference=? AND status='pending'`,
    )
    .bind(info.channel ?? null, info.paystackStatus ?? 'success', info.paidAt ?? null, reference)
    .run();
}

export async function markDonationFailed(
  db: D1Database,
  reference: string,
  info: { paystackStatus?: string },
): Promise<void> {
  await db
    .prepare(`UPDATE donations SET status='failed', paystack_status=? WHERE reference=? AND status='pending'`)
    .bind(info.paystackStatus ?? 'failed', reference)
    .run();
}

export async function listDonations(
  db: D1Database,
  opts: { limit: number; offset: number; status?: string },
): Promise<DonationRow[]> {
  if (opts.status) {
    const { results } = await db
      .prepare(`SELECT ${COLS} FROM donations WHERE status=? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`)
      .bind(opts.status, opts.limit, opts.offset)
      .all<DonationRow>();
    return results;
  }
  const { results } = await db
    .prepare(`SELECT ${COLS} FROM donations ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`)
    .bind(opts.limit, opts.offset)
    .all<DonationRow>();
  return results;
}

export interface FundTotal {
  fund_id: number | null;
  fund_name: string | null;
  total: number;
  count: number;
}

export async function totalsByFund(db: D1Database): Promise<FundTotal[]> {
  const { results } = await db
    .prepare(
      `SELECT d.fund_id AS fund_id, f.name AS fund_name, SUM(d.amount) AS total, COUNT(*) AS count
       FROM donations d LEFT JOIN funds f ON f.id = d.fund_id
       WHERE d.status='success'
       GROUP BY d.fund_id ORDER BY total DESC`,
    )
    .all<FundTotal>();
  return results;
}

export async function donationTotals(db: D1Database): Promise<{ total: number; count: number }> {
  const row = await db
    .prepare(`SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS count FROM donations WHERE status='success'`)
    .first<{ total: number; count: number }>();
  return { total: row?.total ?? 0, count: row?.count ?? 0 };
}
