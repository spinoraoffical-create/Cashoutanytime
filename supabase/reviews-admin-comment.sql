-- Add admin team reply on reviews — run in Supabase SQL Editor (if reviews table already exists)

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS admin_comment TEXT,
  ADD COLUMN IF NOT EXISTS admin_commented_at TIMESTAMPTZ;

UPDATE public.reviews
SET
  admin_comment = 'Thank you so much for sharing your review! ⭐ Your feedback helps us improve Spinora for everyone. We really appreciate you being part of our community — keep enjoying the games and message us anytime if you need help!',
  admin_commented_at = COALESCE(admin_commented_at, created_at)
WHERE admin_comment IS NULL;
