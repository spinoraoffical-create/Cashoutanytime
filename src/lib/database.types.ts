/**
 * Database types mirroring supabase/migrations.
 * Regenerate against a live project with:
 *   npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ── Enums ───────────────────────────────────────────────────────────────────

export type AppRole =
  | "super_admin"
  | "admin"
  | "manager"
  | "support_agent"
  | "moderator"
  | "customer";

export type VipTierKey = "silver" | "gold" | "platinum" | "diamond" | "elite";

export type RewardType =
  | "daily"
  | "weekly"
  | "monthly"
  | "streak_milestone"
  | "level_milestone"
  | "achievement"
  | "referral"
  | "seasonal"
  | "promotional"
  | "manual";

export type LedgerCurrency = "coins" | "xp";

export type LedgerEntryType =
  | "reward_claim"
  | "achievement_unlock"
  | "referral_bonus"
  | "promotion_claim"
  | "vip_bonus"
  | "admin_adjustment"
  | "signup_bonus";

export type AchievementCategory =
  | "gameplay"
  | "social"
  | "loyalty"
  | "milestone"
  | "seasonal"
  | "special";

export type AchievementRarity = "common" | "rare" | "epic" | "legendary";

export type AchievementCondition =
  | "xp_total"
  | "level_reached"
  | "streak_days"
  | "total_claims"
  | "referrals_qualified"
  | "profile_completed"
  | "favorites_added"
  | "leaderboard_top10"
  | "vip_tier_reached"
  | "manual";

export type ReferralStatus = "pending" | "qualified" | "rewarded" | "rejected";

export type LeaderboardPeriod = "daily" | "weekly" | "monthly" | "all_time";

export type PromoStatus = "draft" | "scheduled" | "active" | "expired" | "archived";

export type BannerPlacement =
  | "home_hero"
  | "home_strip"
  | "dashboard"
  | "promotions_page"
  | "home_popup";

export type NotificationType =
  | "system"
  | "reward"
  | "achievement"
  | "vip"
  | "referral"
  | "promotion"
  | "support"
  | "announcement";

export type BroadcastSegment =
  | "all"
  | "vip_silver_up"
  | "vip_gold_up"
  | "vip_platinum_up"
  | "vip_diamond_up"
  | "vip_elite";

export type TicketStatus = "open" | "pending" | "in_progress" | "resolved" | "closed";

export type TicketPriority = "low" | "normal" | "high" | "urgent";

export type TicketCategory =
  | "account"
  | "rewards"
  | "vip"
  | "referrals"
  | "technical"
  | "other";

export type AnnouncementLevel = "info" | "success" | "warning" | "critical";

// ── Row models ──────────────────────────────────────────────────────────────

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  country: string | null;
  xp: number;
  level: number;
  coins_balance: number;
  lifetime_coins: number;
  wallet_balance: number;
  cashout_wallet: number;
  current_streak: number;
  longest_streak: number;
  last_daily_claim: string | null;
  referral_code: string;
  referred_by: string | null;
  profile_completed: boolean;
  marketing_opt_in: boolean;
  is_banned: boolean;
  banned_reason: string | null;
  banned_at: string | null;
  banned_by: string | null;
  last_spin_at: string | null;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

export type SpinHistory = {
  id: string;
  user_id: string;
  segment: number;
  prize_coins: number;
  is_win: boolean;
  spun_at: string;
}

export type PublicProfile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  country: string | null;
  xp: number;
  level: number;
  current_streak: number;
  created_at: string;
}

export type Role = {
  id: string;
  key: AppRole;
  name: string;
  description: string;
  is_system: boolean;
  created_at: string;
}

export type Permission = {
  id: string;
  key: string;
  name: string;
  module: string;
  description: string;
  created_at: string;
}

export type RolePermission = {
  role_id: string;
  permission_id: string;
}

export type UserRole = {
  user_id: string;
  role_id: string;
  granted_by: string | null;
  granted_at: string;
}

export type VipTier = {
  id: string;
  key: VipTierKey;
  name: string;
  rank: number;
  min_xp: number;
  reward_multiplier: number;
  color: string;
  benefits: Json;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type VipStatus = {
  user_id: string;
  tier_id: string;
  is_override: boolean;
  override_reason: string | null;
  override_by: string | null;
  achieved_at: string;
  updated_at: string;
}

export type VipHistoryEntry = {
  id: string;
  user_id: string;
  from_tier: string | null;
  to_tier: string;
  reason: string;
  created_at: string;
}

export type RewardRule = {
  id: string;
  key: string;
  name: string;
  description: string;
  reward_type: RewardType;
  coins: number;
  xp: number;
  config: Json;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type RewardClaim = {
  id: string;
  user_id: string;
  rule_id: string | null;
  reward_type: RewardType;
  period_key: string;
  coins_awarded: number;
  xp_awarded: number;
  multiplier_applied: number;
  streak_at_claim: number | null;
  claimed_at: string;
}

export type LedgerEntry = {
  id: string;
  user_id: string;
  currency: LedgerCurrency;
  amount: number;
  balance_after: number;
  entry_type: LedgerEntryType;
  reference_type: string | null;
  reference_id: string | null;
  description: string;
  metadata: Json;
  created_at: string;
}

export type Achievement = {
  id: string;
  key: string;
  name: string;
  description: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  icon: string;
  condition_type: AchievementCondition;
  condition_value: number;
  xp_reward: number;
  coins_reward: number;
  is_secret: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type UserAchievement = {
  user_id: string;
  achievement_id: string;
  progress: number;
  unlocked_at: string | null;
}

export type Referral = {
  id: string;
  referrer_id: string;
  referred_id: string;
  code_used: string;
  status: ReferralStatus;
  signup_ip_hash: string | null;
  device_fingerprint: string | null;
  fraud_score: number;
  fraud_flags: Json;
  qualified_at: string | null;
  rewarded_at: string | null;
  rejected_reason: string | null;
  created_at: string;
}

export type LeaderboardEntry = {
  id: string;
  period: LeaderboardPeriod;
  period_key: string;
  user_id: string;
  score: number;
  rank: number | null;
  finalized: boolean;
  computed_at: string;
}

export type Promotion = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  image_url: string | null;
  badge_text: string | null;
  coins_bonus: number;
  xp_bonus: number;
  code: string | null;
  status: PromoStatus;
  is_featured: boolean;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  max_claims: number | null;
  max_claims_per_user: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type PromotionClaim = {
  id: string;
  promotion_id: string;
  user_id: string;
  claim_no: number;
  claimed_at: string;
}

export type Banner = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  link_url: string | null;
  placement: BannerPlacement;
  is_active: boolean;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export type AppNotification = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  link_url: string | null;
  icon: string | null;
  is_read: boolean;
  read_at: string | null;
  metadata: Json;
  created_at: string;
}

export type NotificationPreferences = {
  user_id: string;
  email_rewards: boolean;
  email_promotions: boolean;
  email_vip: boolean;
  email_referrals: boolean;
  email_support: boolean;
  email_announcements: boolean;
  inapp_rewards: boolean;
  inapp_promotions: boolean;
  inapp_vip: boolean;
  inapp_referrals: boolean;
  inapp_support: boolean;
  inapp_announcements: boolean;
  updated_at: string;
}

export type Broadcast = {
  id: string;
  title: string;
  body: string;
  link_url: string | null;
  segment: BroadcastSegment;
  recipient_count: number;
  sent_by: string | null;
  sent_at: string;
}

export type SupportTicket = {
  id: string;
  ticket_no: number;
  user_id: string;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  assigned_to: string | null;
  last_message_at: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export type TicketMessage = {
  id: string;
  ticket_id: string;
  sender_id: string;
  is_staff: boolean;
  body: string;
  attachment_url: string | null;
  created_at: string;
}

export type CmsPage = {
  id: string;
  slug: string;
  title: string;
  content: Json;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  is_published: boolean;
  published_at: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export type Faq = {
  id: string;
  question: string;
  answer: string;
  category: string;
  sort_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export type Announcement = {
  id: string;
  title: string;
  body: string;
  level: AnnouncementLevel;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type BlogPostStatus = "draft" | "scheduled" | "published" | "archived";

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  cover_image_url: string | null;
  tags: string[];
  author_id: string | null;
  is_published: boolean;
  status: BlogPostStatus;
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
}

export type Testimonial = {
  id: string;
  author_name: string;
  author_title: string;
  avatar_url: string | null;
  quote: string;
  rating: number;
  is_featured: boolean;
  is_published: boolean;
  sort_order: number;
  created_at: string;
}

export type PlayerReview = {
  id: string;
  user_id: string;
  rating: number;
  body: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export type GameCategory = {
  id: string;
  key: string;
  name: string;
  icon: string;
  sort_order: number;
  created_at: string;
}

export type Game = {
  id: string;
  slug: string;
  name: string;
  category_id: string;
  description: string;
  image_url: string | null;
  badge_text: string | null;
  is_featured: boolean;
  is_active: boolean;
  popularity: number;
  play_url: string | null;
  download_url: string | null;
  created_at: string;
  updated_at: string;
}

export type GeoState = {
  id: string;
  slug: string;
  name: string;
  abbr: string;
  hero_lede: string;
  meta_description: string;
  hero_image_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type GeoCity = {
  id: string;
  state_id: string;
  slug: string;
  name: string;
  description_snippet: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type UserFavorite = {
  user_id: string;
  game_id: string;
  created_at: string;
}

export type PaymentMethod = {
  id: string;
  key: string;
  label: string;
  kind: "handle" | "crypto" | "link";
  handle: string | null;
  handle_label: string | null;
  pay_link: string | null;
  qr_image_url: string | null;
  instructions: string | null;
  sort_order: number;
  is_active: boolean;
  updated_at: string;
  updated_by: string | null;
}

export type ActivityLogEntry = {
  id: string;
  user_id: string;
  action: string;
  description: string;
  metadata: Json;
  created_at: string;
}

export type AuditLogEntry = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_data: Json | null;
  after_data: Json | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export type ContactMessage = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: "new" | "read" | "archived";
  created_at: string;
};

export type GameRequest = {
  id: string;
  reference_code: string;
  name: string;
  contact_method: "whatsapp" | "telegram" | "messenger" | "phone";
  contact_value: string;
  game_id: string | null;
  request_type: "new_account" | "reload" | "deposit";
  existing_username: string | null;
  deposit_amount: number;
  payment_method: "cashapp" | "zelle" | "crypto" | "other" | "chime" | "paypal" | "venmo" | "bitcoin" | "usdt";
  payment_proof_path: string;
  notes: string | null;
  status: "pending" | "contacted" | "fulfilled" | "rejected";
  handled_by: string | null;
  user_id: string | null;
  game_username: string | null;
  credits_added: number | null;
  created_at: string;
  resolved_at: string | null;
};

export type GameServerConfig = {
  id: string;
  game_id: string;
  webhook_secret: string | null;
  api_base_url: string | null;
  api_key: string | null;
  notes: string | null;
  is_enabled: boolean;
  created_at: string;
  api_username: string | null;
  api_password: string | null;
  api_session: string | null;
  api_session_expires_at: string | null;
};

export type GameAccount = {
  id: string;
  user_id: string;
  game_id: string;
  game_username: string;
  game_user_id: string | null;
  credits_balance: number;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
  games?: {
    name: string;
    slug: string;
    image_url: string | null;
    play_url: string | null;
  };
};

export type GameProvisionJob = {
  id: string;
  request_id: string | null;
  user_id: string | null;
  game_id: string;
  kind: "create" | "recharge";
  game_username: string;
  game_password: string | null;
  amount: number;
  status: "queued" | "processing" | "done" | "failed";
  attempts: number;
  result: Json | null;
  error: string | null;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
  games?: { slug: string; name: string };
};

export type WalletLedgerEntry = {
  id: string;
  user_id: string;
  amount: number;
  balance_after: number;
  kind: "deposit" | "game_load" | "game_redeem" | "refund" | "adjustment" | "payout";
  wallet_type: "current" | "cashout";
  description: string | null;
  ref_id: string | null;
  created_at: string;
};

export type GameLoadRequest = {
  id: string;
  user_id: string;
  game_slug: string;
  game_name: string;
  amount: number;
  wallet_type: "current" | "cashout";
  load_type: "new_account" | "reload" | "redeem" | "check_balance";
  game_username: string | null;
  game_password: string | null;
  redeem_all: boolean;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  error_message: string | null;
  bot_attempts: number;
  wallet_refunded: boolean;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type SiteSetting = {
  key: string;
  value: Json;
  description: string;
  updated_by: string | null;
  updated_at: string;
}

export type TelegramBotPurpose = "admin" | "customer";

export type TelegramLinkCode = {
  code: string;
  purpose: TelegramBotPurpose;
  user_id: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
};

export type TelegramLink = {
  id: string;
  purpose: TelegramBotPurpose;
  telegram_user_id: number;
  chat_id: number;
  telegram_username: string | null;
  user_id: string;
  linked_at: string;
};

export type TelegramPromoMessage = {
  id: string;
  text: string;
  link: string | null;
  image_url: string | null;
  is_active: boolean;
  last_sent_at: string | null;
  created_at: string;
};

export type NewsletterCampaignSegment = "all" | "test";
export type NewsletterCampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "failed";

export type NewsletterCampaign = {
  id: string;
  name: string;
  subject: string;
  eyebrow: string;
  heading: string;
  subhead: string;
  body: string;
  cta_label: string;
  cta_href: string;
  stat1_value: string | null;
  stat1_label: string | null;
  stat2_value: string | null;
  stat2_label: string | null;
  stat3_value: string | null;
  stat3_label: string | null;
  segment: NewsletterCampaignSegment;
  status: NewsletterCampaignStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  sent_count: number;
  failed_count: number;
  total_recipients: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type NewsletterCampaignRecipientStatus = "pending" | "sent" | "failed";

export type NewsletterCampaignRecipient = {
  id: string;
  campaign_id: string;
  user_id: string;
  email: string;
  status: NewsletterCampaignRecipientStatus;
  sent_at: string | null;
  error: string | null;
  created_at: string;
};

// ── RPC results ─────────────────────────────────────────────────────────────

export type ClaimRewardResult = {
  claim_id: string;
  coins_awarded: number;
  xp_awarded: number;
  multiplier: number;
  streak: number;
  new_balance: number;
}

export type ClaimPromotionResult = {
  claim_id: string;
  coins_awarded: number;
  xp_awarded: number;
}

// ── Supabase generic helpers ────────────────────────────────────────────────

type TableDef<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: TableDef<Profile>;
      roles: TableDef<Role>;
      permissions: TableDef<Permission>;
      role_permissions: TableDef<RolePermission>;
      user_roles: TableDef<UserRole>;
      vip_tiers: TableDef<VipTier>;
      vip_status: TableDef<VipStatus>;
      vip_history: TableDef<VipHistoryEntry>;
      reward_rules: TableDef<RewardRule>;
      reward_claims: TableDef<RewardClaim>;
      ledger_entries: TableDef<LedgerEntry>;
      achievements: TableDef<Achievement>;
      user_achievements: TableDef<UserAchievement>;
      referrals: TableDef<Referral>;
      leaderboard_entries: TableDef<LeaderboardEntry>;
      promotions: TableDef<Promotion>;
      promotion_claims: TableDef<PromotionClaim>;
      banners: TableDef<Banner>;
      notifications: TableDef<AppNotification>;
      notification_preferences: TableDef<NotificationPreferences>;
      broadcasts: TableDef<Broadcast>;
      support_tickets: TableDef<SupportTicket>;
      ticket_messages: TableDef<TicketMessage>;
      cms_pages: TableDef<CmsPage>;
      faqs: TableDef<Faq>;
      announcements: TableDef<Announcement>;
      blog_posts: TableDef<BlogPost>;
      testimonials: TableDef<Testimonial>;
      player_reviews: TableDef<PlayerReview>;
      game_categories: TableDef<GameCategory>;
      games: TableDef<Game>;
      geo_states: TableDef<GeoState>;
      geo_cities: TableDef<GeoCity>;
      payment_methods: TableDef<PaymentMethod>;
      user_favorites: TableDef<UserFavorite>;
      activity_log: TableDef<ActivityLogEntry>;
      audit_logs: TableDef<AuditLogEntry>;
      site_settings: TableDef<SiteSetting>;
      telegram_link_codes: TableDef<TelegramLinkCode>;
      telegram_links: TableDef<TelegramLink>;
      telegram_promo_messages: TableDef<TelegramPromoMessage>;
      newsletter_campaigns: TableDef<NewsletterCampaign>;
      newsletter_campaign_recipients: TableDef<NewsletterCampaignRecipient>;
      contact_messages: TableDef<ContactMessage>;
      requests: TableDef<GameRequest>;
      game_accounts: TableDef<GameAccount>;
      game_server_configs: TableDef<GameServerConfig>;
      game_provision_jobs: TableDef<GameProvisionJob>;
      game_load_requests: TableDef<GameLoadRequest>;
      wallet_ledger: TableDef<WalletLedgerEntry>;
      rate_limits: TableDef<{
        bucket: string;
        window_start: string;
        hits: number;
      }>;
    };
    Views: Record<string, never>;
    Functions: {
      complete_my_profile: {
        Args: {
          p_display_name: string;
          p_country?: string | null;
          p_bio?: string | null;
          p_marketing_opt_in?: boolean;
        };
        Returns: void;
      };
      claim_spin: {
        Args: Record<string, never>;
        Returns: Json;
      };
      claim_reward: {
        Args: { rule_key: string };
        Returns: ClaimRewardResult[];
      };
      claim_promotion: {
        Args: { promo_slug: string; redeem_code?: string | null };
        Returns: ClaimPromotionResult[];
      };
      send_broadcast: {
        Args: {
          p_title: string;
          p_body: string;
          p_link_url?: string | null;
          p_segment?: BroadcastSegment;
        };
        Returns: string;
      };
      grant_coins: {
        Args: {
          target_user: string;
          amount: number;
          entry_type: LedgerEntryType;
          ref_type?: string | null;
          ref_id?: string | null;
          note?: string;
        };
        Returns: number;
      };
      grant_xp: {
        Args: {
          target_user: string;
          amount: number;
          entry_type: LedgerEntryType;
          ref_type?: string | null;
          ref_id?: string | null;
          note?: string;
        };
        Returns: number;
      };
      credit_wallet: {
        Args: {
          p_user: string;
          p_amount: number;
          p_kind: string;
          p_desc?: string | null;
          p_ref?: string | null;
        };
        Returns: number;
      };
      debit_wallet: {
        Args: {
          p_user: string;
          p_amount: number;
          p_kind: string;
          p_desc?: string | null;
          p_ref?: string | null;
        };
        Returns: number;
      };
      admin_payout_cashout: {
        Args: {
          p_user: string;
          p_amount: number;
          p_note?: string | null;
        };
        Returns: number;
      };
      admin_delete_user_account: {
        Args: {
          target_user_id: string;
        };
        Returns: undefined;
      };
      request_game_load: {
        Args: {
          p_game_slug: string;
          p_game_name: string;
          p_amount: number;
          p_load_type: string;
          p_game_username?: string | null;
        };
        Returns: string;
      };
      request_game_redeem: {
        Args: {
          p_game_slug: string;
          p_game_name: string;
          p_amount: number;
          p_game_username: string;
          p_redeem_all?: boolean;
        };
        Returns: string;
      };
      cancel_my_game_load: {
        Args: { p_request_id: string };
        Returns: undefined;
      };
      request_game_check_balance: {
        Args: { p_game_slug: string; p_game_name: string; p_game_username: string };
        Returns: string;
      };
      fail_stale_game_loads: {
        Args: { p_stale_minutes?: number; p_user_id?: string | null; p_game_slug?: string | null };
        Returns: number;
      };
      public_profiles_by_ids: {
        Args: { p_ids: string[] };
        Returns: PublicProfile[];
      };
      public_profiles_top: {
        Args: { p_limit?: number };
        Returns: PublicProfile[];
      };
      check_rate_limit: {
        Args: {
          p_bucket: string;
          p_max_hits: number;
          p_window_seconds: number;
        };
        Returns: boolean;
      };
      prune_rate_limits: { Args: Record<string, never>; Returns: number };
      has_role: { Args: { required: AppRole }; Returns: boolean };
      has_any_role: { Args: { required: AppRole[] }; Returns: boolean };
      has_permission: { Args: { perm_key: string }; Returns: boolean };
      is_staff: { Args: Record<string, never>; Returns: boolean };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      calculate_level: { Args: { xp_total: number }; Returns: number };
      xp_for_level: { Args: { level_target: number }; Returns: number };
      compute_leaderboard: {
        Args: {
          p: LeaderboardPeriod;
          p_key?: string | null;
          finalize?: boolean;
        };
        Returns: number;
      };
      period_key_for: {
        Args: { p: LeaderboardPeriod; at_time?: string };
        Returns: string;
      };
    };
    Enums: {
      app_role: AppRole;
      vip_tier_key: VipTierKey;
      reward_type: RewardType;
      ledger_currency: LedgerCurrency;
      ledger_entry_type: LedgerEntryType;
      achievement_category: AchievementCategory;
      achievement_rarity: AchievementRarity;
      achievement_condition: AchievementCondition;
      referral_status: ReferralStatus;
      leaderboard_period: LeaderboardPeriod;
      promo_status: PromoStatus;
      banner_placement: BannerPlacement;
      notification_type: NotificationType;
      broadcast_segment: BroadcastSegment;
      ticket_status: TicketStatus;
      ticket_priority: TicketPriority;
      ticket_category: TicketCategory;
      announcement_level: AnnouncementLevel;
    };
    CompositeTypes: Record<string, never>;
  };
}
