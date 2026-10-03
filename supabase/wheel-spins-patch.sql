-- ============================================================================
-- Spinora wheel — run this ENTIRE file in Supabase SQL Editor
-- Fixes: missing table, wrong table (spin_history only), missing 'points' type,
--        missing RPC, missing grants, policy re-runs
-- ============================================================================

-- Prefer pgcrypto gen_random_uuid (Supabase default)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 1. wheel_spins table (app uses THIS — not spin_history) ─────────────────
CREATE TABLE IF NOT EXISTS public.wheel_spins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  prize_label TEXT NOT NULL,
  prize_type TEXT NOT NULL DEFAULT 'luck',
  prize_value INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Allow VIP points prizes (required since wheel weights include points)
ALTER TABLE public.wheel_spins DROP CONSTRAINT IF EXISTS wheel_spins_prize_type_check;
ALTER TABLE public.wheel_spins
  ADD CONSTRAINT wheel_spins_prize_type_check
  CHECK (prize_type IN ('cash', 'luck', 'points'));

CREATE INDEX IF NOT EXISTS idx_wheel_spins_user_id ON public.wheel_spins(user_id);
CREATE INDEX IF NOT EXISTS idx_wheel_spins_created_at ON public.wheel_spins(created_at);

ALTER TABLE public.wheel_spins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own wheel spins" ON public.wheel_spins;
CREATE POLICY "Users can view own wheel spins"
  ON public.wheel_spins FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own wheel spins" ON public.wheel_spins;
CREATE POLICY "Users can insert own wheel spins"
  ON public.wheel_spins FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all wheel spins" ON public.wheel_spins;
CREATE POLICY "Admins can view all wheel spins"
  ON public.wheel_spins FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

GRANT SELECT, INSERT ON public.wheel_spins TO authenticated;
GRANT ALL ON public.wheel_spins TO service_role;

-- ── 2. Daily cap stats RPC (optional but recommended) ───────────────────────
CREATE OR REPLACE FUNCTION public.get_wheel_daily_stats()
RETURNS TABLE (
  spins_today BIGINT,
  ten_dollar_winners BIGINT,
  twenty_dollar_winners BIGINT,
  small_cash_winners BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH day AS (
    SELECT (date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS start
  )
  SELECT
    (SELECT COUNT(*)::BIGINT FROM public.wheel_spins, day WHERE created_at >= day.start),
    (SELECT COUNT(*)::BIGINT FROM public.wheel_spins, day WHERE created_at >= day.start AND prize_value = 10),
    (SELECT COUNT(*)::BIGINT FROM public.wheel_spins, day WHERE created_at >= day.start AND prize_value = 7),
    (SELECT COUNT(*)::BIGINT FROM public.wheel_spins, day
      WHERE created_at >= day.start AND prize_type = 'cash' AND prize_value BETWEEN 1 AND 4);
$$;

GRANT EXECUTE ON FUNCTION public.get_wheel_daily_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_wheel_daily_stats() TO service_role;

-- ── 3. Verify (should return ok = true) ───────────────────────────────────────
SELECT
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'wheel_spins'
  ) AS wheel_spins_exists,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_wheel_daily_stats'
  ) AS stats_rpc_exists;
