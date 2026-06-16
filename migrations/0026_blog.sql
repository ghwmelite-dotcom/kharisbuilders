-- Blog posts: Markdown body, publishing workflow, cover image stored in R2 under the blog/ prefix.
CREATE TABLE IF NOT EXISTS blog_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  author TEXT,
  category TEXT,
  tags TEXT,
  excerpt TEXT,
  body TEXT NOT NULL,
  cover_key TEXT,
  read_minutes INTEGER,
  published INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_blog_published ON blog_posts(published, published_at DESC);
