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
