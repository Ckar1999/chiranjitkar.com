-- Migration 0017: Agreement fee workflow and status tracking
ALTER TABLE project_agreements ADD COLUMN fee_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE project_agreements ADD COLUMN fee_paid_at TEXT;
ALTER TABLE project_agreements ADD COLUMN fee_invoice_id TEXT;

-- Index for fast lookup by fee status
CREATE INDEX IF NOT EXISTS idx_project_agreements_fee ON project_agreements(project_id, fee_status);
