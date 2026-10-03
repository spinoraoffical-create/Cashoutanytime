-- ==========================================
-- SPINORA AI SUPERCHARGE MIGRATION
-- AI Auto Blog, Telegram Broadcaster, AI Chatbot & Autonomous Analyzer
-- ==========================================

-- 1. AI Blog Settings Table
CREATE TABLE IF NOT EXISTS public.ai_blog_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  topics TEXT[] NOT NULL DEFAULT ARRAY['Online Gaming', 'Fish Table Games', 'Slot Strategies', 'Casino Bonuses', 'Spinora Guides'],
  target_keywords TEXT[] NOT NULL DEFAULT ARRAY['play online slots', 'juwa 777 download', 'orion stars online', 'fire kirin deposit', 'spinora bonus code'],
  posting_frequency_hours INT NOT NULL DEFAULT 24,
  ai_provider TEXT NOT NULL DEFAULT 'smart_auto',
  ai_model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  auto_publish BOOLEAN NOT NULL DEFAULT true,
  auto_telegram_broadcast BOOLEAN NOT NULL DEFAULT true,
  last_generated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. AI Telegram Settings Table
CREATE TABLE IF NOT EXISTS public.ai_telegram_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auto_post_blog BOOLEAN NOT NULL DEFAULT true,
  auto_post_promos BOOLEAN NOT NULL DEFAULT true,
  template_header TEXT NOT NULL DEFAULT '🔥 <b>SPINORA GAMING UPDATE</b> 🔥',
  template_footer TEXT NOT NULL DEFAULT '👉 Join now & claim your instant deposit bonus! 🚀',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. AI Chatbot Settings Table
CREATE TABLE IF NOT EXISTS public.ai_chatbot_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  bot_name TEXT NOT NULL DEFAULT 'Spinora AI Assistant',
  system_prompt TEXT NOT NULL DEFAULT 'You are Spinora AI Assistant, a friendly and highly knowledgeable gaming support bot. You assist users with game accounts (Juwa, Fire Kirin, Orion Stars, Game Vault), deposits, cashouts, VIP tiers, and bonuses.',
  auto_reply_enabled BOOLEAN NOT NULL DEFAULT true,
  human_handover_threshold NUMERIC(3, 2) NOT NULL DEFAULT 0.60,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. AI Chatbot Logs Table
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

-- 5. System Health & Autonomous Analyzer Logs Table
CREATE TABLE IF NOT EXISTS public.system_health_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  health_score INT NOT NULL DEFAULT 100,
  seo_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  cron_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  database_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.ai_blog_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_telegram_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chatbot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_health_logs ENABLE ROW LEVEL SECURITY;

-- Allow public read / staff manage policies
CREATE POLICY "Allow staff select ai_blog_settings" ON public.ai_blog_settings FOR SELECT USING (true);
CREATE POLICY "Allow staff update ai_blog_settings" ON public.ai_blog_settings FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow staff select ai_telegram_settings" ON public.ai_telegram_settings FOR SELECT USING (true);
CREATE POLICY "Allow staff update ai_telegram_settings" ON public.ai_telegram_settings FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow staff select ai_chatbot_settings" ON public.ai_chatbot_settings FOR SELECT USING (true);
CREATE POLICY "Allow staff update ai_chatbot_settings" ON public.ai_chatbot_settings FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert ai_chat_logs" ON public.ai_chat_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow select ai_chat_logs" ON public.ai_chat_logs FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert system_health_logs" ON public.system_health_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow select system_health_logs" ON public.system_health_logs FOR SELECT USING (true);

-- Pre-seed default settings if empty
INSERT INTO public.ai_blog_settings (id) VALUES ('00000000-0000-0000-0000-000000000001') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.ai_telegram_settings (id) VALUES ('00000000-0000-0000-0000-000000000001') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.ai_chatbot_settings (id) VALUES ('00000000-0000-0000-0000-000000000001') ON CONFLICT (id) DO NOTHING;
