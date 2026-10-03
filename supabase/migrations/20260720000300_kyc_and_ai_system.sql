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
