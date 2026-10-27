CREATE TABLE studio_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_by TEXT REFERENCES staff(id),
  updated_at TEXT NOT NULL
);
