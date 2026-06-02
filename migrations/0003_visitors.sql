CREATE TABLE IF NOT EXISTS visitors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  visiting_service TEXT,
  type TEXT NOT NULL DEFAULT 'visitor',
  status TEXT NOT NULL DEFAULT 'new',
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'visit_form',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
