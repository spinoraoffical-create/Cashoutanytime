-- Deposit requests + proof storage — run in Supabase SQL Editor once.
-- Requires: chat-attachments bucket (supabase/chat-attachments.sql)

CREATE TABLE IF NOT EXISTS public.deposit_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_slug TEXT,
  game_name TEXT NOT NULL,
  payment_method TEXT NOT NULL CHECK (
    payment_method IN ('paypal', 'chime', 'cashapp', 'bitcoin', 'usdt', 'venmo')
  ),
  amount NUMERIC(10, 2),
  proof_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'completed', 'rejected')
  ),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deposit_requests_user ON public.deposit_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_deposit_requests_status ON public.deposit_requests (status);

CREATE TRIGGER deposit_requests_updated_at
  BEFORE UPDATE ON public.deposit_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.deposit_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own deposits"
  ON public.deposit_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users create own deposits"
  ON public.deposit_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins view all deposits"
  ON public.deposit_requests FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins update deposits"
  ON public.deposit_requests FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

ALTER TABLE public.deposit_requests REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.deposit_requests;

-- Storage: deposit-proofs/{user_id}/...
DROP POLICY IF EXISTS "Users can upload deposit proof images" ON storage.objects;
DROP POLICY IF EXISTS "Users and admins can read deposit proofs" ON storage.objects;

CREATE POLICY "Users can upload deposit proof images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND (storage.foldername(name))[1] = 'deposit-proofs'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Users and admins can read deposit proofs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND (storage.foldername(name))[1] = 'deposit-proofs'
  AND (
    (storage.foldername(name))[2] = auth.uid()::text
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
);
