-- Widen payment_methods + seed settings for Spinora-like admin
-- Run AFTER admin-essentials-casinova.sql

ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'handle';
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS handle_label TEXT;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS pay_link TEXT;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS qr_image_url TEXT;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS instructions TEXT;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "Public read payment_methods" ON public.payment_methods;
DROP POLICY IF EXISTS "payment methods public read" ON public.payment_methods;
CREATE POLICY "payment methods public read"
  ON public.payment_methods FOR SELECT TO anon, authenticated
  USING (is_active = true OR public.is_admin());

INSERT INTO public.payment_methods (key, label, kind, handle_label, handle, pay_link, qr_image_url, sort_order, is_active) VALUES
  ('cashapp', 'Cash App', 'handle', 'Cashtag', '$YourCashtag', 'https://cash.app/$YourCashtag', '/payments/cashapp-qr.png', 1, true),
  ('chime', 'Chime', 'handle', 'Chime $tag', '$YourChime', NULL, '/payments/chime-qr.png', 2, true),
  ('paypal', 'PayPal', 'handle', 'PayPal', 'you@email.com', 'https://paypal.me/you', '/payments/paypal-qr.png', 3, true),
  ('venmo', 'Venmo', 'handle', 'Venmo', '@YourVenmo', 'https://venmo.com/u/YourVenmo', '/payments/venmo-qr.png', 4, true),
  ('bitcoin', 'Bitcoin', 'crypto', 'Bitcoin address', 'bc1youraddress', NULL, '/payments/bitcoin-qr.png', 5, true),
  ('usdt', 'USDT', 'crypto', 'USDT address (ERC-20)', '0xYourAddress', NULL, '/payments/usdt-qr.png', 6, true)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.site_settings (key, value) VALUES
  ('maintenance_mode', '{"enabled":false,"message":"We will be back shortly."}'::jsonb),
  ('registration_open', '{"enabled":true}'::jsonb),
  ('welcome_bonus', '{"coins":0,"xp":0,"title":"Welcome"}'::jsonb),
  ('social_links', '{"discord":"","x":"","instagram":"","telegram":""}'::jsonb),
  ('rewards_enabled', 'true'::jsonb),
  ('telegram_promo', '{"enabled":false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.telegram_promo_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  link TEXT,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.telegram_promo_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage telegram_promo_messages" ON public.telegram_promo_messages;
CREATE POLICY "Admins manage telegram_promo_messages" ON public.telegram_promo_messages FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Optional public media bucket for QR uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('cms-media', 'cms-media', true)
ON CONFLICT (id) DO NOTHING;

SELECT 'admin-payments-settings-upgrade applied' AS status;
