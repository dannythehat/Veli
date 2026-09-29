CREATE TABLE IF NOT EXISTS waitlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  consent INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'website',
  country TEXT,
  user_agent TEXT,
  answer TEXT,
  referrer TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist(created_at);

-- Short-lived signup attempts used for rate limiting. IPs are stored hashed and pruned after 24 hours.
CREATE TABLE IF NOT EXISTS waitlist_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_waitlist_attempts_ip ON waitlist_attempts(ip_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_waitlist_attempts_created ON waitlist_attempts(created_at);
