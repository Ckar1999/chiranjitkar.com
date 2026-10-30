-- Migration 0018: Foundation Architecture for Underprivileged Students
-- Private Philanthropic Initiative by Chiranjit Kar

CREATE TABLE IF NOT EXISTS foundation_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Insert default annual budget of ₹5,00,000 and launching soon status
INSERT OR IGNORE INTO foundation_settings (setting_key, setting_value, updated_at)
VALUES
  ('annual_budget', '500000', datetime('now')),
  ('financial_year', '2026-2027', datetime('now')),
  ('launch_status', 'launching_soon', datetime('now')),
  ('initiative_name', 'Chiranjit Kar Foundation', datetime('now')),
  ('initiative_motto', 'Direct Educational Assistance for Underprivileged Students', datetime('now')),
  ('contact_email', 'foundation@chiranjitkar.com', datetime('now')),
  ('contact_phone', '+91 9402369889', datetime('now'));

-- Campaign Engine: Admin can start, pause, resume or close aid campaigns at will
CREATE TABLE IF NOT EXISTS foundation_campaigns (
  id TEXT PRIMARY KEY,
  campaign_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  description TEXT NOT NULL,
  target_audience TEXT NOT NULL,
  kit_summary TEXT NOT NULL, -- e.g. 'Class 8-12 NCERT & reference books, 12 ruled notebooks, geometry set'
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'paused', 'closed'
  allocated_budget INTEGER NOT NULL DEFAULT 150000,
  max_beneficiaries INTEGER NOT NULL DEFAULT 100,
  start_date TEXT,
  end_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fnd_camp_status ON foundation_campaigns(status);

-- Seed initial high-impact campaign
INSERT OR IGNORE INTO foundation_campaigns (
  id, campaign_code, title, subtitle, description, target_audience,
  kit_summary, status, allocated_budget, max_beneficiaries, start_date, end_date, created_at, updated_at
) VALUES (
  'camp-2026-winter-exam',
  'CMP-WINTER-2026',
  'Winter 2026 Board & Secondary Exam Prep Drive',
  'Comprehensive Textbook, Exercise Notebook & Examination Stationery Kits',
  'A dedicated 100% self-funded initiative by Chiranjit Kar providing essential syllabus books, question banks, writing notebooks, and exam geometry kits directly to rural and semi-urban underprivileged students appearing for upcoming board and annual examinations.',
  'Class 8 to Class 12 Underprivileged School Students',
  'Set of prescribed textbooks/guides, 12 heavy ruled registers, complete geometry & drafting box, waterproof school bag',
  'active',
  250000,
  150,
  datetime('now'),
  datetime('now', '+60 days'),
  datetime('now'),
  datetime('now')
);

CREATE TABLE IF NOT EXISTS foundation_applications (
  id TEXT PRIMARY KEY,
  application_code TEXT NOT NULL UNIQUE,
  campaign_id TEXT REFERENCES foundation_campaigns(id),
  student_name TEXT NOT NULL,
  student_aadhaar_hash TEXT NOT NULL,
  student_aadhaar_last4 TEXT NOT NULL,
  student_dob TEXT,
  student_gender TEXT,
  class_grade TEXT NOT NULL,
  school_name TEXT NOT NULL,
  school_address TEXT NOT NULL,
  school_district TEXT NOT NULL DEFAULT 'West Tripura',
  school_state TEXT NOT NULL DEFAULT 'Tripura',
  teacher_name TEXT NOT NULL,
  teacher_designation TEXT NOT NULL,
  teacher_phone TEXT NOT NULL,
  teacher_email TEXT,
  assistance_type TEXT NOT NULL,
  specific_needs TEXT NOT NULL,
  document_url TEXT,
  document_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review', -- 'pending_review', 'verified', 'approved', 'disbursed', 'rejected'
  rejection_reason TEXT,
  review_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  application_month TEXT NOT NULL, -- Format: YYYY-MM (e.g. 2026-10)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Strict anti-scam month guard: 1 application per student Aadhaar per calendar month
CREATE UNIQUE INDEX IF NOT EXISTS idx_fnd_aadhaar_month 
ON foundation_applications(student_aadhaar_hash, application_month);

CREATE INDEX IF NOT EXISTS idx_fnd_status ON foundation_applications(status);
CREATE INDEX IF NOT EXISTS idx_fnd_campaign ON foundation_applications(campaign_id);
CREATE INDEX IF NOT EXISTS idx_fnd_school ON foundation_applications(school_name);
CREATE INDEX IF NOT EXISTS idx_fnd_created ON foundation_applications(created_at);

-- Internal Ledger: Billing & Disbursement tracking
CREATE TABLE IF NOT EXISTS foundation_disbursements (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES foundation_applications(id),
  bill_code TEXT NOT NULL UNIQUE,
  vendor_name TEXT NOT NULL,
  item_summary TEXT NOT NULL,
  amount INTEGER NOT NULL, -- in INR
  bill_date TEXT NOT NULL,
  bill_receipt_url TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fnd_disb_app ON foundation_disbursements(application_id);
CREATE INDEX IF NOT EXISTS idx_fnd_disb_date ON foundation_disbursements(created_at);
