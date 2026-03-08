-- Fix "Database error saving new user" (500) on signup.
-- Prerequisite: run 001_initial_schema.sql first so public.profiles exists.
-- Then run this entire file in Supabase SQL Editor (New query → paste → Run).

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
  -- Safe read of metadata (may be null)
  pos_text := trim(COALESCE(NEW.raw_user_meta_data->>'position', ''));
  full_name_text := trim(COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  full_name_text := NULLIF(full_name_text, '');
  full_name_text := COALESCE(full_name_text, 'User');

  -- Map position by string only (no cast from user input to enum)
  user_position := CASE lower(pos_text)
    WHEN 'ceo'        THEN 'ceo'::app_role
    WHEN 'hr'         THEN 'hr'::app_role
    WHEN 'supervisor' THEN 'supervisor'::app_role
    WHEN 'tl'         THEN 'tl'::app_role
    WHEN 'trainer'    THEN 'trainer'::app_role
    WHEN 'employee'   THEN 'employee'::app_role
    ELSE 'employee'::app_role
  END;

  INSERT INTO public.profiles (id, email, full_name, position)
  VALUES (NEW.id, NEW.email, full_name_text, user_position);

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Last resort: upsert so signup never fails (handles duplicate if trigger runs twice)
    INSERT INTO public.profiles (id, email, full_name, position)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), 'User'),
      'employee'::app_role
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      full_name = COALESCE(NULLIF(EXCLUDED.full_name, 'User'), profiles.full_name),
      updated_at = now();
    RETURN NEW;
END;
$$;

-- Ensure trigger exists (drop first so we don't get duplicate trigger)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
