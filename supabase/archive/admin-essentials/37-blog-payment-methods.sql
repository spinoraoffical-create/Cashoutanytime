-- ============================================================================
-- WinSweeps · 0100 · Fix stale "30 minutes during support hours" deposit
-- claim in the seeded payment-methods blog post (0097) — wallet deposits now
-- clear in ~2 minutes, not gated to support hours.
-- ============================================================================

update public.blog_posts
set content = replace(
  content,
  'typically within 30 minutes during support hours.',
  'typically within 2 minutes.'
)
where slug = 'winsweeps-payment-methods-compared';
