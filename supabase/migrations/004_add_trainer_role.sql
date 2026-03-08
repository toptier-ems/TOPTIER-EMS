-- Add Trainer role to existing databases that already ran 001 without it.
-- Run this in Supabase SQL Editor if your app_role enum was created before trainer was added.

ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'trainer';
