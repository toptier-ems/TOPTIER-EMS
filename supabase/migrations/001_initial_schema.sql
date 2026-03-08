-- TopTier EMS - Initial schema
-- Run this in Supabase SQL Editor first.

-- Position/role enum
CREATE TYPE app_role AS ENUM ('ceo', 'hr', 'supervisor', 'tl', 'trainer', 'employee');

-- Leave type enum
CREATE TYPE leave_type AS ENUM ('emergency', 'vacation', 'sick');

-- Leave status enum
CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'rejected');

-- Profiles: one per auth user, stores role and display info
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  position app_role NOT NULL DEFAULT 'employee',
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Accomplishments for profile (PDF export)
CREATE TABLE public.accomplishments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  achieved_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Leave requests
CREATE TABLE public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  leave_type leave_type NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status leave_status NOT NULL DEFAULT 'pending',
  accepted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_dates CHECK (end_date >= start_date)
);

-- Feed posts (social)
CREATE TABLE public.feed_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT,
  media_url TEXT,
  media_type TEXT, -- 'image' | 'video'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Post likes
CREATE TABLE public.feed_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Post comments
CREATE TABLE public.feed_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_profiles_position ON public.profiles(position);
CREATE INDEX idx_leave_requests_user ON public.leave_requests(user_id);
CREATE INDEX idx_leave_requests_status ON public.leave_requests(status);
CREATE INDEX idx_feed_posts_created ON public.feed_posts(created_at DESC);
CREATE INDEX idx_feed_likes_post ON public.feed_likes(post_id);
CREATE INDEX idx_feed_comments_post ON public.feed_comments(post_id);

-- Trigger: create profile on signup (position from metadata, no enum cast = no 500)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_position app_role := 'employee';
  pos_text text;
  full_name_text text;
BEGIN
  pos_text := trim(COALESCE(NEW.raw_user_meta_data->>'position', ''));
  full_name_text := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), 'User');
  user_position := CASE lower(pos_text)
    WHEN 'ceo' THEN 'ceo'::app_role
    WHEN 'hr' THEN 'hr'::app_role
    WHEN 'supervisor' THEN 'supervisor'::app_role
    WHEN 'tl' THEN 'tl'::app_role
    WHEN 'trainer' THEN 'trainer'::app_role
    WHEN 'employee' THEN 'employee'::app_role
    ELSE 'employee'::app_role
  END;
  INSERT INTO public.profiles (id, email, full_name, position)
  VALUES (NEW.id, NEW.email, full_name_text, user_position);
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    INSERT INTO public.profiles (id, email, full_name, position)
    VALUES (NEW.id, NEW.email, COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), 'User'), 'employee'::app_role)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = COALESCE(NULLIF(EXCLUDED.full_name, 'User'), profiles.full_name), updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Allow auth to read role for custom claims if needed (optional)
COMMENT ON TABLE public.profiles IS 'One row per user; position = app_role for privileges';
