-- Volunteer roles shown on the public /serve opportunity board.
CREATE TABLE IF NOT EXISTS volunteer_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  area TEXT NOT NULL DEFAULT 'general',
  commitment TEXT NOT NULL DEFAULT 'as_needed',
  schedule TEXT,
  requirements TEXT,
  leader TEXT,
  image_key TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);
