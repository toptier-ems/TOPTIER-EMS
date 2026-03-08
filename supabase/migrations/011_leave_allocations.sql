-- Leave allocation per employee per year (HR/CEO only)

CREATE TABLE IF NOT EXISTS public.leave_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year INT NOT NULL,
  vacation_days INT NOT NULL DEFAULT 0,
  sick_days INT NOT NULL DEFAULT 0,
  emergency_days INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, year)
);

CREATE INDEX IF NOT EXISTS idx_leave_allocations_user_year ON public.leave_allocations(user_id, year);

ALTER TABLE public.leave_allocations ENABLE ROW LEVEL SECURITY;

-- Only HR and CEO can manage; all authenticated can read own
CREATE POLICY "Leave allocations read own" ON public.leave_allocations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Leave allocations read hr ceo" ON public.leave_allocations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND position IN ('hr', 'ceo')));
CREATE POLICY "Leave allocations insert hr ceo" ON public.leave_allocations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND position IN ('hr', 'ceo')));
CREATE POLICY "Leave allocations update hr ceo" ON public.leave_allocations FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND position IN ('hr', 'ceo')));
CREATE POLICY "Leave allocations delete hr ceo" ON public.leave_allocations FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND position IN ('hr', 'ceo')));
