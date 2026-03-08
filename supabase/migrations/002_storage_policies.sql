-- Storage buckets and policies
-- Run after 001_initial_schema.sql
--
-- STEP: In Supabase Dashboard → Storage, create 3 buckets (if they don't exist):
--   1. avatars (public, 5MB, images)
--   2. accomplishments (public, 10MB, PDF/images)
--   3. feed-media (public, 20MB, images + video/mp4, video/webm)

-- Create buckets via SQL (optional; if this fails, create buckets in Dashboard)
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars', 'avatars', true),
  ('accomplishments', 'accomplishments', true),
  ('feed-media', 'feed-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: authenticated users can upload/read their own or public read
-- Avatars: anyone can read; only owner can upload/update/delete
CREATE POLICY "Avatar public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Avatar upload own"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Avatar update own"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Avatar delete own"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Accomplishments: same idea
CREATE POLICY "Accomplishments public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'accomplishments');

CREATE POLICY "Accomplishments upload own"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'accomplishments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Accomplishments update delete own"
  ON storage.objects FOR ALL
  USING (bucket_id = 'accomplishments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Feed media: anyone can read; authenticated can insert/update/delete own
CREATE POLICY "Feed media public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'feed-media');

CREATE POLICY "Feed media upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'feed-media' AND auth.role() = 'authenticated');

CREATE POLICY "Feed media update delete own"
  ON storage.objects FOR ALL
  USING (bucket_id = 'feed-media' AND auth.uid()::text = (storage.foldername(name))[1]);
