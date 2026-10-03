-- Platform-wide daily spin caps (for low win-rate algorithm)
-- Run in Supabase SQL Editor after wheel-spins.sql

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
