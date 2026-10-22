CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Account close and Coin fraud guards.
-- Do not apply until the owner approves. This does not delete live rows.
-- Empty accounts can be deleted. Accounts with money, KYC, or reward history
-- are deactivated and anonymized. Grant rows stay, so welcome rewards are not reopened.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text;

CREATE TABLE IF NOT EXISTS public.fraud_scores (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  risk_score smallint NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  blocked boolean NOT NULL DEFAULT false,
  rewards_blocked boolean NOT NULL DEFAULT false,
  manual_review boolean NOT NULL DEFAULT false,
  last_calculated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.loyalty_identity_locks (
  identity_hash text NOT NULL,
  task_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (identity_hash, task_key)
);

ALTER TABLE public.loyalty_identity_locks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.loyalty_identity_locks FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.loyalty_identity_locks TO service_role;

CREATE OR REPLACE FUNCTION public.loyalty_email_hash(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN raw IS NULL OR length(trim(raw)) = 0 THEN NULL
    ELSE encode(digest('email:' || lower(trim(raw)), 'sha256'), 'hex')
  END;
$$;

CREATE OR REPLACE FUNCTION public.account_has_user_rows(target uuid, table_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  found boolean;
BEGIN
  IF to_regclass('public.' || table_name) IS NULL THEN
    RETURN false;
  END IF;
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE user_id = $1)', table_name)
    INTO found
    USING target;
  RETURN coalesce(found, false);
EXCEPTION WHEN undefined_column THEN
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.account_must_keep_history(target uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  row public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO row FROM public.profiles WHERE id = target;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF coalesce(row.wallet_balance, 0) <> 0
     OR coalesce(row.cashout_wallet, 0) <> 0
     OR coalesce(row.bonus_wallet, 0) <> 0
     OR coalesce(row.bonus_redeem_wallet, 0) <> 0
     OR coalesce(row.coins_balance, 0) <> 0 THEN
    RETURN true;
  END IF;
  RETURN public.account_has_user_rows(target, 'loyalty_grants')
    OR public.account_has_user_rows(target, 'loyalty_checkins')
    OR public.account_has_user_rows(target, 'loyalty_deposit_grants')
    OR public.account_has_user_rows(target, 'loyalty_survey_responses')
    OR public.account_has_user_rows(target, 'loyalty_verified_phones')
    OR public.account_has_user_rows(target, 'kyc_submissions')
    OR public.account_has_user_rows(target, 'kyc_documents')
    OR public.account_has_user_rows(target, 'wallet_transactions')
    OR public.account_has_user_rows(target, 'wallet_ledger')
    OR public.account_has_user_rows(target, 'deposit_requests')
    OR public.account_has_user_rows(target, 'payment_intents')
    OR public.account_has_user_rows(target, 'paydora_payout_requests')
    OR public.account_has_user_rows(target, 'cashout_holds')
    OR public.account_has_user_rows(target, 'game_load_requests')
    OR public.account_has_user_rows(target, 'reward_claims')
    OR public.account_has_user_rows(target, 'deposit_bonus_ledger');
END;
$$;

CREATE OR REPLACE FUNCTION public.lock_welcome_reward_identity(target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  email_hash text;
BEGIN
  SELECT public.loyalty_email_hash(email) INTO email_hash
  FROM public.profiles WHERE id = target;
  IF email_hash IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.loyalty_identity_locks (identity_hash, task_key)
  SELECT email_hash, task_key
  FROM unnest(ARRAY[
    'signup',
    'email_verified',
    'phone_otp',
    'kyc_approved',
    'welcome_survey',
    'telegram_member'
  ]) AS task_key
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.anonymize_closed_account(target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  closed_email text := 'deleted+' || target::text || '@users.invalid';
BEGIN
  PERFORM public.lock_welcome_reward_identity(target);
  IF to_regclass('public.loyalty_phone_challenges') IS NOT NULL THEN
    DELETE FROM public.loyalty_phone_challenges WHERE user_id = target;
  END IF;
  PERFORM set_config('app.wallet_update', 'true', true);
  UPDATE public.profiles
     SET email = closed_email,
         full_name = 'Deleted player',
         phone = NULL,
         is_suspended = true
   WHERE id = target;
  IF to_regclass('auth.users') IS NOT NULL THEN
    UPDATE auth.users
       SET email = closed_email,
           phone = NULL,
           banned_until = 'infinity'
     WHERE id = target;
  END IF;
  IF to_regclass('auth.sessions') IS NOT NULL THEN
    DELETE FROM auth.sessions WHERE user_id = target;
  END IF;
  IF to_regclass('auth.refresh_tokens') IS NOT NULL THEN
    DELETE FROM auth.refresh_tokens WHERE user_id = target;
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.admin_delete_user_account(uuid);

CREATE FUNCTION public.admin_delete_user_account(target_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'service role required';
  END IF;
  IF target_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'Account not found.';
  END IF;
  IF to_regclass('public.user_roles') IS NOT NULL AND to_regclass('public.roles') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = target_user_id AND r.key = 'super_admin'
    ) THEN
      RAISE EXCEPTION 'The owner account cannot be deleted.';
    END IF;
  END IF;

  IF public.account_must_keep_history(target_user_id) THEN
    PERFORM public.anonymize_closed_account(target_user_id);
    RETURN 'anonymized';
  END IF;

  BEGIN
    PERFORM set_config('app.wallet_update', 'true', true);
    PERFORM public.lock_welcome_reward_identity(target_user_id);
    IF to_regclass('public.loyalty_phone_challenges') IS NOT NULL THEN
      DELETE FROM public.loyalty_phone_challenges WHERE user_id = target_user_id;
    END IF;
    IF to_regclass('public.conversations') IS NOT NULL THEN
      UPDATE public.conversations SET admin_id = NULL WHERE admin_id = target_user_id;
    END IF;
    IF to_regclass('public.deposit_requests') IS NOT NULL THEN
      UPDATE public.deposit_requests SET reviewed_by = NULL WHERE reviewed_by = target_user_id;
    END IF;
    IF to_regclass('public.newsletter_campaigns') IS NOT NULL THEN
      UPDATE public.newsletter_campaigns SET created_by = NULL WHERE created_by = target_user_id;
    END IF;
    IF to_regclass('public.wallet_transactions') IS NOT NULL THEN
      UPDATE public.wallet_transactions SET created_by = NULL WHERE created_by = target_user_id;
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'referred_by'
    ) THEN
      UPDATE public.profiles SET referred_by = NULL WHERE referred_by = target_user_id;
    END IF;
    PERFORM set_config('app.allow_account_purge', 'true', true);
    IF to_regclass('auth.users') IS NOT NULL THEN
      DELETE FROM auth.users WHERE id = target_user_id;
    END IF;
    DELETE FROM public.profiles WHERE id = target_user_id;
    RETURN 'deleted';
  EXCEPTION WHEN foreign_key_violation OR insufficient_privilege THEN
    PERFORM public.anonymize_closed_account(target_user_id);
    RETURN 'anonymized';
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.account_has_user_rows(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.account_must_keep_history(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lock_welcome_reward_identity(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.anonymize_closed_account(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_delete_user_account(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user_account(uuid) TO service_role;

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
  email_hash text;
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
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user AND coalesce(is_test, false)) THEN
    INSERT INTO public.loyalty_reward_attempts (user_id, kind, detail)
    VALUES (p_user, 'test_account', 'Test accounts do not receive Coins');
    RETURN 0;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.fraud_scores
    WHERE user_id = p_user
      AND (blocked OR rewards_blocked OR coalesce(risk_score, 0) >= 50)
  ) THEN
    INSERT INTO public.loyalty_reward_attempts (user_id, kind, detail)
    VALUES (p_user, 'fraud', 'Coin grant blocked by a fraud restriction');
    RETURN 0;
  END IF;
  SELECT public.loyalty_email_hash(email) INTO email_hash FROM public.profiles WHERE id = p_user;
  IF email_hash IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.loyalty_identity_locks
    WHERE identity_hash = email_hash AND task_key = p_task
  ) THEN
    INSERT INTO public.loyalty_reward_attempts (user_id, kind, detail)
    VALUES (p_user, 'eligibility', 'Welcome reward already used for this identity');
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
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND coalesce(is_test, false)) THEN
    RAISE EXCEPTION 'Test accounts cannot claim Coins.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.fraud_scores
    WHERE user_id = uid
      AND (blocked OR rewards_blocked OR coalesce(risk_score, 0) >= 50)
  ) THEN
    RAISE EXCEPTION 'Coins are not available on this account.';
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
