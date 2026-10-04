-- Run in Supabase SQL Editor (Dashboard → SQL → New query → Run)
-- If you get "game_accounts does not exist", run SECTION-A-PREREQUISITES.sql first.

-- ============================================================================
-- SECTION A PREREQUISITES — run this FIRST if Section A fails with:
--   relation "public.game_accounts" does not exist
--   relation "public.game_load_requests" does not exist
--   relation "public.deposit_requests" does not exist
--   relation "public.blog_posts" does not exist
-- Safe to re-run (idempotent).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Shared updated_at trigger helper (used by deposit_requests)
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ── Minimal games catalog (game_accounts FK) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.game_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL DEFAULT 'Slots',
  icon       TEXT NOT NULL DEFAULT 'gamepad-2',
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.game_categories (id, key, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'slots', 'Slots')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.games (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES public.game_categories (id) ON DELETE RESTRICT,
  description TEXT NOT NULL DEFAULT '',
  image_url   TEXT,
  badge_text  TEXT,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  popularity  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed common slugs used by bots (no-op if slug exists)
INSERT INTO public.games (slug, name, category_id)
SELECT v.slug, v.name, '00000000-0000-0000-0000-000000000001'::uuid
FROM (VALUES
  ('cash-frenzy', 'Cash Frenzy'),
  ('juwa', 'Juwa 777'),
  ('game-vault', 'Game Vault'),
  ('vegas', 'Vegas Sweeps'),
  ('gameroom', 'GameRoom'),
  ('cashmachine', 'Cash Machine'),
  ('mafia', 'Mafia'),
  ('mr-all-in-one', 'MR All In One')
) AS v(slug, name)
ON CONFLICT (slug) DO NOTHING;

-- ── Game load job queue ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.game_load_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  game_slug       TEXT NOT NULL,
  game_name       TEXT NOT NULL,
  amount          NUMERIC NOT NULL DEFAULT 0 CHECK (amount >= 0),
  wallet_type     TEXT NOT NULL DEFAULT 'current' CHECK (wallet_type IN ('current', 'bonus', 'cashout')),
  load_type       TEXT NOT NULL DEFAULT 'load'
    CHECK (load_type IN ('new_account', 'reload', 'create_account', 'load', 'redeem', 'check_balance')),
  game_username   TEXT,
  game_password   TEXT,
  redeem_all      BOOLEAN NOT NULL DEFAULT false,
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  error_message   TEXT,
  bot_attempts    INTEGER NOT NULL DEFAULT 0,
  wallet_refunded BOOLEAN NOT NULL DEFAULT false,
  admin_notes     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_game_load_requests_user_id ON public.game_load_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_game_load_requests_status ON public.game_load_requests (status);
CREATE INDEX IF NOT EXISTS idx_game_load_requests_game_slug ON public.game_load_requests (game_slug);
CREATE INDEX IF NOT EXISTS idx_game_load_requests_pending
  ON public.game_load_requests (created_at)
  WHERE status = 'pending';

ALTER TABLE public.game_load_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own game load requests" ON public.game_load_requests;
CREATE POLICY "Users can view own game load requests"
  ON public.game_load_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "No direct insert on game load requests" ON public.game_load_requests;
CREATE POLICY "No direct insert on game load requests"
  ON public.game_load_requests FOR INSERT TO authenticated
  WITH CHECK (false);

-- ── Player ↔ game account mapping ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.game_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  game_id         UUID NOT NULL REFERENCES public.games (id) ON DELETE CASCADE,
  game_username   TEXT NOT NULL,
  game_user_id    TEXT,
  game_password   TEXT,
  credits_balance NUMERIC NOT NULL DEFAULT 0,
  last_synced_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_game_accounts_user_id ON public.game_accounts (user_id);
CREATE INDEX IF NOT EXISTS idx_game_accounts_username ON public.game_accounts (game_username);

ALTER TABLE public.game_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own game accounts" ON public.game_accounts;
CREATE POLICY "users read own game accounts"
  ON public.game_accounts FOR SELECT TO authenticated
  USING (user_id = auth.uid());

ALTER TABLE public.game_accounts
  ADD COLUMN IF NOT EXISTS game_password TEXT;

-- ── Deposit requests (admin confirms → credits wallet_balance) ───────────────
CREATE TABLE IF NOT EXISTS public.deposit_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  game_slug       TEXT,
  game_name       TEXT NOT NULL,
  payment_method  TEXT NOT NULL CHECK (
    payment_method IN ('paypal', 'chime', 'cashapp', 'bitcoin', 'usdt', 'venmo')
  ),
  amount          NUMERIC(10, 2),
  proof_url       TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'completed', 'rejected')
  ),
  wallet_credited BOOLEAN NOT NULL DEFAULT false,
  admin_notes     TEXT,
  reviewed_by     UUID REFERENCES public.profiles (id),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deposit_requests_user ON public.deposit_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_deposit_requests_status ON public.deposit_requests (status);

DROP TRIGGER IF EXISTS deposit_requests_updated_at ON public.deposit_requests;
CREATE TRIGGER deposit_requests_updated_at
  BEFORE UPDATE ON public.deposit_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.deposit_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own deposits" ON public.deposit_requests;
CREATE POLICY "Users view own deposits"
  ON public.deposit_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users create own deposits" ON public.deposit_requests;
CREATE POLICY "Users create own deposits"
  ON public.deposit_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins view all deposits" ON public.deposit_requests;
CREATE POLICY "Admins view all deposits"
  ON public.deposit_requests FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins update deposits" ON public.deposit_requests;
CREATE POLICY "Admins update deposits"
  ON public.deposit_requests FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── Blog posts (AI blog + Telegram cron) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  excerpt         TEXT NOT NULL DEFAULT '',
  content         TEXT NOT NULL DEFAULT '',
  cover_image_url TEXT,
  tags            TEXT[] NOT NULL DEFAULT '{}',
  author_id       UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  is_published    BOOLEAN NOT NULL DEFAULT false,
  published_at    TIMESTAMPTZ,
  seo_title       TEXT,
  seo_description TEXT,
  telegram_sent   BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_published
  ON public.blog_posts (published_at DESC)
  WHERE is_published;

-- Service role + bots need full access (via service role bypasses RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deposit_requests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_posts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_accounts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_load_requests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.games TO service_role;

-- ============================================================================
-- SECTION A (main patch)
-- ============================================================================

-- SECTION A START — EXISTING DATABASE PATCH (run this block only)
-- ============================================================================

-- --- 20260720000200_game_load_rpc_fix.sql ---

-- Safe fix: request_game_load for Supabase projects WITHOUT wallet_ledger
-- (uses wallet_transactions — do NOT run 20260617000085 if wallet_ledger is missing)
-- Run entire file once in Supabase SQL Editor.

-- ── Wallet transaction log (if you never ran wallets.sql) ─────────────────────
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  wallet_type TEXT NOT NULL CHECK (wallet_type IN ('current', 'bonus', 'cashout')),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('credit', 'debit', 'adjustment')),
  source TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id
  ON public.wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at
  ON public.wallet_transactions(created_at DESC);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own wallet transactions" ON public.wallet_transactions;
CREATE POLICY "Users can view own wallet transactions"
  ON public.wallet_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ── game_load_requests load types ───────────────────────────────────────────
ALTER TABLE public.game_load_requests DROP CONSTRAINT IF EXISTS game_load_requests_load_type_check;
ALTER TABLE public.game_load_requests ADD CONSTRAINT game_load_requests_load_type_check
  CHECK (load_type IN ('new_account', 'reload', 'create_account', 'load', 'redeem', 'check_balance'));

ALTER TABLE public.game_load_requests DROP CONSTRAINT IF EXISTS game_load_requests_amount_check;
ALTER TABLE public.game_load_requests ADD CONSTRAINT game_load_requests_amount_check
  CHECK (amount >= 0);

-- ── Replace old 5-arg RPC with 6-arg wallet load ────────────────────────────
DROP FUNCTION IF EXISTS public.request_game_load(text, text, numeric, text, text);
DROP FUNCTION IF EXISTS public.request_game_load(text, text, numeric, text, text, text);

CREATE OR REPLACE FUNCTION public.request_game_load(
  p_game_slug TEXT,
  p_game_name TEXT,
  p_amount NUMERIC,
  p_wallet_type TEXT,
  p_load_type TEXT,
  p_game_username TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_balance NUMERIC;
  v_request_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_load_type NOT IN ('new_account', 'reload', 'create_account', 'load') THEN
    RAISE EXCEPTION 'Invalid load type';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.game_load_requests
    WHERE user_id = v_user_id AND game_slug = p_game_slug
      AND status IN ('pending', 'processing')
  ) THEN
    RAISE EXCEPTION 'A request is already in progress for this game';
  END IF;

  IF p_load_type = 'create_account' THEN
    INSERT INTO public.game_load_requests (
      user_id, game_slug, game_name, amount, wallet_type, load_type, status
    )
    VALUES (v_user_id, p_game_slug, p_game_name, 0, 'current', 'create_account', 'pending')
    RETURNING id INTO v_request_id;
    RETURN v_request_id;
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  IF p_wallet_type NOT IN ('current', 'bonus') THEN
    RAISE EXCEPTION 'Invalid wallet type';
  END IF;

  IF p_load_type IN ('reload', 'load')
     AND (p_game_username IS NULL OR trim(p_game_username) = '') THEN
    RAISE EXCEPTION 'Game username required for load';
  END IF;

  PERFORM set_config('app.wallet_update', 'true', true);

  IF p_wallet_type = 'current' THEN
    SELECT wallet_balance INTO v_balance FROM public.profiles WHERE id = v_user_id FOR UPDATE;
    IF v_balance IS NULL OR v_balance < p_amount THEN
      RAISE EXCEPTION 'Insufficient wallet balance';
    END IF;
    UPDATE public.profiles SET wallet_balance = wallet_balance - p_amount WHERE id = v_user_id;
  ELSE
    SELECT bonus_wallet INTO v_balance FROM public.profiles WHERE id = v_user_id FOR UPDATE;
    IF v_balance IS NULL OR v_balance < p_amount THEN
      RAISE EXCEPTION 'Insufficient bonus wallet balance';
    END IF;
    UPDATE public.profiles SET bonus_wallet = bonus_wallet - p_amount WHERE id = v_user_id;
  END IF;

  -- Log debit: wallet_transactions (this project) — NOT wallet_ledger
  INSERT INTO public.wallet_transactions (
    user_id, amount, wallet_type, transaction_type, source, description, created_by
  )
  VALUES (
    v_user_id,
    p_amount,
    p_wallet_type,
    'debit',
    'game_load',
    format('Load $%s to %s', p_amount, p_game_name),
    v_user_id
  );

  INSERT INTO public.game_load_requests (
    user_id, game_slug, game_name, amount, wallet_type, load_type, game_username, status
  )
  VALUES (
    v_user_id,
    p_game_slug,
    p_game_name,
    p_amount,
    p_wallet_type,
    CASE WHEN p_load_type = 'reload' THEN 'load' ELSE p_load_type END,
    NULLIF(trim(p_game_username), ''),
    'pending'
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_game_load(TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;

-- --- 20260720000300_kyc_and_ai_system.sql ---

-- KYC + AI automation tables (safe to run once in Supabase SQL Editor)
-- Fixes: KYC not saving, AI admin settings/bot/blog errors

-- ── KYC on profiles ───────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kyc_status TEXT NOT NULL DEFAULT 'unverified';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kyc_document_url TEXT;

-- ── KYC submissions (replaces local JSON file) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kyc_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT,
  user_name TEXT,
  document_name TEXT NOT NULL DEFAULT 'government_id.jpg',
  document_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kyc_submissions_user_id ON public.kyc_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_submissions_status ON public.kyc_submissions(status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_kyc_submissions_user_unique ON public.kyc_submissions(user_id);

ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own kyc" ON public.kyc_submissions;
CREATE POLICY "users read own kyc"
  ON public.kyc_submissions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Inserts/updates via service role (server actions) only
DROP POLICY IF EXISTS "no direct kyc insert" ON public.kyc_submissions;
CREATE POLICY "no direct kyc insert"
  ON public.kyc_submissions FOR INSERT TO authenticated
  WITH CHECK (false);

-- ── AI automation (from ai_system migration) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_blog_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  topics TEXT[] NOT NULL DEFAULT ARRAY['Online Gaming', 'Fish Table Games', 'Slot Strategies'],
  target_keywords TEXT[] NOT NULL DEFAULT ARRAY['spinora bonus code', 'juwa 777 download'],
  posting_frequency_hours INT NOT NULL DEFAULT 24,
  ai_provider TEXT NOT NULL DEFAULT 'smart_auto',
  ai_model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  auto_publish BOOLEAN NOT NULL DEFAULT true,
  auto_telegram_broadcast BOOLEAN NOT NULL DEFAULT true,
  last_generated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_telegram_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auto_post_blog BOOLEAN NOT NULL DEFAULT true,
  auto_post_promos BOOLEAN NOT NULL DEFAULT true,
  template_header TEXT NOT NULL DEFAULT '🔥 <b>SPINORA GAMING UPDATE</b> 🔥',
  template_footer TEXT NOT NULL DEFAULT '👉 Join now & claim your instant deposit bonus! 🚀',
  autopilot_enabled BOOLEAN NOT NULL DEFAULT true,
  last_autopilot_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_chatbot_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  bot_name TEXT NOT NULL DEFAULT 'Spinora AI Assistant',
  system_prompt TEXT NOT NULL DEFAULT 'You are Spinora AI Assistant.',
  auto_reply_enabled BOOLEAN NOT NULL DEFAULT true,
  human_handover_threshold NUMERIC(3, 2) NOT NULL DEFAULT 0.60,
  telegram_escalation_enabled BOOLEAN NOT NULL DEFAULT true,
  personality TEXT NOT NULL DEFAULT 'standard',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_chat_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_query TEXT NOT NULL,
  bot_response TEXT NOT NULL,
  confidence_score NUMERIC(3, 2) NOT NULL DEFAULT 1.00,
  escalated_to_human BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.system_health_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  health_score INT NOT NULL DEFAULT 100,
  seo_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  cron_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  database_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_blog_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_telegram_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chatbot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_health_logs ENABLE ROW LEVEL SECURITY;

INSERT INTO public.ai_blog_settings (id)
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ai_telegram_settings (id)
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ai_chatbot_settings (id)
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_ai_chat_logs_created_at ON public.ai_chat_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_health_logs_created_at ON public.system_health_logs (created_at DESC);

-- --- 20260720000400_game_redeem_fix.sql ---

-- Redeem fix: queue redeems reliably + credit Deposit Redeem (cashout_wallet) on bot completion
-- Uses wallet_transactions (NOT wallet_ledger). Safe to run once in Supabase SQL Editor.

-- Helper: resolve game UUID by slug (returns NULL if games table missing or slug unknown)
CREATE OR REPLACE FUNCTION public.game_id_for_slug(p_slug TEXT)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF to_regclass('public.games') IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN (SELECT id FROM public.games WHERE slug = p_slug LIMIT 1);
END;
$$;

-- ── Profile redeem wallets ────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cashout_wallet NUMERIC(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bonus_redeem_wallet NUMERIC(10, 2) NOT NULL DEFAULT 0;

-- ── game_load_requests redeem column ──────────────────────────────────────────
ALTER TABLE public.game_load_requests
  ADD COLUMN IF NOT EXISTS redeem_all BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.game_load_requests DROP CONSTRAINT IF EXISTS game_load_requests_load_type_check;
ALTER TABLE public.game_load_requests ADD CONSTRAINT game_load_requests_load_type_check
  CHECK (load_type IN ('new_account', 'reload', 'create_account', 'load', 'redeem', 'check_balance'));

-- ── wallet_transactions types (cashout + bonus_redeem for redeem credits) ─────
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_wallet_type_check;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_wallet_type_check
  CHECK (wallet_type IN ('current', 'bonus', 'cashout', 'bonus_redeem'));

-- Allow payout source
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_source_check;
-- Only add if you have a source check; otherwise skip silently
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wallet_transactions_source_check'
      AND conrelid = 'public.wallet_transactions'::regclass
  ) THEN
    ALTER TABLE public.wallet_transactions DROP CONSTRAINT wallet_transactions_source_check;
  END IF;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- ── Deposit rollover helper (redeem validation) ─────────────────────────────
DROP FUNCTION IF EXISTS public.get_deposit_rollover_totals(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.get_deposit_rollover_totals(
  p_user_id UUID,
  p_game_slug TEXT
)
RETURNS TABLE (active_load_amount NUMERIC, redeemed_since_active NUMERIC)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_amount NUMERIC := 0;
  v_active_at TIMESTAMPTZ;
  v_redeemed_since NUMERIC := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT amount, completed_at
  INTO v_active_amount, v_active_at
  FROM public.game_load_requests
  WHERE user_id = p_user_id
    AND game_slug = p_game_slug
    AND wallet_type = 'current'
    AND load_type IN ('load', 'reload')
    AND status = 'completed'
  ORDER BY completed_at DESC NULLS LAST, created_at DESC
  LIMIT 1;

  IF v_active_amount IS NULL OR v_active_amount <= 0 THEN
    RETURN QUERY SELECT 0::NUMERIC, 0::NUMERIC;
    RETURN;
  END IF;

  SELECT COALESCE(SUM(amount), 0)
  INTO v_redeemed_since
  FROM public.game_load_requests
  WHERE user_id = p_user_id
    AND game_slug = p_game_slug
    AND wallet_type = 'current'
    AND load_type = 'redeem'
    AND status = 'completed'
    AND (v_active_at IS NULL OR completed_at >= v_active_at);

  RETURN QUERY SELECT v_active_amount, v_redeemed_since;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_deposit_rollover_totals(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_deposit_rollover_totals(UUID, TEXT) TO service_role;

-- ── Queue redeem (pull from game panel → pending bot job) ─────────────────────
DROP FUNCTION IF EXISTS public.request_game_redeem(TEXT, TEXT, NUMERIC, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.request_game_redeem(TEXT, TEXT, NUMERIC, TEXT, BOOLEAN, TEXT);

CREATE OR REPLACE FUNCTION public.request_game_redeem(
  p_game_slug TEXT,
  p_game_name TEXT,
  p_amount NUMERIC,
  p_game_username TEXT,
  p_redeem_all BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_request_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_game_username IS NULL OR trim(p_game_username) = '' THEN
    RAISE EXCEPTION 'Game username required for redeem';
  END IF;

  IF NOT p_redeem_all AND (p_amount IS NULL OR p_amount <= 0) THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.game_load_requests
    WHERE user_id = v_user_id AND game_slug = p_game_slug
      AND status IN ('pending', 'processing')
  ) THEN
    RAISE EXCEPTION 'A request is already in progress for this game';
  END IF;

  INSERT INTO public.game_load_requests (
    user_id, game_slug, game_name, amount, wallet_type, load_type,
    game_username, redeem_all, status
  )
  VALUES (
    v_user_id,
    p_game_slug,
    p_game_name,
    CASE WHEN p_redeem_all THEN 0 ELSE p_amount END,
    'current',
    'redeem',
    NULLIF(trim(p_game_username), ''),
    p_redeem_all,
    'pending'
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_game_redeem(TEXT, TEXT, NUMERIC, TEXT, BOOLEAN) TO authenticated;

-- ── Bot completion: credit cashout_wallet on successful redeem ────────────────
DROP FUNCTION IF EXISTS public.complete_game_load(UUID, BOOLEAN, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.complete_game_load(UUID, BOOLEAN, TEXT, TEXT, TEXT, NUMERIC);

CREATE OR REPLACE FUNCTION public.complete_game_load(
  p_request_id UUID,
  p_success BOOLEAN,
  p_game_username TEXT DEFAULT NULL,
  p_game_password TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_redeemed_amount NUMERIC DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.game_load_requests;
  v_credit NUMERIC;
  v_dest_wallet TEXT;
  v_game_id UUID;
BEGIN
  SELECT * INTO v_row
  FROM public.game_load_requests
  WHERE id = p_request_id
    AND status IN ('pending', 'processing')
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RETURN;
  END IF;

  v_game_id := public.game_id_for_slug(v_row.game_slug);

  -- Refund failed loads (debit happened at queue time for load/reload)
  IF NOT p_success AND v_row.load_type IN ('load', 'reload') AND COALESCE(v_row.amount, 0) > 0 THEN
    PERFORM set_config('app.wallet_update', 'true', true);
    IF v_row.wallet_type = 'bonus' THEN
      UPDATE public.profiles SET bonus_wallet = bonus_wallet + v_row.amount WHERE id = v_row.user_id;
    ELSE
      UPDATE public.profiles SET wallet_balance = wallet_balance + v_row.amount WHERE id = v_row.user_id;
    END IF;
    INSERT INTO public.wallet_transactions (
      user_id, amount, wallet_type, transaction_type, source, description, created_by
    )
    VALUES (
      v_row.user_id, v_row.amount, v_row.wallet_type, 'credit', 'game_load_refund',
      format('Refund failed load $%s to %s', v_row.amount, v_row.game_name), v_row.user_id
    );
  END IF;

  IF p_success AND v_row.load_type = 'redeem' THEN
    v_credit := COALESCE(p_redeemed_amount, NULLIF(v_row.amount, 0));
    IF v_credit IS NULL OR v_credit <= 0 THEN
      RAISE EXCEPTION 'Redeem completion requires a positive amount';
    END IF;

    v_dest_wallet := CASE WHEN v_row.wallet_type = 'bonus' THEN 'bonus_redeem' ELSE 'cashout' END;

    PERFORM set_config('app.wallet_update', 'true', true);

    IF v_dest_wallet = 'bonus_redeem' THEN
      UPDATE public.profiles
      SET bonus_redeem_wallet = bonus_redeem_wallet + v_credit
      WHERE id = v_row.user_id;
    ELSE
      UPDATE public.profiles
      SET cashout_wallet = cashout_wallet + v_credit
      WHERE id = v_row.user_id;
    END IF;

    INSERT INTO public.wallet_transactions (
      user_id, amount, wallet_type, transaction_type, source, description, created_by
    )
    VALUES (
      v_row.user_id,
      v_credit,
      v_dest_wallet,
      'credit',
      'game_redeem',
      format('Redeem $%s from %s', v_credit, v_row.game_name),
      v_row.user_id
    );

    IF v_game_id IS NOT NULL THEN
      UPDATE public.game_accounts
      SET credits_balance = GREATEST(0, credits_balance - v_credit),
          last_synced_at = NOW(),
          updated_at = NOW()
      WHERE user_id = v_row.user_id AND game_id = v_game_id;
    ELSIF to_regclass('public.game_accounts') IS NOT NULL AND v_row.game_username IS NOT NULL THEN
      UPDATE public.game_accounts
      SET credits_balance = GREATEST(0, credits_balance - v_credit),
          last_synced_at = NOW(),
          updated_at = NOW()
      WHERE user_id = v_row.user_id AND game_username = v_row.game_username;
    END IF;
  END IF;

  IF p_success AND v_row.load_type = 'check_balance' AND p_redeemed_amount IS NOT NULL THEN
    IF v_game_id IS NOT NULL THEN
      UPDATE public.game_accounts
      SET credits_balance = p_redeemed_amount, last_synced_at = NOW(), updated_at = NOW()
      WHERE user_id = v_row.user_id AND game_id = v_game_id;
    ELSIF to_regclass('public.game_accounts') IS NOT NULL AND v_row.game_username IS NOT NULL THEN
      UPDATE public.game_accounts
      SET credits_balance = p_redeemed_amount, last_synced_at = NOW(), updated_at = NOW()
      WHERE user_id = v_row.user_id AND game_username = v_row.game_username;
    END IF;
  END IF;

  UPDATE public.game_load_requests
  SET
    status = CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
    game_username = COALESCE(p_game_username, game_username),
    game_password = COALESCE(p_game_password, game_password),
    amount = CASE
      WHEN p_success AND v_row.load_type = 'redeem' THEN COALESCE(p_redeemed_amount, amount)
      WHEN p_success AND v_row.load_type = 'check_balance' THEN COALESCE(p_redeemed_amount, amount)
      ELSE amount
    END,
    error_message = p_error_message,
    completed_at = CASE WHEN p_success THEN NOW() ELSE completed_at END,
    updated_at = NOW()
  WHERE id = p_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_game_load(UUID, BOOLEAN, TEXT, TEXT, TEXT, NUMERIC) TO service_role;

-- ── Admin cash-out payout (debit Deposit Redeem / cashout_wallet) ─────────────
DROP FUNCTION IF EXISTS public.admin_payout_cashout(UUID, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.admin_payout_cashout(
  p_user UUID,
  p_amount NUMERIC,
  p_note TEXT DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bal NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payout amount must be positive';
  END IF;

  PERFORM set_config('app.wallet_update', 'true', true);

  UPDATE public.profiles
  SET cashout_wallet = cashout_wallet - p_amount
  WHERE id = p_user AND cashout_wallet >= p_amount
  RETURNING cashout_wallet INTO v_bal;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient cash-out balance';
  END IF;

  INSERT INTO public.wallet_transactions (
    user_id, amount, wallet_type, transaction_type, source, description, created_by
  )
  VALUES (
    p_user,
    p_amount,
    'cashout',
    'debit',
    'payout',
    COALESCE(NULLIF(trim(p_note), ''), 'Cash-out payout'),
    p_user
  );

  RETURN v_bal;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_payout_cashout(UUID, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_payout_cashout(UUID, NUMERIC, TEXT) TO service_role;

-- ── Bot claim next pending job (required for redeem/load bots) ────────────────
CREATE OR REPLACE FUNCTION public.claim_next_game_load(p_game_slug TEXT)
RETURNS SETOF public.game_load_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.game_load_requests;
BEGIN
  SELECT * INTO v_row
  FROM public.game_load_requests
  WHERE game_slug = p_game_slug AND status = 'pending'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_row.id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.game_load_requests
  SET status = 'processing',
      bot_attempts = COALESCE(bot_attempts, 0) + 1,
      updated_at = NOW()
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  RETURN NEXT v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_next_game_load(TEXT) TO service_role;

-- --- 20260720000500_redeem_kyc_wallet_trigger.sql ---

-- Redeem + KYC + wallet trigger fix (run once in Supabase SQL Editor)
-- Ensures: KYC required for redeem, wallet credits work, bots can complete redeems

-- ── Wallet columns ────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cashout_wallet NUMERIC(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kyc_status TEXT NOT NULL DEFAULT 'unverified';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bonus_redeem_wallet NUMERIC(10, 2) NOT NULL DEFAULT 0;

-- ── Protect wallet columns (must allow service-role SQL functions to update) ───
CREATE OR REPLACE FUNCTION public.protect_wallet_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (
    OLD.wallet_balance IS DISTINCT FROM NEW.wallet_balance
    OR OLD.bonus_wallet IS DISTINCT FROM NEW.bonus_wallet
    OR OLD.cashout_wallet IS DISTINCT FROM NEW.cashout_wallet
    OR OLD.bonus_redeem_wallet IS DISTINCT FROM NEW.bonus_redeem_wallet
  ) THEN
    IF current_setting('app.wallet_update', true) = 'true'
       OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
      RETURN NEW;
    END IF;
    IF auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    ) THEN
      RETURN NEW;
    END IF;
    NEW.wallet_balance := OLD.wallet_balance;
    NEW.bonus_wallet := OLD.bonus_wallet;
    NEW.cashout_wallet := OLD.cashout_wallet;
    NEW.bonus_redeem_wallet := OLD.bonus_redeem_wallet;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_wallet_columns_trigger ON public.profiles;
CREATE TRIGGER protect_wallet_columns_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_wallet_columns();

-- ── request_game_redeem with KYC gate ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.request_game_redeem(
  p_game_slug TEXT,
  p_game_name TEXT,
  p_amount NUMERIC,
  p_game_username TEXT,
  p_redeem_all BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_kyc TEXT;
  v_request_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT kyc_status INTO v_kyc FROM public.profiles WHERE id = v_user_id;
  IF v_kyc IS DISTINCT FROM 'verified' THEN
    IF v_kyc = 'pending' THEN
      RAISE EXCEPTION 'KYC under review — admin must approve your ID before redeeming';
    END IF;
    RAISE EXCEPTION 'KYC Verification Required — upload ID at Dashboard → KYC before redeeming';
  END IF;

  IF p_game_username IS NULL OR trim(p_game_username) = '' THEN
    RAISE EXCEPTION 'Game username required for redeem';
  END IF;

  IF NOT p_redeem_all AND (p_amount IS NULL OR p_amount <= 0) THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.game_load_requests
    WHERE user_id = v_user_id AND game_slug = p_game_slug
      AND load_type IN ('load', 'reload', 'redeem')
      AND status IN ('pending', 'processing')
  ) THEN
    RAISE EXCEPTION 'A load or redeem is already in progress for this game';
  END IF;

  INSERT INTO public.game_load_requests (
    user_id, game_slug, game_name, amount, wallet_type, load_type,
    game_username, redeem_all, status
  )
  VALUES (
    v_user_id,
    p_game_slug,
    p_game_name,
    CASE WHEN p_redeem_all THEN 0 ELSE p_amount END,
    'current',
    'redeem',
    NULLIF(trim(p_game_username), ''),
    p_redeem_all,
    'pending'
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_game_redeem(TEXT, TEXT, NUMERIC, TEXT, BOOLEAN) TO authenticated;

-- ── Bot-safe redeem credit (fallback if complete_game_load fails) ─────────────
CREATE OR REPLACE FUNCTION public.credit_redeem_completion(
  p_request_id UUID,
  p_redeemed_amount NUMERIC,
  p_game_username TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.game_load_requests;
  v_credit NUMERIC;
BEGIN
  SELECT * INTO v_row
  FROM public.game_load_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_row.id IS NULL OR v_row.load_type <> 'redeem' THEN
    RAISE EXCEPTION 'Invalid redeem request';
  END IF;

  IF v_row.status = 'completed' THEN
    RETURN;
  END IF;

  v_credit := COALESCE(p_redeemed_amount, NULLIF(v_row.amount, 0));
  IF v_credit IS NULL OR v_credit <= 0 THEN
    RAISE EXCEPTION 'Redeem amount must be positive';
  END IF;

  PERFORM set_config('app.wallet_update', 'true', true);

  UPDATE public.profiles
  SET cashout_wallet = cashout_wallet + v_credit
  WHERE id = v_row.user_id;

  INSERT INTO public.wallet_transactions (
    user_id, amount, wallet_type, transaction_type, source, description, created_by
  )
  VALUES (
    v_row.user_id, v_credit, 'cashout', 'credit', 'game_redeem',
    format('Redeem $%s from %s', v_credit, v_row.game_name), v_row.user_id
  );

  UPDATE public.game_load_requests
  SET
    status = 'completed',
    amount = v_credit,
    game_username = COALESCE(p_game_username, game_username),
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_redeem_completion(UUID, NUMERIC, TEXT) TO service_role;

-- --- 20260722000100_fix_game_accounts_credentials.sql ---

-- Migration: 20260722000100_fix_game_accounts_credentials.sql
-- Adds game_password support to game_accounts and updates complete_game_load RPC

DO $$
BEGIN
  IF to_regclass('public.game_accounts') IS NOT NULL THEN
    ALTER TABLE public.game_accounts ADD COLUMN IF NOT EXISTS game_password TEXT;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.complete_game_load(
  p_request_id UUID,
  p_success BOOLEAN,
  p_game_username TEXT DEFAULT NULL,
  p_game_password TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_redeemed_amount NUMERIC DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.game_load_requests;
  v_credit NUMERIC;
  v_dest_wallet TEXT;
  v_game_id UUID;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT * INTO v_row
  FROM public.game_load_requests
  WHERE id = p_request_id
    AND status IN ('pending', 'processing')
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RETURN;
  END IF;

  v_game_id := public.game_id_for_slug(v_row.game_slug);

  -- Refund failed loads (debit happened at queue time for load/reload)
  IF NOT p_success AND v_row.load_type IN ('load', 'reload') AND COALESCE(v_row.amount, 0) > 0 THEN
    PERFORM set_config('app.wallet_update', 'true', true);
    IF v_row.wallet_type = 'bonus' THEN
      UPDATE public.profiles SET bonus_wallet = bonus_wallet + v_row.amount WHERE id = v_row.user_id;
    ELSE
      UPDATE public.profiles SET wallet_balance = wallet_balance + v_row.amount WHERE id = v_row.user_id;
    END IF;
    INSERT INTO public.wallet_transactions (
      user_id, amount, wallet_type, transaction_type, source, description, created_by
    )
    VALUES (
      v_row.user_id, v_row.amount, v_row.wallet_type, 'credit', 'game_load_refund',
      format('Refund failed load $%s to %s', v_row.amount, v_row.game_name), v_row.user_id
    );
  END IF;

  IF p_success THEN
    -- Account Creation / New Account Insertion into game_accounts
    IF v_row.load_type IN ('create_account', 'new_account') AND v_game_id IS NOT NULL THEN
      INSERT INTO public.game_accounts (
        user_id, game_id, game_username, game_password, credits_balance, last_synced_at, updated_at
      )
      VALUES (
        v_row.user_id,
        v_game_id,
        COALESCE(p_game_username, v_row.game_username, 'player'),
        COALESCE(p_game_password, v_row.game_password),
        0,
        v_now,
        v_now
      )
      ON CONFLICT (user_id, game_id) DO UPDATE
        SET game_username = EXCLUDED.game_username,
            game_password = COALESCE(EXCLUDED.game_password, game_accounts.game_password),
            updated_at = v_now;

    ELSIF v_row.load_type IN ('load', 'reload') AND v_game_id IS NOT NULL THEN
      UPDATE public.game_accounts
      SET credits_balance = credits_balance + COALESCE(v_row.amount, 0),
          last_synced_at = v_now,
          updated_at = v_now
      WHERE user_id = v_row.user_id AND game_id = v_game_id;

    ELSIF v_row.load_type = 'redeem' THEN
      v_credit := COALESCE(p_redeemed_amount, NULLIF(v_row.amount, 0));
      IF v_credit IS NULL OR v_credit <= 0 THEN
        RAISE EXCEPTION 'Redeem completion requires a positive amount';
      END IF;

      v_dest_wallet := CASE WHEN v_row.wallet_type = 'bonus' THEN 'bonus_redeem' ELSE 'cashout' END;

      PERFORM set_config('app.wallet_update', 'true', true);

      IF v_dest_wallet = 'bonus_redeem' THEN
        UPDATE public.profiles
        SET bonus_redeem_wallet = bonus_redeem_wallet + v_credit
        WHERE id = v_row.user_id;
      ELSE
        UPDATE public.profiles
        SET cashout_wallet = cashout_wallet + v_credit
        WHERE id = v_row.user_id;
      END IF;

      INSERT INTO public.wallet_transactions (
        user_id, amount, wallet_type, transaction_type, source, description, created_by
      )
      VALUES (
        v_row.user_id,
        v_credit,
        v_dest_wallet,
        'credit',
        'game_redeem',
        format('Redeem $%s from %s', v_credit, v_row.game_name),
        v_row.user_id
      );

      IF v_game_id IS NOT NULL THEN
        UPDATE public.game_accounts
        SET credits_balance = GREATEST(0, credits_balance - v_credit),
            last_synced_at = v_now,
            updated_at = v_now
        WHERE user_id = v_row.user_id AND game_id = v_game_id;
      ELSIF to_regclass('public.game_accounts') IS NOT NULL AND v_row.game_username IS NOT NULL THEN
        UPDATE public.game_accounts
        SET credits_balance = GREATEST(0, credits_balance - v_credit),
            last_synced_at = v_now,
            updated_at = v_now
        WHERE user_id = v_row.user_id AND game_username = v_row.game_username;
      END IF;

    ELSIF v_row.load_type = 'check_balance' AND p_redeemed_amount IS NOT NULL THEN
      IF v_game_id IS NOT NULL THEN
        UPDATE public.game_accounts
        SET credits_balance = p_redeemed_amount, last_synced_at = v_now, updated_at = v_now
        WHERE user_id = v_row.user_id AND game_id = v_game_id;
      ELSIF to_regclass('public.game_accounts') IS NOT NULL AND v_row.game_username IS NOT NULL THEN
        UPDATE public.game_accounts
        SET credits_balance = p_redeemed_amount, last_synced_at = v_now, updated_at = v_now
        WHERE user_id = v_row.user_id AND game_username = v_row.game_username;
      END IF;
    END IF;
  END IF;

  UPDATE public.game_load_requests
  SET
    status = CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
    game_username = COALESCE(p_game_username, game_username),
    game_password = COALESCE(p_game_password, game_password),
    amount = CASE
      WHEN p_success AND v_row.load_type IN ('redeem', 'check_balance') THEN COALESCE(p_redeemed_amount, amount)
      ELSE amount
    END,
    error_message = p_error_message,
    completed_at = CASE WHEN p_success THEN NOW() ELSE completed_at END,
    updated_at = NOW()
  WHERE id = p_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_game_load(UUID, BOOLEAN, TEXT, TEXT, TEXT, NUMERIC) TO service_role;

-- --- 20260721000300_deposit_wallet_credit.sql ---

-- Credit Total Deposit wallet when admin confirms a deposit request.
-- Run once in Supabase SQL Editor after deposit-requests.sql and wallets.sql

DO $$
BEGIN
  IF to_regclass('public.deposit_requests') IS NOT NULL THEN
    ALTER TABLE public.deposit_requests
      ADD COLUMN IF NOT EXISTS wallet_credited BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.complete_deposit_request(
  p_deposit_id UUID,
  p_amount NUMERIC DEFAULT NULL,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.deposit_requests;
  v_amount NUMERIC;
  v_method TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT * INTO v_row
  FROM public.deposit_requests
  WHERE id = p_deposit_id
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Deposit request not found';
  END IF;

  IF v_row.wallet_credited OR v_row.status = 'completed' THEN
    RAISE EXCEPTION 'Deposit already completed';
  END IF;

  v_amount := COALESCE(p_amount, v_row.amount);
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'Deposit amount is required';
  END IF;

  v_amount := round(v_amount::numeric, 2);

  PERFORM set_config('app.wallet_update', 'true', true);

  UPDATE public.profiles
  SET wallet_balance = wallet_balance + v_amount
  WHERE id = v_row.user_id;

  v_method := COALESCE(v_row.payment_method, 'payment');

  INSERT INTO public.wallet_transactions (
    user_id, amount, wallet_type, transaction_type, source, description, created_by
  )
  VALUES (
    v_row.user_id,
    v_amount,
    'current',
    'credit',
    'deposit',
    format('Deposit confirmed — $%s via %s (%s)', v_amount, v_method, v_row.game_name),
    auth.uid()
  );

  UPDATE public.deposit_requests
  SET
    status = 'completed',
    amount = v_amount,
    wallet_credited = true,
    admin_notes = COALESCE(NULLIF(trim(p_admin_notes), ''), admin_notes),
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_deposit_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_deposit_request(UUID, NUMERIC, TEXT) TO authenticated;

-- --- 20260721000200_blog_telegram_sent_status.sql ---

-- ============================================================================
-- Spinora · 0200 · Add telegram_sent status tracking to blog_posts
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.blog_posts') IS NOT NULL THEN
    ALTER TABLE public.blog_posts
      ADD COLUMN IF NOT EXISTS telegram_sent boolean NOT NULL DEFAULT false;

    UPDATE public.blog_posts SET telegram_sent = true;
  END IF;
END $$;

-- ============================================================================
-- SECTION A END
