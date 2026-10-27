CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  picture TEXT NOT NULL DEFAULT '',
  google_sub TEXT UNIQUE,
  phone TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS client_sessions (
  token_hash TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS clients_google_sub ON clients(google_sub);
CREATE INDEX IF NOT EXISTS client_sessions_token ON client_sessions(token_hash, expires_at);
