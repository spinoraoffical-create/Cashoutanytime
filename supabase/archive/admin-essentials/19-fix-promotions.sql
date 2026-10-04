-- ============================================================================
-- WinSweeps · 0022 · Fix promotions — replace 200% seed with real offers
-- ============================================================================

-- Remove the placeholder 200% seed promotion
delete from public.promotions where slug = 'welcome-boost';

-- Insert the correct promotions matching the actual business model
insert into public.promotions
  (slug, title, summary, description, badge_text, coins_bonus, xp_bonus,
   status, is_featured, priority, starts_at, max_claims_per_user)
values
  ('first-deposit-50',
   '50% First Deposit Bonus',
   'Get 50% extra credits on your first deposit — applies to all 12 games. No code needed.',
   'Every new Win Sweeps player receives a 50% bonus on their first deposit, applied automatically to their game balance. Deposit $100, get $150 in credits on Fire Kirin, Juwa, Orion Stars, Game Vault or any of our 12 games.',
   'NEW PLAYERS', 0, 0, 'active', true, 5, now(), 1)
on conflict (slug) do update set
  title       = excluded.title,
  summary     = excluded.summary,
  description = excluded.description,
  badge_text  = excluded.badge_text,
  is_featured = excluded.is_featured,
  priority    = excluded.priority,
  status      = 'active';

-- Update arena-pass-bundle to be more accurate
update public.promotions set
  title       = 'Refer a Friend — Earn Bonus Credits',
  summary     = 'Share your referral code. When your friend makes their first deposit, you both earn bonus game credits instantly.',
  description = 'Share your unique referral code via WhatsApp, text, or social media. When a referred friend creates an account and makes their first deposit, you both receive bonus game credits — instantly, with no cap on referrals.',
  badge_text  = 'REFERRAL',
  is_featured = true,
  priority    = 10
where slug = 'arena-pass-bundle';

-- Keep weekend-xp-surge but fix the copy
update public.promotions set
  title       = 'VIP Reload Bonuses — 10% to 15%',
  summary     = 'Returning players earn 10–15% reload bonuses on every deposit based on VIP tier.',
  description = 'Every deposit after your first earns a reload bonus: Gold 10%, Platinum 12%, Diamond 14%, Elite 15%. Your VIP tier rises automatically with every deposit — no action required.',
  badge_text  = 'VIP'
where slug = 'weekend-xp-surge';
