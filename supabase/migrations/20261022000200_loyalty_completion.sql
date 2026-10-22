-- Completes the unapplied Coins ledger. Do not apply until the owner approves.
-- Does not replace the live daily claim function or claim_promotion.
-- Does not apply 20261021000100_reward_points.sql. That file is a separate currency.
-- Check-in, deposit Coins, phone rewards, and redemption stay off.
-- Dollar wallets and VIP points are not assigned here.

INSERT INTO public.loyalty_tasks (key, coins, enabled) VALUES
  ('daily_checkin', 20, false),
  ('weekly_checkin', 100, false),
  ('monthly_checkin', 200, false)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.site_settings (key, value) VALUES
  ('legacy_freeplay_claims_enabled', 'true'::jsonb),
  ('coins_checkin_enabled', 'false'::jsonb),
  ('deposit_coins_enabled', 'false'::jsonb),
  ('deposit_coins_per_dollar', '5'::jsonb),
  ('deposit_coins_min_dollars', '1'::jsonb),
  ('deposit_coins_max_per_tx', '500'::jsonb),
  ('deposit_coins_max_per_player_month', '500'::jsonb),
  ('coins_player_month_cap', '5000'::jsonb),
  ('coins_global_budget', '30000'::jsonb),
  ('coins_redemption_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.loyalty_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id),
  kind text NOT NULL CHECK (kind IN ('daily', 'weekly', 'monthly')),
  period_key text NOT NULL,
  week_key text NOT NULL,
  month_key text NOT NULL,
  coins integer NOT NULL CHECK (coins >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, period_key)
);

ALTER TABLE public.loyalty_deposit_grants
  ADD COLUMN IF NOT EXISTS dollars numeric NOT NULL DEFAULT 0;
ALTER TABLE public.loyalty_deposit_grants
  ADD COLUMN IF NOT EXISTS reversed_coins integer NOT NULL DEFAULT 0;
ALTER TABLE public.loyalty_deposit_grants
  ADD COLUMN IF NOT EXISTS unrecovered_coins integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.loyalty_deposit_reversals (
  reversal_key text PRIMARY KEY,
  deposit_key text NOT NULL REFERENCES public.loyalty_deposit_grants (deposit_key),
  coins integer NOT NULL CHECK (coins >= 0),
  shortfall integer NOT NULL DEFAULT 0 CHECK (shortfall >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.loyalty_deposit_reversals
  ADD COLUMN IF NOT EXISTS shortfall integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.loyalty_phone_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id),
  phone_e164 text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.loyalty_verified_phones (
  phone_e164 text PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles (id),
  verified_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.loyalty_reward_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid,
  kind text NOT NULL,
  detail text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.loyalty_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_deposit_reversals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_phone_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_verified_phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_reward_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loyalty tasks read" ON public.loyalty_tasks;
CREATE POLICY "loyalty tasks read" ON public.loyalty_tasks
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "loyalty checkins read own" ON public.loyalty_checkins;
CREATE POLICY "loyalty checkins read own" ON public.loyalty_checkins
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "loyalty deposit grants read own" ON public.loyalty_deposit_grants;
CREATE POLICY "loyalty deposit grants read own" ON public.loyalty_deposit_grants
  FOR SELECT TO authenticated USING (user_id = auth.uid());
GRANT SELECT ON TABLE public.loyalty_deposit_grants TO authenticated;

REVOKE ALL ON TABLE public.loyalty_checkins FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.loyalty_deposit_reversals FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.loyalty_phone_challenges FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.loyalty_verified_phones FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.loyalty_reward_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.loyalty_checkins TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.loyalty_checkins TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.loyalty_deposit_reversals TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.loyalty_phone_challenges TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.loyalty_verified_phones TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.loyalty_reward_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.loyalty_setting_true(p_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.site_settings
    WHERE key = p_key AND (value = 'true'::jsonb OR value = '"true"'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION public.loyalty_setting_int(p_key text, p_default integer)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  raw text;
BEGIN
  SELECT trim(both '"' FROM value::text) INTO raw FROM public.site_settings WHERE key = p_key;
  IF raw IS NULL OR raw !~ '^[0-9]+$' THEN
    RETURN p_default;
  END IF;
  RETURN raw::integer;
END;
$$;

CREATE OR REPLACE FUNCTION public.loyalty_utc_periods()
RETURNS TABLE (day_key text, week_key text, month_key text)
LANGUAGE sql
STABLE
AS $$
  SELECT
    to_char((now() AT TIME ZONE 'utc')::date, 'YYYY-MM-DD'),
    to_char((now() AT TIME ZONE 'utc')::date, 'IYYY') || '-W' || to_char((now() AT TIME ZONE 'utc')::date, 'IW'),
    to_char((now() AT TIME ZONE 'utc')::date, 'YYYY-MM');
$$;

CREATE OR REPLACE FUNCTION public.loyalty_issued_coins()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    coalesce((SELECT sum(coins) FROM public.loyalty_grants), 0)
    + coalesce((SELECT sum(coins) FROM public.loyalty_checkins), 0)
    + coalesce((SELECT sum(coins - reversed_coins) FROM public.loyalty_deposit_grants), 0);
$$;

CREATE OR REPLACE FUNCTION public.loyalty_user_month_coins(p_user uuid, p_month text)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    coalesce((SELECT sum(coins) FROM public.loyalty_grants
      WHERE user_id = p_user AND to_char(created_at AT TIME ZONE 'utc', 'YYYY-MM') = p_month), 0)
    + coalesce((SELECT sum(coins) FROM public.loyalty_checkins
      WHERE user_id = p_user AND month_key = p_month), 0)
    + coalesce((SELECT sum(coins - reversed_coins) FROM public.loyalty_deposit_grants
      WHERE user_id = p_user AND to_char(created_at AT TIME ZONE 'utc', 'YYYY-MM') = p_month), 0);
$$;

CREATE OR REPLACE FUNCTION public.grant_loyalty_coins(p_user uuid, p_task text, p_event text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  task_coins integer;
  issued bigint;
  month_issued bigint;
  month_cap integer;
  grant_id uuid;
  month_key text;
BEGIN
  IF NOT public.is_service_role() AND current_setting('app.loyalty_internal', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'service role required';
  END IF;
  IF p_user IS NULL OR p_event IS NULL OR length(trim(p_event)) = 0 THEN
    RETURN 0;
  END IF;
  IF NOT public.loyalty_setting_true('coins_earning_enabled') THEN
    RETURN 0;
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user AND coalesce(is_suspended, false)) THEN
    RETURN 0;
  END IF;
  SELECT coins INTO task_coins FROM public.loyalty_tasks WHERE key = p_task AND enabled;
  IF task_coins IS NULL OR task_coins <= 0 THEN
    RETURN 0;
  END IF;

  PERFORM pg_advisory_xact_lock(81422022, 1);
  month_key := to_char((now() AT TIME ZONE 'utc')::date, 'YYYY-MM');
  month_cap := public.loyalty_setting_int('coins_player_month_cap', 5000);
  month_issued := public.loyalty_user_month_coins(p_user, month_key);
  issued := public.loyalty_issued_coins();
  IF month_issued + task_coins > month_cap OR issued + task_coins > public.loyalty_setting_int('coins_global_budget', 30000) THEN
    INSERT INTO public.loyalty_reward_attempts (user_id, kind, detail)
    VALUES (p_user, 'budget', 'Coin grant stopped at the budget');
    RETURN 0;
  END IF;

  INSERT INTO public.loyalty_grants (user_id, task_key, event_key, coins)
  VALUES (p_user, p_task, p_event, task_coins)
  ON CONFLICT DO NOTHING
  RETURNING id INTO grant_id;
  IF grant_id IS NULL THEN
    INSERT INTO public.loyalty_reward_attempts (user_id, kind, detail)
    VALUES (p_user, 'duplicate', 'Duplicate Coin grant');
    RETURN 0;
  END IF;

  PERFORM set_config('app.wallet_update', 'true', true);
  UPDATE public.profiles
     SET coins_balance = coalesce(coins_balance, 0) + task_coins
   WHERE id = p_user;
  RETURN task_coins;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_loyalty_survey(p_games text, p_source text, p_interest text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  task_coins integer;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_games NOT IN ('slots', 'fish', 'both')
     OR p_source NOT IN ('telegram', 'friend', 'search', 'other')
     OR p_interest NOT IN ('rewards', 'variety', 'support') THEN
    RAISE EXCEPTION 'Choose an answer for each question.';
  END IF;
  IF NOT public.loyalty_setting_true('coins_earning_enabled') THEN
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

  PERFORM set_config('app.loyalty_internal', 'true', true);
  IF public.grant_loyalty_coins(uid, 'welcome_survey', 'survey:' || uid::text) <= 0 THEN
    RAISE EXCEPTION 'The welcome reward budget is used up.';
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_loyalty_checkin(p_kind text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  periods record;
  task_key text;
  task_coins integer;
  needed integer := 0;
  have integer := 0;
  claim_id uuid;
  issued bigint;
  month_issued bigint;
  month_cap integer;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_kind NOT IN ('daily', 'weekly', 'monthly') THEN
    RAISE EXCEPTION 'Unknown check-in.';
  END IF;
  PERFORM pg_advisory_xact_lock(81422023, 1);
  IF public.loyalty_setting_true('legacy_freeplay_claims_enabled') AND public.loyalty_setting_true('coins_checkin_enabled') THEN
    RAISE EXCEPTION 'Freeplay and Coin check-in cannot both pay. Turn one of them off.';
  END IF;
  IF NOT public.loyalty_setting_true('coins_checkin_enabled') OR public.loyalty_setting_true('legacy_freeplay_claims_enabled') THEN
    RAISE EXCEPTION 'Coins check-in is not turned on yet.';
  END IF;
  IF NOT public.loyalty_setting_true('coins_earning_enabled') THEN
    RAISE EXCEPTION 'Coins earning is paused.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND coalesce(is_suspended, false)) THEN
    RAISE EXCEPTION 'account suspended';
  END IF;

  task_key := p_kind || '_checkin';
  SELECT coins INTO task_coins FROM public.loyalty_tasks WHERE key = task_key AND enabled;
  IF task_coins IS NULL OR task_coins <= 0 THEN
    RAISE EXCEPTION 'Coins check-in is not turned on yet.';
  END IF;

  SELECT * INTO periods FROM public.loyalty_utc_periods();
  IF p_kind = 'weekly' THEN
    needed := 5;
    SELECT count(*) INTO have FROM public.loyalty_checkins
      WHERE user_id = uid AND kind = 'daily' AND week_key = periods.week_key;
  ELSIF p_kind = 'monthly' THEN
    needed := 20;
    SELECT count(*) INTO have FROM public.loyalty_checkins
      WHERE user_id = uid AND kind = 'daily' AND month_key = periods.month_key;
  END IF;
  IF needed > 0 AND have < needed THEN
    RAISE EXCEPTION 'Keep the daily Coin check-in going. This reward needs % daily check-ins first.', needed;
  END IF;

  PERFORM pg_advisory_xact_lock(81422022, 1);
  month_cap := public.loyalty_setting_int('coins_player_month_cap', 5000);
  month_issued := public.loyalty_user_month_coins(uid, periods.month_key);
  issued := public.loyalty_issued_coins();
  IF month_issued + task_coins > month_cap OR issued + task_coins > public.loyalty_setting_int('coins_global_budget', 30000) THEN
    INSERT INTO public.loyalty_reward_attempts (user_id, kind, detail)
    VALUES (uid, 'budget', 'Check-in stopped at the budget');
    RAISE EXCEPTION 'The Coin reward budget is used up.';
  END IF;

  INSERT INTO public.loyalty_checkins (user_id, kind, period_key, week_key, month_key, coins)
  VALUES (
    uid,
    p_kind,
    CASE p_kind WHEN 'daily' THEN periods.day_key WHEN 'weekly' THEN periods.week_key ELSE periods.month_key END,
    periods.week_key,
    periods.month_key,
    task_coins
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO claim_id;
  IF claim_id IS NULL THEN
    INSERT INTO public.loyalty_reward_attempts (user_id, kind, detail)
    VALUES (uid, 'duplicate', 'Duplicate check-in');
    RETURN 0;
  END IF;

  PERFORM set_config('app.wallet_update', 'true', true);
  UPDATE public.profiles
     SET coins_balance = coalesce(coins_balance, 0) + task_coins
   WHERE id = uid;
  RETURN task_coins;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_loyalty_phone_challenge(p_user uuid, p_phone text, p_code_hash text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  challenge_id uuid;
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'service role required';
  END IF;
  IF p_phone !~ '^\+[1-9][0-9]{7,14}$' THEN
    RAISE EXCEPTION 'Enter a valid phone number.';
  END IF;
  IF p_code_hash IS NULL OR length(p_code_hash) < 16 THEN
    RAISE EXCEPTION 'Phone verification is not configured yet.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.loyalty_verified_phones WHERE user_id = p_user) THEN
    RAISE EXCEPTION 'This account already has a verified phone.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.loyalty_verified_phones
    WHERE phone_e164 = p_phone AND user_id <> p_user
  ) THEN
    RAISE EXCEPTION 'That phone number is already verified on another account. Contact support to recover it.';
  END IF;
  IF (
    SELECT count(*) FROM public.loyalty_phone_challenges
    WHERE user_id = p_user AND created_at > now() - interval '1 hour'
  ) >= 3 THEN
    RAISE EXCEPTION 'Wait before requesting another code.';
  END IF;

  INSERT INTO public.loyalty_phone_challenges (user_id, phone_e164, code_hash, expires_at)
  VALUES (p_user, p_phone, p_code_hash, now() + interval '10 minutes')
  RETURNING id INTO challenge_id;
  RETURN challenge_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_loyalty_phone(p_code_hash text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  row public.loyalty_phone_challenges%ROWTYPE;
  paid bigint;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_code_hash IS NULL OR length(p_code_hash) < 16 THEN
    RAISE EXCEPTION 'Enter the code from the text message.';
  END IF;

  SELECT * INTO row
    FROM public.loyalty_phone_challenges
   WHERE user_id = uid
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request a new code.';
  END IF;
  IF row.expires_at < now() THEN
    RAISE EXCEPTION 'That code expired. Request a new one.';
  END IF;
  IF row.attempts >= 5 THEN
    RAISE EXCEPTION 'Too many tries. Request a new code.';
  END IF;

  UPDATE public.loyalty_phone_challenges
     SET attempts = attempts + 1
   WHERE id = row.id;

  IF row.code_hash IS DISTINCT FROM p_code_hash THEN
    RAISE EXCEPTION 'That code does not match.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.loyalty_verified_phones
    WHERE phone_e164 = row.phone_e164 AND user_id <> uid
  ) THEN
    RAISE EXCEPTION 'That phone number is already verified on another account. Contact support to recover it.';
  END IF;

  INSERT INTO public.loyalty_verified_phones (phone_e164, user_id)
  VALUES (row.phone_e164, uid)
  ON CONFLICT (phone_e164) DO NOTHING;

  PERFORM set_config('app.loyalty_internal', 'true', true);
  paid := public.grant_loyalty_coins(uid, 'phone_otp', 'phone:' || uid::text);
  RETURN coalesce(paid, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_deposit_loyalty_coins(p_user uuid, p_deposit_key text, p_dollars numeric)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rate integer;
  min_dollars integer;
  max_tx integer;
  max_month integer;
  award integer;
  month_key text;
  month_coins bigint;
  issued bigint;
  grant_key text;
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'service role required';
  END IF;
  IF p_user IS NULL OR p_deposit_key IS NULL OR length(trim(p_deposit_key)) = 0 THEN
    RETURN 0;
  END IF;
  IF NOT public.loyalty_setting_true('deposit_coins_enabled') THEN
    RETURN 0;
  END IF;
  IF NOT public.loyalty_setting_true('coins_earning_enabled') THEN
    RETURN 0;
  END IF;
  IF p_dollars IS NULL OR p_dollars <= 0 THEN
    RETURN 0;
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user AND coalesce(is_suspended, false)) THEN
    RETURN 0;
  END IF;

  rate := public.loyalty_setting_int('deposit_coins_per_dollar', 5);
  min_dollars := public.loyalty_setting_int('deposit_coins_min_dollars', 1);
  max_tx := public.loyalty_setting_int('deposit_coins_max_per_tx', 500);
  max_month := public.loyalty_setting_int('deposit_coins_max_per_player_month', 500);
  IF floor(p_dollars) < min_dollars THEN
    RETURN 0;
  END IF;
  award := least(floor(p_dollars)::integer * rate, max_tx);
  IF award <= 0 THEN
    RETURN 0;
  END IF;

  PERFORM pg_advisory_xact_lock(81422022, 1);
  month_key := to_char((now() AT TIME ZONE 'utc')::date, 'YYYY-MM');
  SELECT coalesce(sum(coins - reversed_coins), 0) INTO month_coins
    FROM public.loyalty_deposit_grants
   WHERE user_id = p_user AND to_char(created_at AT TIME ZONE 'utc', 'YYYY-MM') = month_key;
  IF month_coins + award > max_month THEN
    award := max_month - month_coins;
  END IF;
  issued := public.loyalty_issued_coins();
  IF award <= 0 OR issued + award > public.loyalty_setting_int('coins_global_budget', 30000)
     OR public.loyalty_user_month_coins(p_user, month_key) + award > public.loyalty_setting_int('coins_player_month_cap', 5000) THEN
    INSERT INTO public.loyalty_reward_attempts (user_id, kind, detail)
    VALUES (p_user, 'budget', 'Deposit Coins stopped at the budget');
    RETURN 0;
  END IF;

  INSERT INTO public.loyalty_deposit_grants (deposit_key, user_id, coins, dollars)
  VALUES (p_deposit_key, p_user, award, p_dollars)
  ON CONFLICT DO NOTHING
  RETURNING deposit_key INTO grant_key;
  IF grant_key IS NULL THEN
    INSERT INTO public.loyalty_reward_attempts (user_id, kind, detail)
    VALUES (p_user, 'duplicate', 'Duplicate deposit Coins');
    RETURN 0;
  END IF;

  PERFORM set_config('app.wallet_update', 'true', true);
  UPDATE public.profiles
     SET coins_balance = coalesce(coins_balance, 0) + award
   WHERE id = p_user;
  RETURN award;
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_deposit_loyalty_coins(
  p_deposit_key text,
  p_reversal_key text,
  p_dollars numeric
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  grant_row public.loyalty_deposit_grants%ROWTYPE;
  rate integer;
  remaining integer;
  claw integer;
  recovered integer;
  shortfall integer := 0;
  balance bigint;
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'service role required';
  END IF;
  IF p_deposit_key IS NULL OR p_reversal_key IS NULL OR length(trim(p_reversal_key)) = 0 THEN
    RETURN 0;
  END IF;
  IF EXISTS (SELECT 1 FROM public.loyalty_deposit_reversals WHERE reversal_key = p_reversal_key) THEN
    RETURN 0;
  END IF;

  SELECT * INTO grant_row FROM public.loyalty_deposit_grants WHERE deposit_key = p_deposit_key FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  rate := public.loyalty_setting_int('deposit_coins_per_dollar', 5);
  remaining := grant_row.coins - grant_row.reversed_coins - coalesce(grant_row.unrecovered_coins, 0);
  IF remaining <= 0 OR p_dollars IS NULL OR p_dollars <= 0 THEN
    RETURN 0;
  END IF;
  IF grant_row.dollars > 0 AND p_dollars >= grant_row.dollars THEN
    claw := remaining;
  ELSE
    claw := least(remaining, floor(p_dollars)::integer * rate);
  END IF;
  IF claw <= 0 THEN
    RETURN 0;
  END IF;

  SELECT coalesce(coins_balance, 0) INTO balance FROM public.profiles WHERE id = grant_row.user_id FOR UPDATE;
  recovered := least(claw, greatest(balance, 0));
  shortfall := claw - recovered;
  IF shortfall > 0 THEN
    INSERT INTO public.loyalty_reward_attempts (user_id, kind, detail)
    VALUES (grant_row.user_id, 'shortfall', 'Deposit Coin reversal left ' || shortfall || ' unrecovered Coins');
  END IF;

  INSERT INTO public.loyalty_deposit_reversals (reversal_key, deposit_key, coins, shortfall)
  VALUES (p_reversal_key, p_deposit_key, recovered, shortfall);
  UPDATE public.loyalty_deposit_grants
     SET reversed_coins = reversed_coins + recovered,
         unrecovered_coins = unrecovered_coins + shortfall
   WHERE deposit_key = p_deposit_key;
  IF recovered > 0 THEN
    PERFORM set_config('app.wallet_update', 'true', true);
    UPDATE public.profiles
       SET coins_balance = greatest(coalesce(coins_balance, 0) - recovered, 0)
     WHERE id = grant_row.user_id;
  END IF;
  RETURN recovered;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_legacy_freeplay(p_rule text, p_user uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'service role required';
  END IF;
  IF p_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  PERFORM pg_advisory_xact_lock(81422023, 1);
  IF public.loyalty_setting_true('coins_checkin_enabled') AND public.loyalty_setting_true('legacy_freeplay_claims_enabled') THEN
    RAISE EXCEPTION 'Freeplay and Coin check-in cannot both pay. Turn one of them off.';
  END IF;
  IF public.loyalty_setting_true('coins_checkin_enabled') OR NOT public.loyalty_setting_true('legacy_freeplay_claims_enabled') THEN
    RAISE EXCEPTION 'The $1 freeplay check-in is turned off.';
  END IF;
  PERFORM * FROM public.claim_reward(p_rule, p_user);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.loyalty_player_flags()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'earning', public.loyalty_setting_true('coins_earning_enabled'),
    'budget_open', public.loyalty_issued_coins() < public.loyalty_setting_int('coins_global_budget', 30000),
    'checkin', public.loyalty_setting_true('coins_checkin_enabled') AND NOT public.loyalty_setting_true('legacy_freeplay_claims_enabled'),
    'legacy_freeplay', public.loyalty_setting_true('legacy_freeplay_claims_enabled') AND NOT public.loyalty_setting_true('coins_checkin_enabled'),
    'redemption', false
  );
$$;

CREATE OR REPLACE FUNCTION public.redeem_loyalty_coins(p_user uuid, p_coins bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.loyalty_reward_attempts (user_id, kind, detail)
  VALUES (p_user, 'redemption', 'Redemption refused');
  RAISE EXCEPTION 'Coin redemption is not available yet. Coins are not cash or freeplay.';
END;
$$;

CREATE OR REPLACE FUNCTION public.loyalty_admin_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  periods record;
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'service role required';
  END IF;
  SELECT * INTO periods FROM public.loyalty_utc_periods();
  RETURN jsonb_build_object(
    'issued_grants', coalesce((SELECT sum(coins) FROM public.loyalty_grants), 0),
    'issued_checkins', coalesce((SELECT sum(coins) FROM public.loyalty_checkins), 0),
    'issued_deposits', coalesce((SELECT sum(coins) FROM public.loyalty_deposit_grants), 0),
    'reversed', coalesce((SELECT sum(reversed_coins) FROM public.loyalty_deposit_grants), 0),
    'unrecovered', coalesce((SELECT sum(unrecovered_coins) FROM public.loyalty_deposit_grants), 0),
    'cap_used', public.loyalty_issued_coins(),
    'cap', public.loyalty_setting_int('coins_global_budget', 30000),
    'wallet_coins', coalesce((SELECT sum(coins_balance) FROM public.profiles), 0),
    'players', (SELECT count(*) FROM public.profiles WHERE coalesce(is_suspended, false) = false),
    'welcome_grants', (SELECT count(*) FROM public.loyalty_grants),
    'checkins_today', (SELECT count(*) FROM public.loyalty_checkins WHERE kind = 'daily' AND period_key = periods.day_key),
    'checkins_week', (SELECT count(*) FROM public.loyalty_checkins WHERE kind = 'daily' AND week_key = periods.week_key),
    'checkins_month', (SELECT count(*) FROM public.loyalty_checkins WHERE kind = 'daily' AND month_key = periods.month_key),
    'blocked_attempts', (SELECT count(*) FROM public.loyalty_reward_attempts),
    'redemption', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.loyalty_setting_true(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.loyalty_setting_int(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.loyalty_utc_periods() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.loyalty_issued_coins() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.loyalty_user_month_coins(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_loyalty_coins(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.start_loyalty_phone_challenge(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_deposit_loyalty_coins(uuid, text, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reverse_deposit_loyalty_coins(text, text, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_legacy_freeplay(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.redeem_loyalty_coins(uuid, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.loyalty_admin_summary() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.loyalty_player_flags() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.loyalty_setting_true(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.loyalty_setting_int(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.loyalty_utc_periods() TO service_role;
GRANT EXECUTE ON FUNCTION public.loyalty_issued_coins() TO service_role;
GRANT EXECUTE ON FUNCTION public.loyalty_user_month_coins(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_loyalty_coins(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.start_loyalty_phone_challenge(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_deposit_loyalty_coins(uuid, text, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.reverse_deposit_loyalty_coins(text, text, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_legacy_freeplay(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.redeem_loyalty_coins(uuid, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.loyalty_admin_summary() TO service_role;
GRANT EXECUTE ON FUNCTION public.loyalty_player_flags() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.claim_loyalty_checkin(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_loyalty_phone(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_loyalty_survey(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_loyalty_checkin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_loyalty_phone(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_loyalty_survey(text, text, text) TO authenticated;

DO $games$
BEGIN
  IF to_regclass('public.games') IS NULL THEN
    RETURN;
  END IF;
  ALTER TABLE public.games ADD COLUMN IF NOT EXISTS bonus_enabled boolean NOT NULL DEFAULT true;
  ALTER TABLE public.games ADD COLUMN IF NOT EXISTS bonus_min_deposit numeric;
  ALTER TABLE public.games ADD COLUMN IF NOT EXISTS bonus_max_amount numeric;
  ALTER TABLE public.games ADD COLUMN IF NOT EXISTS bonus_starts_at timestamptz;
  ALTER TABLE public.games ADD COLUMN IF NOT EXISTS bonus_ends_at timestamptz;
  ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_bonus_min_nonnegative;
  ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_bonus_max_nonnegative;
  ALTER TABLE public.games
    ADD CONSTRAINT games_bonus_min_nonnegative CHECK (bonus_min_deposit IS NULL OR bonus_min_deposit >= 0);
  ALTER TABLE public.games
    ADD CONSTRAINT games_bonus_max_nonnegative CHECK (bonus_max_amount IS NULL OR bonus_max_amount >= 0);
END
$games$;
