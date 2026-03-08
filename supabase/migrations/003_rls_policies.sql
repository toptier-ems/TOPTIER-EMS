-- RLS policies for public tables
-- Run after 002_storage_policies.sql

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accomplishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_comments ENABLE ROW LEVEL SECURITY;

-- Profiles: everyone can read; only own row can update
CREATE POLICY "Profiles read all"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Profiles update own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Accomplishments: read all; insert/update/delete own
CREATE POLICY "Accomplishments read all"
  ON public.accomplishments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Accomplishments insert own"
  ON public.accomplishments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Accomplishments update delete own"
  ON public.accomplishments FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Leave: users see own; acceptors (ceo, hr, supervisor, tl) see pending + can update
CREATE POLICY "Leave read own"
  ON public.leave_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Leave read as acceptor"
  ON public.leave_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.position IN ('ceo', 'hr', 'supervisor', 'tl')
    )
  );

CREATE POLICY "Leave insert own"
  ON public.leave_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Leave update as acceptor"
  ON public.leave_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.position IN ('ceo', 'hr', 'supervisor', 'tl')
    )
  )
  WITH CHECK (true);

-- Feed: read all posts; insert/update/delete own
CREATE POLICY "Feed posts read all"
  ON public.feed_posts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Feed posts insert own"
  ON public.feed_posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Feed posts update delete own"
  ON public.feed_posts FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Likes: read all; insert/delete own
CREATE POLICY "Feed likes read all"
  ON public.feed_likes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Feed likes insert own"
  ON public.feed_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Feed likes delete own"
  ON public.feed_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Comments: read all; insert/update/delete own
CREATE POLICY "Feed comments read all"
  ON public.feed_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Feed comments insert own"
  ON public.feed_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Feed comments update delete own"
  ON public.feed_comments FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);
