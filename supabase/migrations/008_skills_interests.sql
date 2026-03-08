-- Skills and interests per user (profile page)

CREATE TABLE IF NOT EXISTS public.skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skills_user ON public.skills(user_id);
CREATE INDEX IF NOT EXISTS idx_interests_user ON public.interests(user_id);

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Skills read all" ON public.skills FOR SELECT TO authenticated USING (true);
CREATE POLICY "Skills insert own" ON public.skills FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Skills delete own" ON public.skills FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Interests read all" ON public.interests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Interests insert own" ON public.interests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Interests delete own" ON public.interests FOR DELETE TO authenticated USING (auth.uid() = user_id);
