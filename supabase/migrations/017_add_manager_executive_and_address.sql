-- Add Manager and Executive roles; add address to profiles.
-- Run after 012 (handle_new_user with approval_status).

ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'executive';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS address TEXT;

-- Update trigger to support manager and executive on signup
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
    WHEN 'executive' THEN 'executive'::app_role
    WHEN 'hr' THEN 'hr'::app_role
    WHEN 'manager' THEN 'manager'::app_role
    WHEN 'supervisor' THEN 'supervisor'::app_role
    WHEN 'tl' THEN 'tl'::app_role
    WHEN 'trainer' THEN 'trainer'::app_role
    WHEN 'employee' THEN 'employee'::app_role
    ELSE 'employee'::app_role
  END;
  INSERT INTO public.profiles (id, email, full_name, position, approval_status)
  VALUES (NEW.id, NEW.email, full_name_text, user_position, 'pending');
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    INSERT INTO public.profiles (id, email, full_name, position, approval_status)
    VALUES (NEW.id, NEW.email, COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), 'User'), 'employee'::app_role, 'pending')
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = COALESCE(NULLIF(EXCLUDED.full_name, 'User'), profiles.full_name), updated_at = now();
  RETURN NEW;
END;
$$;
