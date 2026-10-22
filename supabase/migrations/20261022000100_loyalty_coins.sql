-- Welcome Coins ledger. Not applied to production.
-- Does not change cash, cashout, freeplay, VIP points, or existing Coins.
-- Tasks and deposit Coins stay off, so applying this file grants nothing.
-- Redemption stays disabled. 30,000 Coins is the $30 cap at 1,000 Coins = $1.

CREATE TABLE IF NOT EXISTS public.loyalty_tasks (
  key text PRIMARY KEY,
  coins integer NOT NULL CHECK (coins >= 0 AND coins <= 10000),
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.loyalty_tasks (key, coins, enabled) VALUES
  ('signup', 200, false),
  ('email_verified', 150, false),
  ('phone_otp', 150, false),
  ('kyc_approved', 300, false),
  ('telegram_member', 100, false),
  ('welcome_survey', 100, false)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.loyalty_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id),
  task_key text NOT NULL REFERENCES public.loyalty_tasks (key),
  event_key text NOT NULL UNIQUE,
  coins integer NOT NULL CHECK (coins >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, task_key)
);

CREATE TABLE IF NOT EXISTS public.loyalty_deposit_grants (
  deposit_key text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles (id),
  coins integer NOT NULL CHECK (coins >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.loyalty_survey_responses (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id),
  games text NOT NULL CHECK (games IN ('slots', 'fish', 'both')),
  source text NOT NULL CHECK (source IN ('telegram', 'friend', 'search', 'other')),
  interest text NOT NULL CHECK (interest IN ('rewards', 'variety', 'support')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.loyalty_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_deposit_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_survey_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loyalty grants read own" ON public.loyalty_grants;
CREATE POLICY "loyalty grants read own" ON public.loyalty_grants
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "loyalty survey read own" ON public.loyalty_survey_responses;
CREATE POLICY "loyalty survey read own" ON public.loyalty_survey_responses
  FOR SELECT TO authenticated USING (user_id = auth.uid());

REVOKE ALL ON TABLE public.loyalty_tasks FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.loyalty_grants FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.loyalty_deposit_grants FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.loyalty_survey_responses FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.loyalty_tasks TO authenticated;
GRANT SELECT ON TABLE public.loyalty_grants TO authenticated;
GRANT SELECT ON TABLE public.loyalty_survey_responses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.loyalty_tasks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.loyalty_grants TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.loyalty_deposit_grants TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.loyalty_survey_responses TO service_role;

CREATE OR REPLACE FUNCTION public.grant_loyalty_coins(p_user uuid, p_task text, p_event text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  task_coins integer;
  issued bigint;
  grant_id uuid;
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'service role required';
  END IF;
  IF p_user IS NULL OR p_event IS NULL OR length(trim(p_event)) = 0 THEN
    RETURN 0;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.site_settings
    WHERE key = 'coins_earning_enabled' AND (value = 'true'::jsonb OR value = '"true"'::jsonb)
  ) THEN
    RETURN 0;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user AND coalesce(is_suspended, false)
  ) THEN
    RETURN 0;
  END IF;
  SELECT coins INTO task_coins FROM public.loyalty_tasks WHERE key = p_task AND enabled;
  IF task_coins IS NULL OR task_coins <= 0 THEN
    RETURN 0;
  END IF;

  PERFORM pg_advisory_xact_lock(81422022, 1);
  SELECT coalesce(sum(coins), 0) INTO issued FROM public.loyalty_grants;
  issued := issued + coalesce((SELECT sum(coins) FROM public.loyalty_deposit_grants), 0);
  IF issued + task_coins > 30000 THEN
    RAISE EXCEPTION 'The welcome reward budget is used up.';
  END IF;

  INSERT INTO public.loyalty_grants (user_id, task_key, event_key, coins)
  VALUES (p_user, p_task, p_event, task_coins)
  ON CONFLICT DO NOTHING
  RETURNING id INTO grant_id;
  IF grant_id IS NULL THEN
    RETURN 0;
  END IF;

  PERFORM set_config('app.wallet_update', 'true', true);
  UPDATE public.profiles
     SET coins_balance = coalesce(coins_balance, 0) + task_coins
   WHERE id = p_user;
  RETURN task_coins;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_loyalty_coins(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_loyalty_coins(uuid, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.save_loyalty_survey(p_games text, p_source text, p_interest text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  task_coins integer;
  issued bigint;
  grant_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_games NOT IN ('slots', 'fish', 'both')
     OR p_source NOT IN ('telegram', 'friend', 'search', 'other')
     OR p_interest NOT IN ('rewards', 'variety', 'support') THEN
    RAISE EXCEPTION 'Choose an answer for each question.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.site_settings
    WHERE key = 'coins_earning_enabled' AND (value = 'true'::jsonb OR value = '"true"'::jsonb)
  ) THEN
    RAISE EXCEPTION 'Welcome Coins are not turned on yet.';
  END IF;
  SELECT coins INTO task_coins FROM public.loyalty_tasks WHERE key = 'welcome_survey' AND enabled;
  IF task_coins IS NULL THEN
    RAISE EXCEPTION 'Welcome Coins are not turned on yet.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND coalesce(is_suspended, false)) THEN
    RAISE EXCEPTION 'account suspended';
  END IF;

  INSERT INTO public.loyalty_survey_responses (user_id, games, source, interest)
  VALUES (uid, p_games, p_source, p_interest);

  PERFORM pg_advisory_xact_lock(81422022, 1);
  SELECT coalesce(sum(coins), 0) INTO issued FROM public.loyalty_grants;
  issued := issued + coalesce((SELECT sum(coins) FROM public.loyalty_deposit_grants), 0);
  IF issued + task_coins > 30000 THEN
    RAISE EXCEPTION 'The welcome reward budget is used up.';
  END IF;
  INSERT INTO public.loyalty_grants (user_id, task_key, event_key, coins)
  VALUES (uid, 'welcome_survey', 'survey:' || uid::text, task_coins)
  RETURNING id INTO grant_id;
  PERFORM set_config('app.wallet_update', 'true', true);
  UPDATE public.profiles
     SET coins_balance = coalesce(coins_balance, 0) + task_coins
   WHERE id = uid;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.save_loyalty_survey(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_loyalty_survey(text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.redeem_loyalty_coins(p_user uuid, p_coins bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Coin redemption is not available yet. Coins are not cash or freeplay.';
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_loyalty_coins(uuid, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_loyalty_coins(uuid, bigint) TO service_role;
