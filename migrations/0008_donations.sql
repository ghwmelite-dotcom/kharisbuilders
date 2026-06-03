CREATE TABLE IF NOT EXISTS donations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GHS',
  fund_id INTEGER REFERENCES funds(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'one_time',
  status TEXT NOT NULL DEFAULT 'pending',
  channel TEXT,
  paystack_status TEXT,
  paid_at TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);
CREATE INDEX IF NOT EXISTS idx_donations_fund ON donations(fund_id);
CREATE INDEX IF NOT EXISTS idx_donations_created ON donations(created_at);
