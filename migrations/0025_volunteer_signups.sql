-- Per-role "I want to serve" submissions, for staff follow-up.
CREATE TABLE IF NOT EXISTS volunteer_signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_id INTEGER,
  role_name TEXT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
