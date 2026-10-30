-- Migration 0021: Manual Aadhaar Card Image Verification & Account Approval
ALTER TABLE foundation_students ADD COLUMN aadhaar_image_url TEXT;
ALTER TABLE foundation_students ADD COLUMN aadhaar_image_name TEXT;
ALTER TABLE foundation_students ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'pending_verification'; -- 'pending_verification', 'verified', 'rejected'
ALTER TABLE foundation_students ADD COLUMN verified_by TEXT;
ALTER TABLE foundation_students ADD COLUMN verified_at TEXT;
ALTER TABLE foundation_students ADD COLUMN verification_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_fnd_stud_verif ON foundation_students(verification_status);

-- Update disbursements to be flexible across applications
CREATE TABLE IF NOT EXISTS foundation_disbursements_v2 (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  bill_code TEXT NOT NULL UNIQUE,
  vendor_name TEXT NOT NULL,
  item_summary TEXT NOT NULL,
  amount INTEGER NOT NULL,
  bill_date TEXT NOT NULL,
  bill_receipt_url TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fnd_disb_v2_app ON foundation_disbursements_v2(application_id);
