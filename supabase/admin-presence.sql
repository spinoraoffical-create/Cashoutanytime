-- Admin presence for Telegram offline alerts.
-- Run in Supabase SQL Editor once.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_admin_last_seen
  ON profiles (last_seen_at)
  WHERE role = 'admin';

CREATE INDEX IF NOT EXISTS idx_profiles_user_last_seen
  ON profiles (last_seen_at)
  WHERE role = 'user';
