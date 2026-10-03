-- Spinora admin-essentials · RLS for NEW admin tables only
-- Does NOT enable RLS on profiles, referrals, notifications, or announcements
-- (keeps your existing Spinora app working).

alter table public.roles                    enable row level security;
alter table public.permissions              enable row level security;
alter table public.role_permissions         enable row level security;
alter table public.user_roles               enable row level security;
alter table public.vip_tiers                enable row level security;
alter table public.vip_status               enable row level security;
alter table public.vip_history              enable row level security;
alter table public.reward_rules             enable row level security;
alter table public.reward_claims            enable row level security;
alter table public.ledger_entries           enable row level security;
alter table public.achievements             enable row level security;
alter table public.user_achievements        enable row level security;
alter table public.leaderboard_entries      enable row level security;
alter table public.promotions               enable row level security;
alter table public.promotion_claims         enable row level security;
alter table public.banners                  enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.broadcasts               enable row level security;
alter table public.support_tickets          enable row level security;
alter table public.ticket_messages          enable row level security;
alter table public.cms_pages                enable row level security;
alter table public.faqs                     enable row level security;
alter table public.blog_posts               enable row level security;
alter table public.testimonials             enable row level security;
alter table public.game_categories          enable row level security;
alter table public.games                    enable row level security;
alter table public.user_favorites           enable row level security;
alter table public.activity_log             enable row level security;
alter table public.audit_logs               enable row level security;
alter table public.site_settings            enable row level security;

-- RBAC
drop policy if exists "roles readable by staff" on public.roles;
create policy "roles readable by staff" on public.roles for select using (public.is_staff());
drop policy if exists "roles managed by super admin" on public.roles;
create policy "roles managed by super admin" on public.roles for all using (public.has_role('super_admin')) with check (public.has_role('super_admin'));

drop policy if exists "permissions readable by staff" on public.permissions;
create policy "permissions readable by staff" on public.permissions for select using (public.is_staff());
drop policy if exists "permissions managed by super admin" on public.permissions;
create policy "permissions managed by super admin" on public.permissions for all using (public.has_role('super_admin')) with check (public.has_role('super_admin'));

drop policy if exists "role_permissions readable by staff" on public.role_permissions;
create policy "role_permissions readable by staff" on public.role_permissions for select using (public.is_staff());
drop policy if exists "role_permissions managed by super admin" on public.role_permissions;
create policy "role_permissions managed by super admin" on public.role_permissions for all using (public.has_role('super_admin')) with check (public.has_role('super_admin'));

drop policy if exists "user_roles self readable" on public.user_roles;
create policy "user_roles self readable" on public.user_roles for select using (user_id = auth.uid() or public.is_staff());
drop policy if exists "user_roles managed by admins" on public.user_roles;
create policy "user_roles managed by admins" on public.user_roles for all using (public.has_permission('users.roles')) with check (public.has_permission('users.roles'));

-- VIP
drop policy if exists "vip tiers public" on public.vip_tiers;
create policy "vip tiers public" on public.vip_tiers for select using (true);
drop policy if exists "vip tiers managed" on public.vip_tiers;
create policy "vip tiers managed" on public.vip_tiers for all using (public.has_permission('vip.manage')) with check (public.has_permission('vip.manage'));
drop policy if exists "vip status self" on public.vip_status;
create policy "vip status self" on public.vip_status for select using (user_id = auth.uid() or public.is_staff());
drop policy if exists "vip status managed" on public.vip_status;
create policy "vip status managed" on public.vip_status for all using (public.has_permission('vip.manage')) with check (public.has_permission('vip.manage'));
drop policy if exists "vip history self" on public.vip_history;
create policy "vip history self" on public.vip_history for select using (user_id = auth.uid() or public.is_staff());

-- Rewards
drop policy if exists "reward rules public read" on public.reward_rules;
create policy "reward rules public read" on public.reward_rules for select using (is_active or public.is_staff());
drop policy if exists "reward rules managed" on public.reward_rules;
create policy "reward rules managed" on public.reward_rules for all using (public.has_permission('rewards.manage')) with check (public.has_permission('rewards.manage'));
drop policy if exists "claims self readable" on public.reward_claims;
create policy "claims self readable" on public.reward_claims for select using (user_id = auth.uid() or public.is_staff());
drop policy if exists "ledger self readable" on public.ledger_entries;
create policy "ledger self readable" on public.ledger_entries for select using (user_id = auth.uid() or public.is_staff());

-- Achievements
drop policy if exists "achievements public read" on public.achievements;
create policy "achievements public read" on public.achievements for select using ((is_active and not is_secret) or public.is_staff());
drop policy if exists "achievements managed" on public.achievements;
create policy "achievements managed" on public.achievements for all using (public.has_permission('achievements.manage')) with check (public.has_permission('achievements.manage'));
drop policy if exists "user achievements self" on public.user_achievements;
create policy "user achievements self" on public.user_achievements for select using (user_id = auth.uid() or public.is_staff());

-- Leaderboards
drop policy if exists "leaderboards public read" on public.leaderboard_entries;
create policy "leaderboards public read" on public.leaderboard_entries for select using (true);

-- Promotions
drop policy if exists "promotions public read" on public.promotions;
create policy "promotions public read" on public.promotions for select using (
  (status = 'active' and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()))
  or public.is_staff()
);
drop policy if exists "promotions managed" on public.promotions;
create policy "promotions managed" on public.promotions for all using (public.has_permission('promotions.manage')) with check (public.has_permission('promotions.manage'));
drop policy if exists "promotion claims self" on public.promotion_claims;
create policy "promotion claims self" on public.promotion_claims for select using (user_id = auth.uid() or public.is_staff());
drop policy if exists "banners public read" on public.banners;
create policy "banners public read" on public.banners for select using (is_active or public.is_staff());
drop policy if exists "banners managed" on public.banners;
create policy "banners managed" on public.banners for all using (public.has_permission('cms.manage')) with check (public.has_permission('cms.manage'));
drop policy if exists "notification prefs self" on public.notification_preferences;
create policy "notification prefs self" on public.notification_preferences for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "broadcasts staff read" on public.broadcasts;
create policy "broadcasts staff read" on public.broadcasts for select using (public.is_staff());

-- Support
drop policy if exists "tickets self or staff read" on public.support_tickets;
create policy "tickets self or staff read" on public.support_tickets for select using (user_id = auth.uid() or public.has_permission('support.manage'));
drop policy if exists "tickets self create" on public.support_tickets;
create policy "tickets self create" on public.support_tickets for insert with check (user_id = auth.uid());
drop policy if exists "tickets staff update" on public.support_tickets;
create policy "tickets staff update" on public.support_tickets for update using (public.has_permission('support.manage')) with check (public.has_permission('support.manage'));
drop policy if exists "tickets self close" on public.support_tickets;
create policy "tickets self close" on public.support_tickets for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "ticket messages participants read" on public.ticket_messages;
create policy "ticket messages participants read" on public.ticket_messages for select using (
  exists (select 1 from public.support_tickets t where t.id = ticket_id and (t.user_id = auth.uid() or public.has_permission('support.manage')))
);
drop policy if exists "ticket messages participants write" on public.ticket_messages;
create policy "ticket messages participants write" on public.ticket_messages for insert with check (
  sender_id = auth.uid()
  and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.status <> 'closed' and (t.user_id = auth.uid() or public.has_permission('support.manage')))
  and (is_staff = public.has_permission('support.manage'))
);

-- CMS
drop policy if exists "cms published public" on public.cms_pages;
create policy "cms published public" on public.cms_pages for select using (is_published or public.has_permission('cms.manage'));
drop policy if exists "cms managed" on public.cms_pages;
create policy "cms managed" on public.cms_pages for all using (public.has_permission('cms.manage')) with check (public.has_permission('cms.manage'));
drop policy if exists "faqs public" on public.faqs;
create policy "faqs public" on public.faqs for select using (is_published or public.has_permission('cms.manage'));
drop policy if exists "faqs managed" on public.faqs;
create policy "faqs managed" on public.faqs for all using (public.has_permission('cms.manage')) with check (public.has_permission('cms.manage'));
drop policy if exists "blog published public" on public.blog_posts;
create policy "blog published public" on public.blog_posts for select using (is_published or public.has_permission('cms.manage'));
drop policy if exists "blog managed" on public.blog_posts;
create policy "blog managed" on public.blog_posts for all using (public.has_permission('cms.manage')) with check (public.has_permission('cms.manage'));
drop policy if exists "testimonials public" on public.testimonials;
create policy "testimonials public" on public.testimonials for select using (is_published or public.has_permission('cms.manage'));
drop policy if exists "testimonials managed" on public.testimonials;
create policy "testimonials managed" on public.testimonials for all using (public.has_permission('cms.manage')) with check (public.has_permission('cms.manage'));
drop policy if exists "game categories public" on public.game_categories;
create policy "game categories public" on public.game_categories for select using (true);
drop policy if exists "game categories managed" on public.game_categories;
create policy "game categories managed" on public.game_categories for all using (public.has_permission('cms.manage')) with check (public.has_permission('cms.manage'));
drop policy if exists "games public" on public.games;
create policy "games public" on public.games for select using (is_active or public.has_permission('cms.manage'));
drop policy if exists "games managed" on public.games;
create policy "games managed" on public.games for all using (public.has_permission('cms.manage')) with check (public.has_permission('cms.manage'));
drop policy if exists "favorites self" on public.user_favorites;
create policy "favorites self" on public.user_favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Audit & settings
drop policy if exists "activity self read" on public.activity_log;
create policy "activity self read" on public.activity_log for select using (user_id = auth.uid() or public.is_staff());
drop policy if exists "audit admin read" on public.audit_logs;
create policy "audit admin read" on public.audit_logs for select using (public.has_permission('audit.read'));
drop policy if exists "audit staff insert" on public.audit_logs;
create policy "audit staff insert" on public.audit_logs for insert with check (public.is_staff() and actor_id = auth.uid());
drop policy if exists "settings public read" on public.site_settings;
create policy "settings public read" on public.site_settings for select using (true);
drop policy if exists "settings managed" on public.site_settings;
create policy "settings managed" on public.site_settings for all using (public.has_permission('settings.manage')) with check (public.has_permission('settings.manage'));
