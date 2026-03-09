-- Professional Development: seminars, training, accreditation
-- Creators: CEO, Executive, Manager, Supervisor, HR, Trainer
-- Employees respond (attend / not attend); creators mark completion and issue certificate

CREATE TYPE pd_event_category AS ENUM ('seminar', 'training', 'accreditation');
CREATE TYPE pd_response_status AS ENUM ('interested', 'not_attending', 'completed');

CREATE TABLE public.pd_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  duration TEXT,
  category pd_event_category NOT NULL DEFAULT 'training',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.pd_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.pd_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status pd_response_status NOT NULL DEFAULT 'interested',
  responded_at TIMESTAMPTZ,
  marked_completed_at TIMESTAMPTZ,
  marked_completed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- Accomplishments from PD: add optional link to PD and certificate
ALTER TABLE public.accomplishments
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'experience',
  ADD COLUMN IF NOT EXISTS pd_event_id UUID REFERENCES public.pd_events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pd_response_id UUID REFERENCES public.pd_responses(id) ON DELETE SET NULL;

CREATE TABLE public.pd_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accomplishment_id UUID NOT NULL REFERENCES public.accomplishments(id) ON DELETE CASCADE,
  certificate_number TEXT NOT NULL UNIQUE,
  issued_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pd_events_created_by ON public.pd_events(created_by);
CREATE INDEX idx_pd_events_created_at ON public.pd_events(created_at DESC);
CREATE INDEX idx_pd_responses_event ON public.pd_responses(event_id);
CREATE INDEX idx_pd_responses_user ON public.pd_responses(user_id);
CREATE INDEX idx_pd_certificates_accomplishment ON public.pd_certificates(accomplishment_id);

ALTER TABLE public.pd_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pd_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pd_certificates ENABLE ROW LEVEL SECURITY;

-- Everyone can read events and responses (for listing and participation)
CREATE POLICY "pd_events select" ON public.pd_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "pd_responses select" ON public.pd_responses FOR SELECT TO authenticated USING (true);
CREATE POLICY "pd_certificates select" ON public.pd_certificates FOR SELECT TO authenticated USING (true);

-- Creators (CEO, Executive, Manager, Supervisor, HR, Trainer) can insert/update/delete their events
CREATE POLICY "pd_events insert" ON public.pd_events FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.position IN ('ceo','executive','manager','supervisor','hr','trainer')
    )
  );
CREATE POLICY "pd_events update delete" ON public.pd_events FOR ALL TO authenticated
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.position IN ('ceo','executive','manager','supervisor','hr','trainer')
    )
  );

-- Users can insert/update their own response (interested / not_attending)
CREATE POLICY "pd_responses insert" ON public.pd_responses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pd_responses update own" ON public.pd_responses FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users update own response (interested/not_attending); event creator can also update (to set completed)
CREATE POLICY "pd_responses update" ON public.pd_responses FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.pd_events e WHERE e.id = event_id AND e.created_by = auth.uid())
  )
  WITH CHECK (true);

-- Accomplishments: allow insert by event creator when adding PD accomplishment (service role or trigger would be cleaner; we'll do it from app with the creator's uid, so we need policy that allows insert when ... actually accomplishments insert is "own" only. So when we create an accomplishment for another user (the participant), we need to allow that. So: allow INSERT if user_id = auth.uid() OR (source_type = 'pd' and auth.uid() is the one who created the pd_event). Let me add a policy for that. Check 003_rls: Accomplishments insert own -> WITH CHECK (auth.uid() = user_id). So we cannot insert accomplishment for another user from client. We have two options: 1) use a Supabase function (SECURITY DEFINER) that creates accomplishment + certificate when creator marks complete; 2) add a policy that allows insert when source_type = 'pd' and the pd_event's created_by = auth.uid(). I'll add policy so creator can insert accomplishments for others when it's PD-sourced.
ALTER TABLE public.accomplishments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Accomplishments insert pd by creator"
  ON public.accomplishments FOR INSERT TO authenticated
  WITH CHECK (
    source_type = 'pd'
    AND pd_event_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.pd_events e WHERE e.id = pd_event_id AND e.created_by = auth.uid())
  );

-- pd_certificates: only creator of the event (via accomplishment's pd_event) can insert
CREATE POLICY "pd_certificates insert" ON public.pd_certificates FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = issued_by
    AND EXISTS (
      SELECT 1 FROM public.accomplishments a
      JOIN public.pd_events e ON e.id = a.pd_event_id
      WHERE a.id = accomplishment_id AND e.created_by = auth.uid()
    )
  );

COMMENT ON TABLE public.pd_events IS 'Seminars, training, accreditation created by CEO/Executive/Manager/Supervisor/HR/Trainer';
COMMENT ON TABLE public.pd_responses IS 'Employee response: interested, not_attending, or completed (set by event creator)';
COMMENT ON TABLE public.pd_certificates IS 'Certificate of completion for PD accomplishments; link from profile';
