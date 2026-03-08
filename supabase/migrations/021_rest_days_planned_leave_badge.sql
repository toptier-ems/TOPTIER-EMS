-- Rest days, planned leave (advance status), employee badge, default absent.

-- Default presence to absent when not set
ALTER TABLE public.profiles
  ALTER COLUMN presence_status SET DEFAULT 'absent';

UPDATE public.profiles SET presence_status = 'absent' WHERE presence_status IS NULL;

-- Rest days: specific dates user marks as rest day
CREATE TABLE IF NOT EXISTS public.profile_rest_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rest_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, rest_date)
);

CREATE INDEX idx_profile_rest_days_user_date ON public.profile_rest_days(user_id, rest_date);

ALTER TABLE public.profile_rest_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rest days own" ON public.profile_rest_days FOR ALL TO authenticated
  USING (auth.uid() = user_id);

-- Planned leave: advance date ranges so user is "on leave" without toggling
CREATE TABLE IF NOT EXISTS public.profile_planned_leave (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_planned_dates CHECK (end_date >= start_date)
);

CREATE INDEX idx_profile_planned_leave_user ON public.profile_planned_leave(user_id);

ALTER TABLE public.profile_planned_leave ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Planned leave own" ON public.profile_planned_leave FOR ALL TO authenticated
  USING (auth.uid() = user_id);

-- Employee badge/title (assigned by CEO/HR)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS employee_badge TEXT;

COMMENT ON COLUMN public.profiles.employee_badge IS 'e.g. best_employee, best_teacher, rising_star, no_absences, no_lates, most_improved';
