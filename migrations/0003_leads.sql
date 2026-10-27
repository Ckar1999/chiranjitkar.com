CREATE TABLE inquiries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  service TEXT NOT NULL,
  brief TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','closed')),
  assigned_to TEXT REFERENCES staff(id),
  source TEXT NOT NULL DEFAULT 'website',
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX inquiry_status_date ON inquiries(status,created_at DESC);
CREATE INDEX inquiry_rate_limit ON inquiries(ip_hash,created_at DESC);
