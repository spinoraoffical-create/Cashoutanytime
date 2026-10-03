-- ============================================================================
-- WinSweeps · 0001 · Extensions & Enum Types (safe to re-run)
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ── Enums (skip if already created) ─────────────────────────────────────────

do $$ begin
  create type public.app_role as enum (
    'super_admin', 'admin', 'manager', 'support_agent', 'moderator', 'customer'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.vip_tier_key as enum (
    'silver', 'gold', 'platinum', 'diamond', 'elite'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.reward_type as enum (
    'daily', 'weekly', 'monthly', 'streak_milestone', 'level_milestone',
    'achievement', 'referral', 'seasonal', 'promotional', 'manual'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.ledger_currency as enum ('coins', 'xp');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.ledger_entry_type as enum (
    'reward_claim', 'achievement_unlock', 'referral_bonus', 'promotion_claim',
    'vip_bonus', 'admin_adjustment', 'signup_bonus'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.achievement_category as enum (
    'gameplay', 'social', 'loyalty', 'milestone', 'seasonal', 'special'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.achievement_rarity as enum ('common', 'rare', 'epic', 'legendary');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.achievement_condition as enum (
    'xp_total', 'level_reached', 'streak_days', 'total_claims',
    'referrals_qualified', 'profile_completed', 'favorites_added',
    'leaderboard_top10', 'vip_tier_reached', 'manual'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.referral_status as enum ('pending', 'qualified', 'rewarded', 'rejected');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.leaderboard_period as enum ('daily', 'weekly', 'monthly', 'all_time');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.promo_status as enum ('draft', 'scheduled', 'active', 'expired', 'archived');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.banner_placement as enum (
    'home_hero', 'home_strip', 'dashboard', 'promotions_page'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.notification_type as enum (
    'system', 'reward', 'achievement', 'vip', 'referral',
    'promotion', 'support', 'announcement'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.broadcast_segment as enum (
    'all', 'vip_silver_up', 'vip_gold_up', 'vip_platinum_up', 'vip_diamond_up', 'vip_elite'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.ticket_status as enum ('open', 'pending', 'in_progress', 'resolved', 'closed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.ticket_priority as enum ('low', 'normal', 'high', 'urgent');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.ticket_category as enum (
    'account', 'rewards', 'vip', 'referrals', 'technical', 'other'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.announcement_level as enum ('info', 'success', 'warning', 'critical');
exception when duplicate_object then null;
end $$;

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
