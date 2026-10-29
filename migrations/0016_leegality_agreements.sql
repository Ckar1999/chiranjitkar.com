CREATE TABLE IF NOT EXISTS project_agreements (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  agreement_type TEXT NOT NULL CHECK (agreement_type IN ('master_paid', 'master_collab')),
  contract_code TEXT NOT NULL,
  leegality_document_id TEXT,
  leegality_sign_url TEXT,
  estamp_number TEXT NOT NULL DEFAULT 'IN-DL22366535014840X',
  documentation_fee INTEGER NOT NULL DEFAULT 99,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'signed', 'rejected', 'expired')),
  signer_name TEXT NOT NULL,
  signer_email TEXT NOT NULL,
  signer_phone TEXT NOT NULL DEFAULT '',
  signed_at TEXT,
  signed_pdf_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_agreements_project ON project_agreements(project_id, status);
CREATE INDEX IF NOT EXISTS idx_project_agreements_document ON project_agreements(leegality_document_id);
