CREATE TABLE IF NOT EXISTS waitlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  consent INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'website',
  country TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist(created_at);
