CREATE TABLE IF NOT EXISTS sermon_study_guides (
  sermon_id INTEGER PRIMARY KEY REFERENCES sermons(id) ON DELETE CASCADE,
  content_hash TEXT NOT NULL,
  guide_json TEXT NOT NULL,
  generated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
