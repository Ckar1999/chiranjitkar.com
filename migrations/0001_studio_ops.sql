PRAGMA foreign_keys = ON;

CREATE TABLE staff (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','sales','photographer','filmmaker','editor')),
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  project_code TEXT NOT NULL UNIQUE,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT NOT NULL DEFAULT '',
  service TEXT NOT NULL,
  package_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'lead' CHECK (status IN ('lead','confirmed','preproduction','scheduled','in_session','editing','client_review','delivered','archived')),
  shoot_at TEXT,
  location TEXT NOT NULL DEFAULT '',
  brief TEXT NOT NULL DEFAULT '',
  booked_minutes INTEGER NOT NULL DEFAULT 180 CHECK (booked_minutes > 0),
  grace_minutes INTEGER NOT NULL DEFAULT 30 CHECK (grace_minutes = 30),
  overtime_step_minutes INTEGER NOT NULL DEFAULT 30 CHECK (overtime_step_minutes = 30),
  overtime_rate INTEGER NOT NULL DEFAULT 0 CHECK (overtime_rate >= 0),
  package_price INTEGER NOT NULL DEFAULT 0 CHECK (package_price >= 0),
  deposit_amount INTEGER NOT NULL DEFAULT 0 CHECK (deposit_amount >= 0),
  client_key_hash TEXT NOT NULL,
  selection_due_at TEXT,
  delivery_due_at TEXT,
  created_by TEXT NOT NULL REFERENCES staff(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE assignments (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  staff_id TEXT NOT NULL REFERENCES staff(id),
  assignment TEXT NOT NULL,
  assigned_at TEXT NOT NULL,
  PRIMARY KEY(project_id, staff_id, assignment)
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  elapsed_minutes INTEGER,
  overtime_minutes INTEGER,
  overtime_units INTEGER,
  overtime_fee INTEGER,
  start_approved_by_client INTEGER NOT NULL DEFAULT 1,
  end_approved_by_client INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','complete')),
  created_by TEXT NOT NULL REFERENCES staff(id)
);

CREATE TABLE otp_challenges (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES sessions(id),
  kind TEXT NOT NULL CHECK (kind IN ('start','end')),
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE activity (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES staff(id),
  event TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE login_attempts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE,
  attempted_at TEXT NOT NULL,
  succeeded INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE staff_sessions (
  token_hash TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX projects_status_date ON projects(status, shoot_at);
CREATE INDEX activity_project_date ON activity(project_id, created_at DESC);
CREATE INDEX otp_expiry ON otp_challenges(project_id, kind, expires_at);
CREATE INDEX login_attempt_rate ON login_attempts(email, attempted_at);
