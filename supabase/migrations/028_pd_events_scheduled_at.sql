-- Add date and time for PD events so participants know when the event is

ALTER TABLE public.pd_events
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

COMMENT ON COLUMN public.pd_events.scheduled_at IS 'Date and time when the seminar/training/accreditation takes place';
