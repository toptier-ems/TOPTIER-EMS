-- Applicants table for Recruitment/Hiring; storage bucket for resumes.

CREATE TYPE applicant_status AS ENUM ('initial_interview', 'training', 'final_interview');

CREATE TABLE public.applicants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  position_applied_for TEXT NOT NULL,
  age INTEGER,
  experience TEXT,
  educational_attainment TEXT,
  resume_url TEXT,
  status applicant_status NOT NULL DEFAULT 'initial_interview',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_applicants_created_at ON public.applicants(created_at DESC);
CREATE INDEX idx_applicants_status ON public.applicants(status);

ALTER TABLE public.applicants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read applicants"
  ON public.applicants FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated insert applicants"
  ON public.applicants FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated update applicants"
  ON public.applicants FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated delete applicants"
  ON public.applicants FOR DELETE
  TO authenticated
  USING (true);

-- Storage bucket for applicant resumes (PDF)
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Resumes public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'resumes');

CREATE POLICY "Resumes authenticated upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'resumes');

CREATE POLICY "Resumes authenticated update delete"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'resumes');
