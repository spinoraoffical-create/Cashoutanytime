-- ============================================================================
-- WinSweeps · 0001 · Extensions & Enum Types
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ── Enums ───────────────────────────────────────────────────────────────────

create type public.app_role as enum (
  'super_admin', 'admin', 'manager', 'support_agent', 'moderator', 'customer'
);

create type public.vip_tier_key as enum (
  'silver', 'gold', 'platinum', 'diamond', 'elite'
);

create type public.reward_type as enum (
  'daily', 'weekly', 'monthly', 'streak_milestone', 'level_milestone',
  'achievement', 'referral', 'seasonal', 'promotional', 'manual'
);

create type public.ledger_currency as enum ('coins', 'xp');

create type public.ledger_entry_type as enum (
  'reward_claim', 'achievement_unlock', 'referral_bonus', 'promotion_claim',
  'vip_bonus', 'admin_adjustment', 'signup_bonus'
);

create type public.achievement_category as enum (
  'gameplay', 'social', 'loyalty', 'milestone', 'seasonal', 'special'
);

create type public.achievement_rarity as enum ('common', 'rare', 'epic', 'legendary');

create type public.achievement_condition as enum (
  'xp_total', 'level_reached', 'streak_days', 'total_claims',
  'referrals_qualified', 'profile_completed', 'favorites_added',
  'leaderboard_top10', 'vip_tier_reached', 'manual'
);

create type public.referral_status as enum ('pending', 'qualified', 'rewarded', 'rejected');

create type public.leaderboard_period as enum ('daily', 'weekly', 'monthly', 'all_time');

create type public.promo_status as enum ('draft', 'scheduled', 'active', 'expired', 'archived');

create type public.banner_placement as enum (
  'home_hero', 'home_strip', 'dashboard', 'promotions_page'
);

create type public.notification_type as enum (
  'system', 'reward', 'achievement', 'vip', 'referral',
  'promotion', 'support', 'announcement'
);

create type public.broadcast_segment as enum (
  'all', 'vip_silver_up', 'vip_gold_up', 'vip_platinum_up', 'vip_diamond_up', 'vip_elite'
);

create type public.ticket_status as enum ('open', 'pending', 'in_progress', 'resolved', 'closed');

create type public.ticket_priority as enum ('low', 'normal', 'high', 'urgent');

create type public.ticket_category as enum (
  'account', 'rewards', 'vip', 'referrals', 'technical', 'other'
);

create type public.announcement_level as enum ('info', 'success', 'warning', 'critical');

-- ── updated_at convenience trigger fn ───────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
