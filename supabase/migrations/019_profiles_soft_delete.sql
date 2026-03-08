-- Soft delete for employees (Total Employees page).
-- When "deleted", employee is hidden from list but auth user remains.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON public.profiles(deleted_at);

COMMENT ON COLUMN public.profiles.deleted_at IS 'When set, profile is hidden from Total Employees list (soft delete).';
