-- Small groups (life groups / home groups) shown on the public finder.
CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  day TEXT,
  time TEXT,
  location TEXT,
  format TEXT NOT NULL DEFAULT 'in_person',
  audience TEXT NOT NULL DEFAULT 'everyone',
  leader TEXT,
  image_key TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);
