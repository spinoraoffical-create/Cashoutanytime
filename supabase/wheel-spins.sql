-- Run this in Supabase SQL Editor after main schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS wheel_spins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  prize_label TEXT NOT NULL,
  prize_type TEXT NOT NULL CHECK (prize_type IN ('cash', 'luck', 'points')),
  prize_value INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wheel_spins_user_id ON wheel_spins(user_id);
CREATE INDEX IF NOT EXISTS idx_wheel_spins_created_at ON wheel_spins(created_at);

ALTER TABLE wheel_spins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own wheel spins" ON wheel_spins;
CREATE POLICY "Users can view own wheel spins"
  ON wheel_spins FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own wheel spins" ON wheel_spins;
CREATE POLICY "Users can insert own wheel spins"
  ON wheel_spins FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all wheel spins" ON wheel_spins;
CREATE POLICY "Admins can view all wheel spins"
  ON wheel_spins FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

GRANT SELECT, INSERT ON wheel_spins TO authenticated;
GRANT ALL ON wheel_spins TO service_role;
