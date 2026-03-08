-- Notifications: comment on your post, like on your post

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  reference_id UUID,
  from_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(user_id, read_at);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Notifications own" ON public.notifications FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Notify post owner when someone comments
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  post_owner_id UUID;
  author_name TEXT;
BEGIN
  SELECT user_id INTO post_owner_id FROM public.feed_posts WHERE id = NEW.post_id;
  IF post_owner_id IS NULL OR post_owner_id = NEW.user_id THEN RETURN NEW; END IF;
  SELECT full_name INTO author_name FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.notifications (user_id, type, title, body, reference_id, from_user_id)
  VALUES (post_owner_id, 'comment', 'New comment on your post', COALESCE(author_name, 'Someone') || ' commented on your post', NEW.post_id, NEW.user_id);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_feed_comment ON public.feed_comments;
CREATE TRIGGER on_feed_comment AFTER INSERT ON public.feed_comments FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

-- Notify post owner when someone likes
CREATE OR REPLACE FUNCTION public.notify_on_like()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  post_owner_id UUID;
  liker_name TEXT;
BEGIN
  SELECT user_id INTO post_owner_id FROM public.feed_posts WHERE id = NEW.post_id;
  IF post_owner_id IS NULL OR post_owner_id = NEW.user_id THEN RETURN NEW; END IF;
  SELECT full_name INTO liker_name FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.notifications (user_id, type, title, body, reference_id, from_user_id)
  VALUES (post_owner_id, 'like', 'New like on your post', COALESCE(liker_name, 'Someone') || ' liked your post', NEW.post_id, NEW.user_id);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_feed_like ON public.feed_likes;
CREATE TRIGGER on_feed_like AFTER INSERT ON public.feed_likes FOR EACH ROW EXECUTE FUNCTION public.notify_on_like();
