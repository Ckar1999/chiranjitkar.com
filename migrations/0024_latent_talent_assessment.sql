-- Migration 0024: Nurturing Raw Talent & Curiosity Over Exam Scores

ALTER TABLE foundation_applications_v2 ADD COLUMN latent_talent TEXT; -- 'science_curiosity', 'math_logic', 'art_creative', 'reading_language', 'determined_learner'
ALTER TABLE foundation_applications_v2 ADD COLUMN talent_notes TEXT; -- Teacher note on the child's raw spark and how lack of resources held them back
