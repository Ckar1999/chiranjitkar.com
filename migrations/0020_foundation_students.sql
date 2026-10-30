-- Migration 0020: Foundation Permanent Student Profile & One-Time Account Registration
-- Enforces immutable Legal Name & Aadhaar, campaign-level duplicate protection

CREATE TABLE IF NOT EXISTS foundation_students (
  id TEXT PRIMARY KEY,
  aadhaar_hash TEXT NOT NULL UNIQUE,
  aadhaar_number TEXT NOT NULL, -- Stored as formatted XXXX XXXX XXXX
  aadhaar_last4 TEXT NOT NULL,
  legal_name TEXT NOT NULL, -- IMMUTABLE once created
  dob TEXT NOT NULL, -- DD/MM/YYYY (Used as login password)
  gender TEXT,
  father_guardian_name TEXT NOT NULL,
  guardian_phone TEXT NOT NULL,
  email TEXT,
  residential_address TEXT NOT NULL,
  district TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'Tripura',
  pincode TEXT NOT NULL,
  current_school_name TEXT NOT NULL,
  current_class TEXT NOT NULL,
  annual_family_income TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fnd_stud_phone ON foundation_students(guardian_phone);
CREATE INDEX IF NOT EXISTS idx_fnd_stud_school ON foundation_students(current_school_name);

-- Recreate foundation_applications with student_id foreign key & campaign duplicate guard
CREATE TABLE IF NOT EXISTS foundation_applications_v2 (
  id TEXT PRIMARY KEY,
  application_code TEXT NOT NULL UNIQUE,
  student_id TEXT NOT NULL REFERENCES foundation_students(id),
  campaign_id TEXT NOT NULL REFERENCES foundation_campaigns(id),
  academic_year TEXT NOT NULL DEFAULT '2026-2027',
  class_grade TEXT NOT NULL,
  school_name TEXT NOT NULL,
  school_address TEXT NOT NULL,
  school_district TEXT NOT NULL,
  school_state TEXT NOT NULL DEFAULT 'Tripura',
  teacher_name TEXT NOT NULL,
  teacher_designation TEXT NOT NULL,
  teacher_phone TEXT NOT NULL,
  teacher_email TEXT,
  assistance_type TEXT NOT NULL,
  specific_needs TEXT NOT NULL,
  document_url TEXT NOT NULL, -- School seal & teacher signature certificate
  document_name TEXT NOT NULL,
  shipping_carrier TEXT DEFAULT 'India Post Speed Post',
  tracking_number TEXT,
  shipped_at TEXT,
  delivered_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review', -- 'pending_review', 'verified', 'approved', 'disbursed', 'delivered', 'rejected'
  rejection_reason TEXT,
  review_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- STRICT CAMPAIGN GUARD: A student can ONLY apply ONCE per campaign!
CREATE UNIQUE INDEX IF NOT EXISTS idx_fnd_app_student_campaign 
ON foundation_applications_v2(student_id, campaign_id);

CREATE INDEX IF NOT EXISTS idx_fnd_app_v2_status ON foundation_applications_v2(status);
CREATE INDEX IF NOT EXISTS idx_fnd_app_v2_student ON foundation_applications_v2(student_id);
CREATE INDEX IF NOT EXISTS idx_fnd_app_v2_campaign ON foundation_applications_v2(campaign_id);
