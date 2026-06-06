-- Per-group "I'm interested" submissions, for leader follow-up.
CREATE TABLE IF NOT EXISTS group_interests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER,
  group_name TEXT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
