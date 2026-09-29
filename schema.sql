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

-- One row per 60 Second Safety Check session. Saved after every answer, so partial runs show drop off.
CREATE TABLE IF NOT EXISTS quiz_sessions (
  session_id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_step INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  q1 TEXT, q2 TEXT, q3 TEXT, q4 TEXT, q5 TEXT, q6 TEXT, q7 TEXT, q8 TEXT, q9 TEXT, q10 TEXT,
  age_range TEXT,
  country TEXT,
  tags_json TEXT,
  answers_json TEXT,
  top_concerns TEXT,
  email TEXT,
  consent INTEGER NOT NULL DEFAULT 0,
  signed_up_at TEXT,
  plan_emailed INTEGER NOT NULL DEFAULT 0,
  referrer TEXT,
  utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, utm_content TEXT, utm_term TEXT,
  ip_country TEXT
);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_started ON quiz_sessions(started_at);

-- Short-lived signup attempts used for rate limiting. IPs are stored hashed and pruned after 24 hours.
CREATE TABLE IF NOT EXISTS waitlist_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_waitlist_attempts_ip ON waitlist_attempts(ip_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_waitlist_attempts_created ON waitlist_attempts(created_at);
