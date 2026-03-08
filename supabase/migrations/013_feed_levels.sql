-- Feed leveling: points from posts, comments, likes. Level 1-100 (100 pts per level).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS feed_points INTEGER NOT NULL DEFAULT 0;

-- Points: post +10, comment +3, like +1
CREATE OR REPLACE FUNCTION public.add_feed_points_on_post()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET feed_points = COALESCE(feed_points, 0) + 10 WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_feed_post_points ON public.feed_posts;
CREATE TRIGGER on_feed_post_points AFTER INSERT ON public.feed_posts FOR EACH ROW EXECUTE FUNCTION public.add_feed_points_on_post();

CREATE OR REPLACE FUNCTION public.add_feed_points_on_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET feed_points = COALESCE(feed_points, 0) + 3 WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_feed_comment_points ON public.feed_comments;
CREATE TRIGGER on_feed_comment_points AFTER INSERT ON public.feed_comments FOR EACH ROW EXECUTE FUNCTION public.add_feed_points_on_comment();

CREATE OR REPLACE FUNCTION public.add_feed_points_on_like()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET feed_points = COALESCE(feed_points, 0) + 1 WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_feed_like_points ON public.feed_likes;
CREATE TRIGGER on_feed_like_points AFTER INSERT ON public.feed_likes FOR EACH ROW EXECUTE FUNCTION public.add_feed_points_on_like();
