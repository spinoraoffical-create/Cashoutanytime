-- ============================================================================
-- WinSweeps · 0011 · Row Level Security — every table locked by default
-- ============================================================================

-- ── Enable RLS everywhere ────────────────────────────────────────────────────

alter table public.roles                    enable row level security;
alter table public.permissions              enable row level security;
alter table public.role_permissions         enable row level security;
alter table public.user_roles               enable row level security;
alter table public.profiles                 enable row level security;
alter table public.vip_tiers                enable row level security;
alter table public.vip_status               enable row level security;
alter table public.vip_history              enable row level security;
alter table public.reward_rules             enable row level security;
alter table public.reward_claims            enable row level security;
alter table public.ledger_entries           enable row level security;
alter table public.achievements             enable row level security;
alter table public.user_achievements        enable row level security;
alter table public.referrals                enable row level security;
alter table public.leaderboard_entries      enable row level security;
alter table public.promotions               enable row level security;
alter table public.promotion_claims         enable row level security;
alter table public.banners                  enable row level security;
alter table public.notifications            enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.broadcasts               enable row level security;
alter table public.support_tickets          enable row level security;
alter table public.ticket_messages          enable row level security;
alter table public.cms_pages                enable row level security;
alter table public.faqs                     enable row level security;
alter table public.announcements            enable row level security;
alter table public.blog_posts               enable row level security;
alter table public.testimonials             enable row level security;
alter table public.game_categories          enable row level security;
alter table public.games                    enable row level security;
alter table public.user_favorites           enable row level security;
alter table public.activity_log             enable row level security;
alter table public.audit_logs               enable row level security;
alter table public.site_settings            enable row level security;

-- ── RBAC tables ──────────────────────────────────────────────────────────────

create policy "roles readable by staff" on public.roles
  for select using (public.is_staff());
create policy "roles managed by super admin" on public.roles
  for all using (public.has_role('super_admin')) with check (public.has_role('super_admin'));

create policy "permissions readable by staff" on public.permissions
  for select using (public.is_staff());
create policy "permissions managed by super admin" on public.permissions
  for all using (public.has_role('super_admin')) with check (public.has_role('super_admin'));

create policy "role_permissions readable by staff" on public.role_permissions
  for select using (public.is_staff());
create policy "role_permissions managed by super admin" on public.role_permissions
  for all using (public.has_role('super_admin')) with check (public.has_role('super_admin'));

create policy "user_roles self readable" on public.user_roles
  for select using (user_id = auth.uid() or public.is_staff());
create policy "user_roles managed by admins" on public.user_roles
  for all using (public.has_permission('users.roles'))
  with check (public.has_permission('users.roles'));

-- ── Profiles ─────────────────────────────────────────────────────────────────
-- Public identity flows through the public_profiles view; the base table is
-- self + staff only.

create policy "profiles self readable" on public.profiles
  for select using (id = auth.uid() or public.is_staff());

create policy "profiles self updatable" on public.profiles
  for update using (id = auth.uid() and is_banned = false)
  with check (id = auth.uid());
  -- column-level protection enforced by trg_profiles_protect

create policy "profiles admin update" on public.profiles
  for update using (public.has_permission('users.manage'))
  with check (public.has_permission('users.manage'));

-- ── VIP ──────────────────────────────────────────────────────────────────────

create policy "vip tiers public" on public.vip_tiers
  for select using (true);
create policy "vip tiers managed" on public.vip_tiers
  for all using (public.has_permission('vip.manage'))
  with check (public.has_permission('vip.manage'));

create policy "vip status self" on public.vip_status
  for select using (user_id = auth.uid() or public.is_staff());
create policy "vip status managed" on public.vip_status
  for all using (public.has_permission('vip.manage'))
  with check (public.has_permission('vip.manage'));

create policy "vip history self" on public.vip_history
  for select using (user_id = auth.uid() or public.is_staff());

-- ── Rewards ──────────────────────────────────────────────────────────────────

create policy "reward rules public read" on public.reward_rules
  for select using (is_active or public.is_staff());
create policy "reward rules managed" on public.reward_rules
  for all using (public.has_permission('rewards.manage'))
  with check (public.has_permission('rewards.manage'));

create policy "claims self readable" on public.reward_claims
  for select using (user_id = auth.uid() or public.is_staff());
-- inserts happen only inside SECURITY DEFINER claim functions

create policy "ledger self readable" on public.ledger_entries
  for select using (user_id = auth.uid() or public.is_staff());

-- ── Achievements ─────────────────────────────────────────────────────────────

create policy "achievements public read" on public.achievements
  for select using ((is_active and not is_secret) or public.is_staff());
create policy "achievements managed" on public.achievements
  for all using (public.has_permission('achievements.manage'))
  with check (public.has_permission('achievements.manage'));

create policy "user achievements self" on public.user_achievements
  for select using (user_id = auth.uid() or public.is_staff());

-- ── Referrals ────────────────────────────────────────────────────────────────

create policy "referrals visible to referrer" on public.referrals
  for select using (referrer_id = auth.uid() or referred_id = auth.uid() or public.is_staff());
create policy "referrals managed" on public.referrals
  for update using (public.has_permission('referrals.manage'))
  with check (public.has_permission('referrals.manage'));

-- ── Leaderboards (public) ────────────────────────────────────────────────────

create policy "leaderboards public read" on public.leaderboard_entries
  for select using (true);

-- ── Promotions & banners ─────────────────────────────────────────────────────

create policy "promotions public read" on public.promotions
  for select using (
    (status = 'active'
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at > now()))
    or public.is_staff()
  );
create policy "promotions managed" on public.promotions
  for all using (public.has_permission('promotions.manage'))
  with check (public.has_permission('promotions.manage'));

create policy "promotion claims self" on public.promotion_claims
  for select using (user_id = auth.uid() or public.is_staff());

create policy "banners public read" on public.banners
  for select using (is_active or public.is_staff());
create policy "banners managed" on public.banners
  for all using (public.has_permission('cms.manage'))
  with check (public.has_permission('cms.manage'));

-- ── Notifications ────────────────────────────────────────────────────────────

create policy "notifications self read" on public.notifications
  for select using (user_id = auth.uid());
create policy "notifications self mark read" on public.notifications
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "notifications self delete" on public.notifications
  for delete using (user_id = auth.uid());

create policy "notification prefs self" on public.notification_preferences
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "broadcasts staff read" on public.broadcasts
  for select using (public.is_staff());

-- ── Support ──────────────────────────────────────────────────────────────────

create policy "tickets self or staff read" on public.support_tickets
  for select using (
    user_id = auth.uid()
    or public.has_permission('support.manage')
  );
create policy "tickets self create" on public.support_tickets
  for insert with check (user_id = auth.uid());
create policy "tickets staff update" on public.support_tickets
  for update using (public.has_permission('support.manage'))
  with check (public.has_permission('support.manage'));
create policy "tickets self close" on public.support_tickets
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "ticket messages participants read" on public.ticket_messages
  for select using (
    exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id
        and (t.user_id = auth.uid() or public.has_permission('support.manage'))
    )
  );
create policy "ticket messages participants write" on public.ticket_messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id
        and t.status <> 'closed'
        and (t.user_id = auth.uid() or public.has_permission('support.manage'))
    )
    and (is_staff = public.has_permission('support.manage'))
  );

-- ── CMS & content ────────────────────────────────────────────────────────────

create policy "cms published public" on public.cms_pages
  for select using (is_published or public.has_permission('cms.manage'));
create policy "cms managed" on public.cms_pages
  for all using (public.has_permission('cms.manage'))
  with check (public.has_permission('cms.manage'));

create policy "faqs public" on public.faqs
  for select using (is_published or public.has_permission('cms.manage'));
create policy "faqs managed" on public.faqs
  for all using (public.has_permission('cms.manage'))
  with check (public.has_permission('cms.manage'));

create policy "announcements public" on public.announcements
  for select using (
    (is_active
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at > now()))
    or public.has_permission('cms.manage')
  );
create policy "announcements managed" on public.announcements
  for all using (public.has_permission('cms.manage'))
  with check (public.has_permission('cms.manage'));

create policy "blog published public" on public.blog_posts
  for select using (is_published or public.has_permission('cms.manage'));
create policy "blog managed" on public.blog_posts
  for all using (public.has_permission('cms.manage'))
  with check (public.has_permission('cms.manage'));

create policy "testimonials public" on public.testimonials
  for select using (is_published or public.has_permission('cms.manage'));
create policy "testimonials managed" on public.testimonials
  for all using (public.has_permission('cms.manage'))
  with check (public.has_permission('cms.manage'));

create policy "game categories public" on public.game_categories
  for select using (true);
create policy "game categories managed" on public.game_categories
  for all using (public.has_permission('cms.manage'))
  with check (public.has_permission('cms.manage'));

create policy "games public" on public.games
  for select using (is_active or public.has_permission('cms.manage'));
create policy "games managed" on public.games
  for all using (public.has_permission('cms.manage'))
  with check (public.has_permission('cms.manage'));

create policy "favorites self" on public.user_favorites
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── Activity & audit ─────────────────────────────────────────────────────────

create policy "activity self read" on public.activity_log
  for select using (user_id = auth.uid() or public.is_staff());

create policy "audit admin read" on public.audit_logs
  for select using (public.has_permission('audit.read'));
create policy "audit staff insert" on public.audit_logs
  for insert with check (public.is_staff() and actor_id = auth.uid());

-- ── Settings ─────────────────────────────────────────────────────────────────

create policy "settings public read" on public.site_settings
  for select using (true);
create policy "settings managed" on public.site_settings
  for all using (public.has_permission('settings.manage'))
  with check (public.has_permission('settings.manage'));
