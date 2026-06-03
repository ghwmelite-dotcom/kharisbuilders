CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  local_ref TEXT NOT NULL UNIQUE,
  subscription_code TEXT UNIQUE,
  email_token TEXT,
  customer_code TEXT,
  customer_email TEXT NOT NULL,
  plan_id INTEGER REFERENCES plans(id) ON DELETE SET NULL,
  plan_code TEXT NOT NULL,
  amount INTEGER NOT NULL,
  interval TEXT NOT NULL,
  fund_id INTEGER REFERENCES funds(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  next_payment_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_subs_corr ON subscriptions(customer_email, plan_code);
CREATE INDEX IF NOT EXISTS idx_subs_status ON subscriptions(status);
