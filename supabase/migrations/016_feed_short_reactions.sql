-- Reactions (like, love, haha, wow, sad, angry) on My Day shorts.

CREATE TABLE IF NOT EXISTS public.feed_short_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id UUID NOT NULL REFERENCES public.feed_shorts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'love', 'haha', 'wow', 'sad', 'angry')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(short_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_feed_short_reactions_short ON public.feed_short_reactions(short_id);

ALTER TABLE public.feed_short_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Short reactions read all"
  ON public.feed_short_reactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Short reactions insert own"
  ON public.feed_short_reactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Short reactions update delete own"
  ON public.feed_short_reactions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Leveling: +1 point for reacting to a short (who reacted gets the point)
CREATE OR REPLACE FUNCTION public.add_feed_points_on_short_reaction()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET feed_points = COALESCE(feed_points, 0) + 1 WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_feed_short_reaction_points ON public.feed_short_reactions;
CREATE TRIGGER on_feed_short_reaction_points AFTER INSERT ON public.feed_short_reactions FOR EACH ROW EXECUTE FUNCTION public.add_feed_points_on_short_reaction();
