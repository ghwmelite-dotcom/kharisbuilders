CREATE TABLE IF NOT EXISTS home_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  eyebrow TEXT,
  title TEXT NOT NULL,
  description TEXT,
  href TEXT NOT NULL,
  image_key TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);
