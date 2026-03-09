-- Birth date for birthdays on team calendar; allow calendar roles to read leave/rest/planned.

-- Birth date on profiles (optional, for birthday on team calendar)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_date DATE;

COMMENT ON COLUMN public.profiles.birth_date IS 'Optional; used for birthday on team calendar.';

-- Leave: allow manager and executive to read (for team calendar)
DROP POLICY IF EXISTS "Leave read as acceptor" ON public.leave_requests;
CREATE POLICY "Leave read as acceptor"
  ON public.leave_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.position IN ('ceo', 'executive', 'hr', 'manager', 'supervisor', 'tl')
    )
  );

-- Rest days: allow calendar roles to read all (for team calendar)
CREATE POLICY "Rest days read for calendar"
  ON public.profile_rest_days FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.position IN ('ceo', 'executive', 'hr', 'manager', 'supervisor', 'tl')
    )
  );

-- Planned leave: allow calendar roles to read all (for team calendar)
CREATE POLICY "Planned leave read for calendar"
  ON public.profile_planned_leave FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.position IN ('ceo', 'executive', 'hr', 'manager', 'supervisor', 'tl')
    )
  );
