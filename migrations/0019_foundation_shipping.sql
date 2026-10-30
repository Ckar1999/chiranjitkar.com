-- Migration 0019: Foundation Shipping & Post Tracking
ALTER TABLE foundation_applications ADD COLUMN shipping_carrier TEXT DEFAULT 'India Post';
ALTER TABLE foundation_applications ADD COLUMN tracking_number TEXT;
ALTER TABLE foundation_applications ADD COLUMN shipped_at TEXT;
ALTER TABLE foundation_applications ADD COLUMN delivered_at TEXT;
