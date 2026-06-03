CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  interval TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GHS',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_plans_key ON plans(amount, interval, currency);
