-- Telegram Control Center. Review before running. Do not apply from the app.
-- Tokens stay in the server environment. This file stores routes, links, and delivery history.
-- Existing telegram_link_codes and telegram_links are left in place.

CREATE TABLE IF NOT EXISTS public.telegram_link_challenges (
  code_hash TEXT PRIMARY KEY,
  purpose TEXT NOT NULL CHECK (purpose IN ('owner', 'customer')),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_link_challenges_user
  ON public.telegram_link_challenges (user_id, purpose, created_at DESC);

CREATE TABLE IF NOT EXISTS public.telegram_account_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose TEXT NOT NULL CHECK (purpose IN ('owner', 'customer')),
  telegram_user_id BIGINT NOT NULL,
  chat_id BIGINT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  UNIQUE (purpose, telegram_user_id)
);

CREATE INDEX IF NOT EXISTS idx_telegram_account_links_user
  ON public.telegram_account_links (user_id, purpose);

CREATE TABLE IF NOT EXISTS public.telegram_delivery_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT NOT NULL UNIQUE,
  bot_key TEXT NOT NULL CHECK (bot_key IN ('payments', 'players', 'errors', 'owner', 'support')),
  category TEXT NOT NULL,
  chat_id TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'sending', 'accepted', 'failed', 'retry_pending', 'uncertain', 'unconfigured', 'duplicate')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ,
  last_error TEXT,
  telegram_message_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_delivery_jobs_due
  ON public.telegram_delivery_jobs (status, next_attempt_at);

CREATE TABLE IF NOT EXISTS public.telegram_delivery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.telegram_delivery_jobs (id) ON DELETE CASCADE,
  outcome TEXT NOT NULL,
  http_status INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_delivery_attempts_job
  ON public.telegram_delivery_attempts (job_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.telegram_webhook_updates (
  bot_key TEXT NOT NULL,
  update_id BIGINT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (bot_key, update_id)
);

CREATE TABLE IF NOT EXISTS public.telegram_incidents (
  fingerprint TEXT PRIMARY KEY,
  severity TEXT NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'ERROR', 'CRITICAL')),
  title TEXT NOT NULL,
  seen_count INTEGER NOT NULL DEFAULT 1,
  last_sent_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.telegram_control_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_link_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_account_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_delivery_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_delivery_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_webhook_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_control_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.telegram_link_challenges FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.telegram_account_links FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.telegram_delivery_jobs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.telegram_delivery_attempts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.telegram_webhook_updates FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.telegram_incidents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.telegram_control_audit FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.telegram_link_challenges TO service_role;
GRANT ALL ON TABLE public.telegram_account_links TO service_role;
GRANT ALL ON TABLE public.telegram_delivery_jobs TO service_role;
GRANT ALL ON TABLE public.telegram_delivery_attempts TO service_role;
GRANT ALL ON TABLE public.telegram_webhook_updates TO service_role;
GRANT ALL ON TABLE public.telegram_incidents TO service_role;
GRANT ALL ON TABLE public.telegram_control_audit TO service_role;

CREATE OR REPLACE FUNCTION public.consume_telegram_link_code(p_code_hash TEXT)
RETURNS TABLE (user_id UUID, purpose TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required';
  END IF;
  IF p_code_hash IS NULL OR length(trim(p_code_hash)) < 32 THEN
    RETURN;
  END IF;
  RETURN QUERY
  UPDATE public.telegram_link_challenges
  SET consumed_at = now()
  WHERE code_hash = trim(p_code_hash)
    AND consumed_at IS NULL
    AND expires_at > now()
  RETURNING telegram_link_challenges.user_id, telegram_link_challenges.purpose;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_telegram_link_code(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_telegram_link_code(TEXT) TO service_role;
