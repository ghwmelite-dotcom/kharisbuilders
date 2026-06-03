export interface PlanRow {
  id: number;
  plan_code: string;
  name: string;
  amount: number;
  interval: string;
  currency: string;
}

export interface InsertPlanInput {
  plan_code: string;
  name: string;
  amount: number;
  interval: string;
  currency: string;
}

const COLS = 'id, plan_code, name, amount, interval, currency';

export async function insertPlan(db: D1Database, p: InsertPlanInput): Promise<number> {
  const r = await db
    .prepare('INSERT INTO plans (plan_code, name, amount, interval, currency) VALUES (?, ?, ?, ?, ?)')
    .bind(p.plan_code, p.name, p.amount, p.interval, p.currency)
    .run();
  return Number(r.meta.last_row_id);
}

export async function getPlanByKey(
  db: D1Database,
  amount: number,
  interval: string,
  currency: string,
): Promise<PlanRow | null> {
  const row = await db
    .prepare(`SELECT ${COLS} FROM plans WHERE amount=? AND interval=? AND currency=?`)
    .bind(amount, interval, currency)
    .first<PlanRow>();
  return row ?? null;
}

export async function getPlanByCode(db: D1Database, code: string): Promise<PlanRow | null> {
  const row = await db.prepare(`SELECT ${COLS} FROM plans WHERE plan_code=?`).bind(code).first<PlanRow>();
  return row ?? null;
}
