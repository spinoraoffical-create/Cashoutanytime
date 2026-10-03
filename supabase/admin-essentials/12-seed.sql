-- ============================================================================
-- WinSweeps · 0013 · Seed — RBAC matrix, VIP tiers, rules, achievements, content
-- ============================================================================

-- ── Roles ────────────────────────────────────────────────────────────────────

insert into public.roles (key, name, description) values
  ('super_admin',   'Super Admin',   'Full platform control, role management, settings'),
  ('admin',         'Admin',         'Operations: users, rewards, promotions, CMS, analytics'),
  ('manager',       'Manager',       'Promotions, rewards, VIP and content management'),
  ('support_agent', 'Support Agent', 'Support inbox and member assistance'),
  ('moderator',     'Moderator',     'Community moderation and member flags'),
  ('customer',      'Customer',      'Standard member account');

-- ── Permissions ──────────────────────────────────────────────────────────────

insert into public.permissions (key, name, module, description) values
  ('users.manage',            'Manage users',            'users',         'View and edit member accounts, ban/unban'),
  ('users.roles',             'Assign roles',            'users',         'Grant or revoke staff roles'),
  ('rewards.manage',          'Manage rewards',          'rewards',       'Create and edit reward rules'),
  ('achievements.manage',     'Manage achievements',     'achievements',  'Create and edit achievements'),
  ('vip.manage',              'Manage VIP',              'vip',           'Edit tiers, multipliers and member overrides'),
  ('referrals.manage',        'Manage referrals',        'referrals',     'Review, approve and reject referrals'),
  ('promotions.manage',       'Manage promotions',       'promotions',    'Create, schedule and expire promotions'),
  ('leaderboards.manage',     'Manage leaderboards',     'leaderboards',  'Recompute and finalize leaderboards'),
  ('notifications.broadcast', 'Send broadcasts',         'notifications', 'Send announcements to member segments'),
  ('support.manage',          'Work support inbox',      'support',       'View, reply, assign and close tickets'),
  ('cms.manage',              'Manage CMS',              'cms',           'Pages, FAQ, banners, blog, catalog, testimonials'),
  ('analytics.read',          'View analytics',          'analytics',     'Access analytics dashboards'),
  ('audit.read',              'View audit logs',         'audit',         'Read the audit trail'),
  ('settings.manage',         'Manage settings',         'settings',      'Edit site-wide settings');

-- ── Role → permission matrix ────────────────────────────────────────────────

-- super_admin gets everything implicitly via has_permission(); also grant explicitly.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key = 'super_admin';

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key in (
  'users.manage','rewards.manage','achievements.manage','vip.manage','referrals.manage',
  'promotions.manage','leaderboards.manage','notifications.broadcast','support.manage',
  'cms.manage','analytics.read','audit.read'
) where r.key = 'admin';

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key in (
  'rewards.manage','achievements.manage','vip.manage','promotions.manage',
  'leaderboards.manage','cms.manage','analytics.read'
) where r.key = 'manager';

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key in (
  'support.manage'
) where r.key = 'support_agent';

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key in (
  'users.manage','support.manage'
) where r.key = 'moderator';

-- ── VIP tiers (multipliers per brief: Silver → Elite) ───────────────────────

insert into public.vip_tiers (key, name, rank, min_xp, reward_multiplier, color, benefits) values
  ('silver', 'Silver', 1, 0, 1.00, '#C7CCD6', '[
    {"title": "Member rewards", "description": "Daily, weekly and monthly reward streams", "icon": "gift"},
    {"title": "Community access", "description": "Leaderboards, achievements and referrals", "icon": "users"}
  ]'::jsonb),
  ('gold', 'Gold', 2, 5000, 1.10, '#F5C542', '[
    {"title": "1.1× reward multiplier", "description": "Boosted coins on every claim", "icon": "trending-up"},
    {"title": "Gold badge", "description": "Tier badge on profile and leaderboards", "icon": "badge-check"},
    {"title": "Priority queue", "description": "Faster support responses", "icon": "zap"}
  ]'::jsonb),
  ('platinum', 'Platinum', 3, 25000, 1.25, '#9AE6E0', '[
    {"title": "1.25× reward multiplier", "description": "Boosted coins on every claim", "icon": "trending-up"},
    {"title": "Exclusive promotions", "description": "Platinum-only bonus drops", "icon": "sparkles"},
    {"title": "Priority support", "description": "Front-of-line ticket handling", "icon": "headset"}
  ]'::jsonb),
  ('diamond', 'Diamond', 4, 100000, 1.50, '#22D3EE', '[
    {"title": "1.5× reward multiplier", "description": "Boosted coins on every claim", "icon": "trending-up"},
    {"title": "Personal host", "description": "Dedicated account manager", "icon": "user-star"},
    {"title": "Exclusive events", "description": "Diamond lounge tournaments and galas", "icon": "crown"},
    {"title": "Instant concierge", "description": "24/7 live chat under a minute", "icon": "message-circle"}
  ]'::jsonb),
  ('elite', 'Elite', 5, 500000, 2.00, '#8B5CF6', '[
    {"title": "2× reward multiplier", "description": "Double coins on every claim", "icon": "trending-up"},
    {"title": "Legendary status", "description": "Elite ring, custom flair, top billing", "icon": "gem"},
    {"title": "Concierge desk", "description": "White-glove service for everything", "icon": "concierge-bell"},
    {"title": "First access", "description": "New features and seasonal events first", "icon": "rocket"}
  ]'::jsonb);

-- ── Reward rules ─────────────────────────────────────────────────────────────

insert into public.reward_rules (key, name, description, reward_type, coins, xp, config) values
  ('daily_login', 'Daily Reward', 'Claim once per day. Streaks add +5 coins per consecutive day (cap +50).',
   'daily', 100, 50, '{"streak_bonus_per_day": 5, "streak_bonus_cap": 50}'),
  ('weekly_chest', 'Weekly Chest', 'Unlocks after 5 daily claims in the same week.',
   'weekly', 750, 300, '{"required_daily_claims": 5}'),
  ('monthly_vault', 'Monthly Vault', 'Unlocks after 20 daily claims in the same month.',
   'monthly', 3500, 1200, '{"required_daily_claims": 20}'),
  ('streak_7', '7-Day Streak Milestone', 'One-time bonus for a 7-day claim streak.',
   'streak_milestone', 500, 250, '{"days": 7}'),
  ('streak_30', '30-Day Streak Milestone', 'One-time bonus for a 30-day claim streak.',
   'streak_milestone', 3000, 1500, '{"days": 30}'),
  ('streak_100', '100-Day Streak Milestone', 'One-time bonus for a legendary 100-day streak.',
   'streak_milestone', 15000, 6000, '{"days": 100}'),
  ('referral_standard', 'Referral Bonus', 'Earned when a referred member completes their profile and reaches level 2.',
   'referral', 1000, 400, '{}'),
  ('season_summer_26', 'Summer Drop ''26', 'Limited seasonal bonus for active members.',
   'seasonal', 1500, 500, '{"season_key": "summer-2026"}');

-- ── Achievements ─────────────────────────────────────────────────────────────

insert into public.achievements
  (key, name, description, category, rarity, icon, condition_type, condition_value, xp_reward, coins_reward, sort_order) values
  ('first_claim',      'First Vault Open',   'Claim your first daily reward.',                'milestone', 'common',    'gift',         'total_claims',        1,    50,   100, 10),
  ('claims_25',        'Regular',            'Claim 25 rewards.',                             'loyalty',   'common',    'calendar-check','total_claims',       25,   200,   500, 20),
  ('claims_100',       'Devoted',            'Claim 100 rewards.',                            'loyalty',   'rare',      'calendar-heart','total_claims',      100,   750,  2000, 30),
  ('streak_7_badge',   'Week Warrior',       'Hold a 7-day claim streak.',                    'loyalty',   'common',    'flame',        'streak_days',         7,   150,   300, 40),
  ('streak_30_badge',  'Iron Streak',        'Hold a 30-day claim streak.',                   'loyalty',   'epic',      'flame',        'streak_days',        30,  1000,  2500, 50),
  ('streak_100_badge', 'Eternal Flame',      'Hold a 100-day claim streak.',                  'loyalty',   'legendary', 'flame',        'streak_days',       100,  5000, 10000, 60),
  ('level_5',          'Rising Star',        'Reach level 5.',                                'milestone', 'common',    'star',         'level_reached',       5,     0,   500, 70),
  ('level_10',         'Contender',          'Reach level 10.',                               'milestone', 'rare',      'star',         'level_reached',      10,     0,  1500, 80),
  ('level_25',         'Veteran',            'Reach level 25.',                               'milestone', 'epic',      'medal',        'level_reached',      25,     0,  5000, 90),
  ('level_50',         'Legend',             'Reach level 50.',                               'milestone', 'legendary', 'crown',        'level_reached',      50,     0, 20000, 100),
  ('profile_done',     'Identity Forged',    'Complete your profile.',                        'social',    'common',    'user-check',   'profile_completed',   1,   100,   200, 110),
  ('first_referral',   'Recruiter',          'Have a referral qualify.',                      'social',    'rare',      'user-plus',    'referrals_qualified', 1,   300,  1000, 120),
  ('referrals_5',      'Squad Builder',      'Have 5 referrals qualify.',                     'social',    'epic',      'users',        'referrals_qualified', 5,  1500,  5000, 130),
  ('referrals_25',     'Network Royalty',    'Have 25 referrals qualify.',                    'social',    'legendary', 'network',      'referrals_qualified',25, 10000, 25000, 140),
  ('favorites_5',      'Curator',            'Add 5 games to your favorites.',                'gameplay',  'common',    'heart',        'favorites_added',     5,    75,   150, 150),
  ('top10_finish',     'Podium Finish',      'Finish a leaderboard period in the top 10.',    'gameplay',  'epic',      'trophy',       'leaderboard_top10',   1,  2000,  5000, 160),
  ('vip_gold',         'Gilded',             'Reach Gold VIP tier.',                          'milestone', 'rare',      'badge-check',  'vip_tier_reached',    2,     0,  1000, 170),
  ('vip_diamond',      'Diamond Hands',      'Reach Diamond VIP tier.',                       'milestone', 'epic',      'gem',          'vip_tier_reached',    4,     0, 10000, 180),
  ('vip_elite',        'Apex',               'Reach Elite VIP tier.',                         'milestone', 'legendary', 'crown',        'vip_tier_reached',    5,     0, 50000, 190);

-- ── Game catalog (from design exports) ───────────────────────────────────────

insert into public.game_categories (key, name, icon, sort_order) values
  ('slots',        'Slots',           'cherry',      10),
  ('fishing',      'Fishing',         'fish',        20),
  ('table-games',  'Table Games',     'spade',       30),
  ('arcade',       'Arcade',          'gamepad-2',   40),
  ('seasonal',     'Seasonal Events', 'snowflake',   50);

insert into public.games (slug, name, category_id, description, badge_text, is_featured, popularity) values
  ('777-spin',         '777 Spin',          (select id from public.game_categories where key = 'slots'),       'High-volatility classic with elite rewards multipliers.', 'HOT',   true,  98),
  ('dragon-hoard',     'Dragon Hoard',      (select id from public.game_categories where key = 'slots'),       'Hunt the dragon''s vault across 50 paylines.',             'HOT',   true,  95),
  ('neon-poker-xl',    'Neon Poker XL',     (select id from public.game_categories where key = 'table-games'), 'Fast-deal poker under the neon lights.',                   null,    false, 88),
  ('abyss-hunter',     'Abyss Hunter',      (select id from public.game_categories where key = 'fishing'),     'Deep-sea trophy hunting with rising jackpots.',            null,    true,  92),
  ('golden-winter',    'Golden Winter',     (select id from public.game_categories where key = 'seasonal'),    'Limited seasonal event with frozen multipliers.',          'EVENT', false, 80),
  ('retro-rush',       'Retro Rush',        (select id from public.game_categories where key = 'arcade'),      'Arcade sprint through pixel-perfect bonus rounds.',        'NEW',   false, 76),
  ('pharaohs-gold',    'Pharaoh''s Gold',   (select id from public.game_categories where key = 'slots'),       'Tomb-deep spins with expanding golden reels.',             null,    false, 85),
  ('quantum-spin',     'Quantum Spin',      (select id from public.game_categories where key = 'slots'),       'Probability-bending reels and parallel-payline physics.',  null,    false, 71),
  ('mystic-grove',     'Mystic Grove',      (select id from public.game_categories where key = 'slots'),       'Enchanted forest free-spin chains.',                       null,    false, 69),
  ('cyber-strike',     'Cyber Strike',      (select id from public.game_categories where key = 'arcade'),      'Neon combat arcade with combo multipliers.',               null,    false, 74),
  ('olympus-gates',    'Olympus Gates',     (select id from public.game_categories where key = 'slots'),       'Climb the pantheon for god-tier multipliers.',             null,    true,  90),
  ('oceans-fortune',   'Ocean''s Fortune',  (select id from public.game_categories where key = 'fishing'),     'Deep-sea jackpot expedition with legendary loot.',         'HOT',   true,  94);

-- ── FAQ ──────────────────────────────────────────────────────────────────────

insert into public.faqs (question, answer, category, sort_order) values
  ('What is WinSweeps?',
   'WinSweeps is a premium social gaming rewards platform. You earn Sweeps Coins and XP through daily rewards, streaks, achievements, referrals and promotions — then climb VIP tiers for bigger multipliers.',
   'general', 10),
  ('Is WinSweeps free to play?',
   'Yes. Every reward stream on WinSweeps is free: daily, weekly and monthly claims, achievements, referrals and seasonal promotions. No purchase is ever required.',
   'general', 20),
  ('How do daily streaks work?',
   'Claim your daily reward on consecutive calendar days to build a streak. Each consecutive day adds a streak bonus to your claim, and milestone streaks (7, 30, 100 days) unlock one-time bonus vaults.',
   'rewards', 30),
  ('What are Sweeps Coins?',
   'Sweeps Coins are the WinSweeps virtual reward currency. They track your earnings across the platform and unlock achievements and leaderboard standing. They have no cash value.',
   'rewards', 40),
  ('How do VIP tiers work?',
   'XP you earn moves you through five tiers: Silver, Gold, Platinum, Diamond and Elite. Higher tiers multiply every coin reward you claim — up to 2× at Elite — and unlock exclusive perks.',
   'vip', 50),
  ('How does the referral program work?',
   'Share your unique referral code or link. When a friend joins, completes their profile and reaches level 2, the referral qualifies and your bonus is credited automatically.',
   'referrals', 60),
  ('When do leaderboards reset?',
   'Daily boards reset at midnight UTC, weekly boards on Monday, and monthly boards on the 1st. The all-time board never resets.',
   'leaderboards', 70),
  ('How do I contact support?',
   'Open a ticket from your dashboard''s Support section. Diamond and Elite members get priority handling with sub-minute live responses during peak hours.',
   'support', 80);

-- ── Testimonials ─────────────────────────────────────────────────────────────

insert into public.testimonials (author_name, author_title, quote, rating, is_featured, sort_order) values
  ('Marcus T.', 'Diamond Elite member', 'The streak system actually keeps me coming back. Hit my 100-day flame last month and the milestone vault was unreal.', 5, true, 10),
  ('Aria K.', 'Platinum member', 'Cleanest rewards platform I''ve used. The VIP multipliers make every claim feel like it matters.', 5, true, 20),
  ('DeVon R.', 'Gold member', 'Referred four friends, all qualified, all bonuses landed instantly. Zero friction.', 5, true, 30),
  ('Lena S.', 'Elite member', 'Concierge support answered in under a minute. This is what premium should feel like.', 5, false, 40);

-- ── CMS pages (structured homepage + static pages content) ──────────────────

insert into public.cms_pages (slug, title, is_published, published_at, content, seo_title, seo_description) values
  ('home', 'Homepage', true, now(), '{
    "hero": {
      "eyebrow": "A new era of immersive social gaming",
      "title_line1": "Play Bigger.",
      "title_line2": "Earn Smarter.",
      "subtitle": "Welcome to the world''s most immersive social sweepstakes platform — where gameplay meets uncompromising luxury.",
      "cta_primary": "Start Playing",
      "cta_secondary": "Explore VIP"
    },
    "stats": [
      {"label": "Coins awarded weekly", "value": "1.2M+"},
      {"label": "Active members", "value": "150K"},
      {"label": "Daily reward streams", "value": "8"},
      {"label": "Member satisfaction", "value": "4.9/5"}
    ],
    "cta_footer": {
      "title": "The Arena Awaits.",
      "subtitle": "Join the inner circle of global sweepstakes players. Registration is free — but the experience is priceless.",
      "button": "Create Free Account"
    }
  }'::jsonb,
  'WinSweeps — Play Bigger. Earn Smarter.',
  'Premium social gaming rewards: daily streaks, VIP multipliers, achievements, referrals and global leaderboards.'),
  ('about', 'About WinSweeps', true, now(), '{
    "mission": "WinSweeps exists to make loyalty feel luxurious. We built a rewards ecosystem where consistency is celebrated — daily streaks, milestone vaults, and a VIP ladder that treats every member like a high roller.",
    "values": [
      {"title": "Premium by default", "description": "Every surface, interaction and reward is designed to elite standard."},
      {"title": "Radically fair", "description": "Transparent rules, audited reward engines, zero pay-to-win."},
      {"title": "Community first", "description": "Leaderboards, referrals and events that bring players together."}
    ]
  }'::jsonb,
  'About — WinSweeps', 'The story and values behind the WinSweeps elite gaming ecosystem.');

-- ── Site settings ────────────────────────────────────────────────────────────

insert into public.site_settings (key, value, description) values
  ('maintenance_mode', '{"enabled": false, "message": ""}', 'Site-wide maintenance banner / lockout'),
  ('registration_open', '{"enabled": true}', 'Allow new member registration'),
  ('welcome_bonus', '{"coins": 250, "xp": 100, "title": "Welcome to Elite"}', 'Signup bonus granted on email verification'),
  ('social_links', '{"discord": "", "x": "", "instagram": "", "telegram": ""}', 'Community/footer social links');
