export interface SubscriptionRow {
  id: number;
  local_ref: string;
  subscription_code: string | null;
  email_token: string | null;
  customer_code: string | null;
  customer_email: string;
  plan_id: number | null;
  plan_code: string;
  amount: number;
  interval: string;
  fund_id: number | null;
  status: string;
  next_payment_at: string | null;
}

const COLS =
  'id, local_ref, subscription_code, email_token, customer_code, customer_email, plan_id, plan_code, amount, interval, fund_id, status, next_payment_at';

export interface CreatePendingSubInput {
  local_ref: string;
  customer_email: string;
  plan_id: number | null;
  plan_code: string;
  amount: number;
  interval: string;
  fund_id?: number | null;
}

export async function createPendingSubscription(db: D1Database, s: CreatePendingSubInput): Promise<number> {
  const r = await db
    .prepare(
      `INSERT INTO subscriptions (local_ref, customer_email, plan_id, plan_code, amount, interval, fund_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    )
    .bind(s.local_ref, s.customer_email, s.plan_id ?? null, s.plan_code, s.amount, s.interval, s.fund_id ?? null)
    .run();
  return Number(r.meta.last_row_id);
}

export interface ActivateInput {
  customerEmail: string;
  planCode: string;
  subscriptionCode: string;
  emailToken?: string;
  customerCode?: string;
  nextPaymentAt?: string | null;
}

/**
 * Correlate a Paystack subscription to our pending row by (email, plan_code) and activate it.
 * If no pending row exists, insert an unattributed active subscription (fund_id null) so its
 * charges still record. Idempotent: a second call for the same subscription_code is a no-op.
 */
export async function activateSubscription(db: D1Database, a: ActivateInput): Promise<void> {
  const already = await db
    .prepare('SELECT id FROM subscriptions WHERE subscription_code=?')
    .bind(a.subscriptionCode)
    .first<{ id: number }>();
  if (already) return;

  const pending = await db
    .prepare(
      "SELECT id FROM subscriptions WHERE customer_email=? AND plan_code=? AND status='pending' AND subscription_code IS NULL ORDER BY id DESC LIMIT 1",
    )
    .bind(a.customerEmail, a.planCode)
    .first<{ id: number }>();

  if (pending) {
    await db
      .prepare(
        `UPDATE subscriptions SET subscription_code=?, email_token=?, customer_code=?, next_payment_at=?,
          status='active', updated_at=datetime('now') WHERE id=?`,
      )
      .bind(a.subscriptionCode, a.emailToken ?? null, a.customerCode ?? null, a.nextPaymentAt ?? null, pending.id)
      .run();
    return;
  }

  await db
    .prepare(
      `INSERT INTO subscriptions (local_ref, subscription_code, email_token, customer_code, customer_email, plan_code, amount, interval, fund_id, status, next_payment_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, '', NULL, 'active', ?)`,
    )
    .bind(
      `auto_${a.subscriptionCode}`,
      a.subscriptionCode,
      a.emailToken ?? null,
      a.customerCode ?? null,
      a.customerEmail,
      a.planCode,
      a.nextPaymentAt ?? null,
    )
    .run();
}

export async function getSubscriptionByCode(db: D1Database, code: string): Promise<SubscriptionRow | null> {
  const row = await db
    .prepare(`SELECT ${COLS} FROM subscriptions WHERE subscription_code=?`)
    .bind(code)
    .first<SubscriptionRow>();
  return row ?? null;
}

export async function getActiveSubscriptionForCharge(
  db: D1Database,
  q: { customerEmail: string; planCode: string },
): Promise<SubscriptionRow | null> {
  const row = await db
    .prepare(
      `SELECT ${COLS} FROM subscriptions WHERE customer_email=? AND plan_code=? AND status='active' ORDER BY id DESC LIMIT 1`,
    )
    .bind(q.customerEmail, q.planCode)
    .first<SubscriptionRow>();
  return row ?? null;
}

export async function setSubscriptionStatus(db: D1Database, code: string, status: string): Promise<void> {
  await db
    .prepare("UPDATE subscriptions SET status=?, updated_at=datetime('now') WHERE subscription_code=?")
    .bind(status, code)
    .run();
}

export async function setNextPayment(db: D1Database, code: string, at: string): Promise<void> {
  await db
    .prepare("UPDATE subscriptions SET next_payment_at=?, updated_at=datetime('now') WHERE subscription_code=?")
    .bind(at, code)
    .run();
}

export async function listSubscriptions(db: D1Database, opts: { status?: string }): Promise<SubscriptionRow[]> {
  if (opts.status) {
    const { results } = await db
      .prepare(`SELECT ${COLS} FROM subscriptions WHERE status=? ORDER BY id DESC`)
      .bind(opts.status)
      .all<SubscriptionRow>();
    return results;
  }
  const { results } = await db.prepare(`SELECT ${COLS} FROM subscriptions ORDER BY id DESC`).all<SubscriptionRow>();
  return results;
}
