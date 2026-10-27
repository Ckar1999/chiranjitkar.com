CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  assigned_to TEXT REFERENCES staff(id),
  due_at TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','blocked','done')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  created_by TEXT NOT NULL REFERENCES staff(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES sessions(id),
  invoice_code TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('package','overtime','add_on','adjustment')),
  description TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  amount_paid INTEGER NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','partially_paid','paid','void')),
  due_at TEXT,
  payment_url TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL REFERENCES staff(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE deliveries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL REFERENCES staff(id),
  created_at TEXT NOT NULL
);

CREATE TABLE client_feedback (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('selection','revision','approval','testimonial')),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX tasks_assignee_status_due ON tasks(assigned_to,status,due_at);
CREATE INDEX invoices_project_status ON invoices(project_id,status);
CREATE INDEX deliveries_project_date ON deliveries(project_id,created_at DESC);
