-- Shorts (My Day style): short videos at top of feed, max 50MB, auto-remove after 24h.

CREATE TABLE IF NOT EXISTS public.feed_shorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feed_shorts_created ON public.feed_shorts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_shorts_user ON public.feed_shorts(user_id);

ALTER TABLE public.feed_shorts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Feed shorts read all"
  ON public.feed_shorts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Feed shorts insert own"
  ON public.feed_shorts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Feed shorts delete own"
  ON public.feed_shorts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- CEO can delete any short
CREATE POLICY "Feed shorts delete as CEO"
  ON public.feed_shorts FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.position = 'ceo')
  );

-- Leveling: +5 points for posting a short
CREATE OR REPLACE FUNCTION public.add_feed_points_on_short()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET feed_points = COALESCE(feed_points, 0) + 5 WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_feed_short_points ON public.feed_shorts;
CREATE TRIGGER on_feed_short_points AFTER INSERT ON public.feed_shorts FOR EACH ROW EXECUTE FUNCTION public.add_feed_points_on_short();

-- Remove shorts older than 24 hours (call from app on feed load or schedule via pg_cron)
CREATE OR REPLACE FUNCTION public.cleanup_old_feed_shorts()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE deleted_count integer;
BEGIN
  WITH deleted AS (
    DELETE FROM public.feed_shorts
    WHERE created_at < now() - interval '24 hours'
    RETURNING id
  )
  SELECT count(*)::integer INTO deleted_count FROM deleted;
  RETURN deleted_count;
END;
$$;

-- Allow authenticated to run cleanup (no harm, only deletes old rows)
GRANT EXECUTE ON FUNCTION public.cleanup_old_feed_shorts() TO authenticated;
