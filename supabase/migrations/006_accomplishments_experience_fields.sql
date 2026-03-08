-- Add experience-style fields to accomplishments (Title, Company, Employment type, Start/End, Location, Current role).

ALTER TABLE public.accomplishments
  ADD COLUMN IF NOT EXISTS company TEXT,
  ADD COLUMN IF NOT EXISTS employment_type TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS is_current_role BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE;
