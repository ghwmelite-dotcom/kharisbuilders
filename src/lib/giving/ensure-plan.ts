import { getPlanByKey, insertPlan } from '../db/plans';
import { createPlan } from '../paystack/client';
import { fromMinorUnits } from './money';

export type EnsurePlanResult = { ok: true; planCode: string; planId: number } | { ok: false; error: string };

const INTERVAL_LABEL: Record<string, string> = { weekly: 'Weekly', monthly: 'Monthly', annually: 'Annual' };

/** Return a Paystack plan code for (amount, interval, currency), creating + caching it on a miss. */
export async function ensurePlan(
  db: D1Database,
  key: { amount: number; interval: string; currency: string },
  cfg: { secret: string; fetchFn?: typeof fetch },
): Promise<EnsurePlanResult> {
  const cached = await getPlanByKey(db, key.amount, key.interval, key.currency);
  if (cached) return { ok: true, planCode: cached.plan_code, planId: cached.id };

  const label = INTERVAL_LABEL[key.interval] ?? key.interval;
  const name = `Kharis ${label} ${key.currency} ${fromMinorUnits(key.amount).toFixed(2)}`;
  const created = await createPlan({ name, amount: key.amount, interval: key.interval, currency: key.currency }, cfg);
  if (!created.ok) return { ok: false, error: created.error };

  const planId = await insertPlan(db, {
    plan_code: created.planCode,
    name,
    amount: key.amount,
    interval: key.interval,
    currency: key.currency,
  });
  return { ok: true, planCode: created.planCode, planId };
}
