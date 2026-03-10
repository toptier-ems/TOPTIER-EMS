-- PD events: location, min/max participants, banner image for event details

ALTER TABLE public.pd_events
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS min_participants INT,
  ADD COLUMN IF NOT EXISTS max_participants INT,
  ADD COLUMN IF NOT EXISTS banner_url TEXT;

COMMENT ON COLUMN public.pd_events.location IS 'Where the event takes place';
COMMENT ON COLUMN public.pd_events.min_participants IS 'Minimum number of participants';
COMMENT ON COLUMN public.pd_events.max_participants IS 'Maximum number of participants';
COMMENT ON COLUMN public.pd_events.banner_url IS 'URL of uploaded banner/image for the event';

-- Storage bucket for PD event banners
INSERT INTO storage.buckets (id, name, public)
VALUES ('pd-banners', 'pd-banners', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read PD banners
CREATE POLICY "pd-banners select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'pd-banners');

-- Creators (same roles as pd_events) can upload/update/delete in pd-banners
CREATE POLICY "pd-banners insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'pd-banners'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.position IN ('ceo','executive','manager','supervisor','hr','trainer')
    )
  );

CREATE POLICY "pd-banners update delete"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'pd-banners'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.position IN ('ceo','executive','manager','supervisor','hr','trainer')
    )
  );
