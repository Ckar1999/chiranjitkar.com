-- Migration 0022: Academic Performance Tracking, Ineligibility Guards, and Headmaster Intimation Letters

ALTER TABLE foundation_students ADD COLUMN academic_standing TEXT NOT NULL DEFAULT 'eligible'; -- 'eligible', 'probation', 'ineligible_poor_performance'
ALTER TABLE foundation_students ADD COLUMN academic_standing_notes TEXT;

CREATE TABLE IF NOT EXISTS foundation_academic_records (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  exam_term TEXT NOT NULL, -- 'Unit Test 1', 'Half-Yearly Exam', 'Annual Exam', 'Pre-Board', etc.
  percentage REAL,
  grade TEXT,
  marksheet_url TEXT,
  marksheet_name TEXT,
  teacher_remarks TEXT,
  performance_rating TEXT NOT NULL DEFAULT 'good', -- 'exemplary', 'good', 'satisfactory', 'poor'
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fnd_acad_student ON foundation_academic_records(student_id);

CREATE TABLE IF NOT EXISTS foundation_school_letters (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  letter_code TEXT NOT NULL UNIQUE,
  school_name TEXT NOT NULL,
  headmaster_or_teacher TEXT NOT NULL,
  letter_content TEXT NOT NULL,
  dispatch_carrier TEXT DEFAULT 'India Post Speed Post',
  dispatch_tracking TEXT,
  parent_notified_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fnd_ltr_app ON foundation_school_letters(application_id);
CREATE INDEX IF NOT EXISTS idx_fnd_ltr_stud ON foundation_school_letters(student_id);

ALTER TABLE foundation_applications_v2 ADD COLUMN headmaster_letter_id TEXT;
ALTER TABLE foundation_applications_v2 ADD COLUMN headmaster_letter_status TEXT NOT NULL DEFAULT 'pending_generation';
ALTER TABLE foundation_applications_v2 ADD COLUMN parent_notification_status TEXT NOT NULL DEFAULT 'pending';
