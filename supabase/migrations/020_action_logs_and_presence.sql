-- Action logs (Recruitment, Leave Request, Leave Allocation) for CEO/Executive.
-- Presence status (Present, Absent, On Leave) for tracking.

CREATE TABLE public.action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  details TEXT,
  reference_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_action_logs_created_at ON public.action_logs(created_at DESC);
CREATE INDEX idx_action_logs_user_id ON public.action_logs(user_id);

ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read action_logs"
  ON public.action_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated insert action_logs"
  ON public.action_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Presence: present | absent | on_leave
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS presence_status TEXT DEFAULT 'present';

COMMENT ON COLUMN public.profiles.presence_status IS 'present | absent | on_leave';
