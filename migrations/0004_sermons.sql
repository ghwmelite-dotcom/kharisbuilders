CREATE TABLE IF NOT EXISTS sermons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  speaker TEXT,
  series TEXT,
  scripture_ref TEXT,
  video_url TEXT NOT NULL,
  video_provider TEXT NOT NULL DEFAULT 'youtube',
  thumbnail_key TEXT,
  description TEXT,
  sermon_date TEXT,
  published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);
