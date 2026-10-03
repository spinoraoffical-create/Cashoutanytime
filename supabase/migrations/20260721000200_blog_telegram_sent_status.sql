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
