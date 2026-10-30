-- Migration 0023: Restrict to Government Schools Only & Last Year Marksheet Requirement on Campaign Application

ALTER TABLE foundation_students ADD COLUMN school_type TEXT NOT NULL DEFAULT 'govt_school'; -- 'govt_school', 'govt_aided_school'

ALTER TABLE foundation_applications_v2 ADD COLUMN school_type TEXT NOT NULL DEFAULT 'govt_school';
ALTER TABLE foundation_applications_v2 ADD COLUMN last_year_percentage REAL;
ALTER TABLE foundation_applications_v2 ADD COLUMN last_year_grade TEXT;
ALTER TABLE foundation_applications_v2 ADD COLUMN last_year_marksheet_url TEXT;
ALTER TABLE foundation_applications_v2 ADD COLUMN last_year_marksheet_name TEXT;
ALTER TABLE foundation_applications_v2 ADD COLUMN info_accuracy_confirmed INTEGER NOT NULL DEFAULT 1;
