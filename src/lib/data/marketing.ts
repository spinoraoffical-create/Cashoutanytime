import "server-only";

import { unstable_cache } from "next/cache";

import { resolveBlogCoverUrl } from "@/lib/blog-cover";
import { sortReviewsForDisplay } from "@/lib/reviews/display";
import { createStaticClient } from "@/lib/supabase/static";
import { createAdminClient } from "@/lib/supabase/admin";
import { DYNAMIC_AI_POSTS } from "@/lib/ai/blog-generator";
import { GEO_STATES, type CityData, type StateData } from "@/lib/geo-data";
import type { ReviewWithAuthor } from "@/types/database";
import type {
  BlogPost,
  Faq,
  Game,
  GameCategory,
  PaymentMethod,
  Promotion,
  RewardRule,
  Testimonial,
  VipTier,
} from "@/lib/database.types";

/**
 * Public-content fetchers for the marketing site.
 *
 * Every fetcher queries Supabase first and falls back to constants that
 * mirror the seed migration (supabase/migrations/20260613000013_seed.sql)
 * when the database is unreachable — e.g. local builds before env keys are
 * configured. Fallbacks are the same rows the seed installs, not mock data.
 */

async function withFallback<T>(query: Promise<T | null>, fallback: T): Promise<T> {
  try {
    const abort = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error("supabase-timeout")), 5000),
    );
    const result = await Promise.race([query, abort]);
    return result ?? fallback;
  } catch {
    return fallback;
  }
}

/** Rewrite legacy WinSweeps copy from seed migrations to Spinora branding. */
function spinoraBrandText(value: string | null | undefined): string | null {
  if (value == null || value === "") return value ?? null;
  return value.replace(/WinSweeps/g, "Spinora").replace(/winsweeps/g, "Spinora");
}

function spinoraBrandPost<T extends MarketingPost>(post: T): T {
  return {
    ...post,
    title: spinoraBrandText(post.title) ?? post.title,
    excerpt: spinoraBrandText(post.excerpt),
    cover_image_url: resolveBlogCoverUrl(post.slug, post.cover_image_url),
    seo_title: spinoraBrandText(post.seo_title),
    seo_description: spinoraBrandText(post.seo_description),
    tags: (post.tags ?? []).map((t) => spinoraBrandText(t) ?? t),
  };
}

function spinoraBrandPostFull(post: MarketingPostFull): MarketingPostFull {
  const branded = spinoraBrandPost(post);
  return {
    ...branded,
    content: spinoraBrandText(post.content) ?? post.content,
  };
}

// ── VIP tiers ────────────────────────────────────────────────────────────────

const FALLBACK_TIERS: Pick<
  VipTier,
  "key" | "name" | "rank" | "min_xp" | "reward_multiplier" | "color" | "benefits"
>[] = [
  {
    key: "silver", name: "Silver", rank: 1, min_xp: 0, reward_multiplier: 1.0,
    color: "#C7CCD6",
    benefits: [
      { title: "Member rewards", description: "Daily, weekly and monthly reward streams", icon: "gift" },
      { title: "Community access", description: "Leaderboards, achievements and referrals", icon: "users" },
    ],
  },
  {
    key: "gold", name: "Gold", rank: 2, min_xp: 5000, reward_multiplier: 1.1,
    color: "#F5C542",
    benefits: [
      { title: "1.1× reward multiplier", description: "Boosted coins on every claim", icon: "trending-up" },
      { title: "Gold badge", description: "Tier badge on profile and leaderboards", icon: "badge-check" },
      { title: "Priority queue", description: "Faster support responses", icon: "zap" },
    ],
  },
  {
    key: "platinum", name: "Platinum", rank: 3, min_xp: 25000, reward_multiplier: 1.25,
    color: "#9AE6E0",
    benefits: [
      { title: "1.25× reward multiplier", description: "Boosted coins on every claim", icon: "trending-up" },
      { title: "Exclusive promotions", description: "Platinum-only bonus drops", icon: "sparkles" },
      { title: "Priority support", description: "Front-of-line ticket handling", icon: "headset" },
    ],
  },
  {
    key: "diamond", name: "Diamond", rank: 4, min_xp: 100000, reward_multiplier: 1.5,
    color: "#22D3EE",
    benefits: [
      { title: "1.5× reward multiplier", description: "Boosted coins on every claim", icon: "trending-up" },
      { title: "Personal host", description: "Dedicated account manager", icon: "user-star" },
      { title: "Exclusive events", description: "Diamond lounge tournaments and galas", icon: "crown" },
      { title: "Instant concierge", description: "24/7 live chat under a minute", icon: "message-circle" },
    ],
  },
  {
    key: "elite", name: "Elite", rank: 5, min_xp: 500000, reward_multiplier: 2.0,
    color: "#8B5CF6",
    benefits: [
      { title: "2× reward multiplier", description: "Double coins on every claim", icon: "trending-up" },
      { title: "Legendary status", description: "Elite ring, custom flair, top billing", icon: "gem" },
      { title: "Concierge desk", description: "White-glove service for everything", icon: "concierge-bell" },
      { title: "First access", description: "New features and seasonal events first", icon: "rocket" },
    ],
  },
];

export type MarketingTier = (typeof FALLBACK_TIERS)[number];

export async function getVipTiers(): Promise<MarketingTier[]> {
  return withFallback(
    (async () => {
      const supabase = createStaticClient();
      const { data, error } = await supabase
        .from("vip_tiers")
        .select("key, name, rank, min_xp, reward_multiplier, color, benefits")
        .eq("is_active", true)
        .order("rank");
      if (error || !data?.length) return null;
      return data as MarketingTier[];
    })(),
    FALLBACK_TIERS
  );
}

// ── Reward rules ─────────────────────────────────────────────────────────────

const FALLBACK_RULES: Pick<
  RewardRule,
  "key" | "name" | "description" | "reward_type" | "coins" | "xp"
>[] = [
  { key: "daily_login", name: "Daily Reward", reward_type: "daily", coins: 100, xp: 50,
    description: "Claim once per day. Streaks add +5 coins per consecutive day (cap +50)." },
  { key: "weekly_chest", name: "Weekly Chest", reward_type: "weekly", coins: 750, xp: 300,
    description: "Unlocks after 5 daily claims in the same week." },
  { key: "monthly_vault", name: "Monthly Vault", reward_type: "monthly", coins: 3500, xp: 1200,
    description: "Unlocks after 20 daily claims in the same month." },
  { key: "streak_7", name: "7-Day Streak Milestone", reward_type: "streak_milestone", coins: 500, xp: 250,
    description: "One-time bonus for a 7-day claim streak." },
  { key: "streak_30", name: "30-Day Streak Milestone", reward_type: "streak_milestone", coins: 3000, xp: 1500,
    description: "One-time bonus for a 30-day claim streak." },
  { key: "streak_100", name: "100-Day Streak Milestone", reward_type: "streak_milestone", coins: 15000, xp: 6000,
    description: "One-time bonus for a legendary 100-day streak." },
  { key: "referral_standard", name: "Referral Bonus", reward_type: "referral", coins: 1000, xp: 400,
    description: "Earned when a referred member completes their profile and reaches level 2." },
  { key: "season_summer_26", name: "Summer Drop '26", reward_type: "seasonal", coins: 1500, xp: 500,
    description: "Limited seasonal bonus for active members." },
];

export type MarketingRule = (typeof FALLBACK_RULES)[number];

export async function getRewardRules(): Promise<MarketingRule[]> {
  return withFallback(
    (async () => {
      const supabase = createStaticClient();
      const { data, error } = await supabase
        .from("reward_rules")
        .select("key, name, description, reward_type, coins, xp")
        .eq("is_active", true)
        .order("created_at");
      if (error || !data?.length) return null;
      return data as MarketingRule[];
    })(),
    FALLBACK_RULES
  );
}

// ── FAQs ─────────────────────────────────────────────────────────────────────

const FALLBACK_FAQS: Pick<Faq, "question" | "answer" | "category" | "sort_order">[] = [
  { category: "general", sort_order: 1, question: "How do I create a game account and start playing?",
    answer: "Sign up for a free Spinora account, then open any game and create your in-game account in one click. Your username and password are generated instantly — no download and no waiting. Add funds to your wallet, load credits into the game, and play in minutes." },
  { category: "deposits", sort_order: 2, question: "How do deposits and wallet loading work?",
    answer: "You fund your Spinora wallet once, then load credits into any game instantly from your dashboard. Deposit by CashApp, Zelle, Bitcoin or USDT — we verify the payment and credit your wallet, usually within 2 minutes. From there, loading a game is instant." },
  { category: "deposits", sort_order: 3, question: "Do I need an existing account on Fire Kirin, Juwa or other platforms?",
    answer: "No. Spinora creates the in-game account for you instantly when you pick a game. One Spinora wallet works across all 12 games, so you never juggle separate logins or balances." },
  { category: "deposits", sort_order: 4, question: "Which payment methods do you accept?",
    answer: "We accept CashApp, Zelle, Bitcoin and USDT. Choose a method on the deposit page, send your payment, and upload the confirmation — your wallet is credited once it clears, usually within 2 minutes." },
  { category: "rewards", sort_order: 5, question: "What bonuses and promotions are available?",
    answer: "New players get a 50% welcome bonus on their first deposit, credited automatically. Every reload after that earns a 10–15% bonus based on your VIP tier. On top of that you get a daily spin, daily reward claims, weekly streak rewards, and referral bonuses." },
  { category: "rewards", sort_order: 6, question: "How do daily spins and streak rewards work?",
    answer: "Claim one daily reward every day to build your streak — longer streaks unlock bigger weekly and milestone rewards. You also get a free daily spin for a chance at bonus coins. Both reset daily, so logging in consistently pays off." },
  { category: "vip", sort_order: 7, question: "How do VIP tiers work?",
    answer: "XP you earn moves you through five tiers: Silver, Gold, Platinum, Diamond and Elite. Higher tiers multiply every coin reward you claim — up to 2× at Elite — and unlock bigger reload bonuses and priority support." },
  { category: "referrals", sort_order: 8, question: "How does the referral program work?",
    answer: "Share your unique referral link. When a friend signs up and makes their first deposit, you both earn bonus credits automatically — no codes to redeem and no limit on how many friends you invite." },
  { category: "support", sort_order: 9, question: "How do I contact support?",
    answer: "Open a support ticket from your dashboard for the fastest help. You can also reach us on Telegram — our support bot and community group links are in the footer and on the contact page. Support is available 24/7." },
];

export type MarketingFaq = (typeof FALLBACK_FAQS)[number];

// Dashboard home (a dynamic route) calls this on every visit; cache it so
// near-static FAQ content isn't re-queried from Supabase on every navigation.
export const getFaqs = unstable_cache(
  async (): Promise<MarketingFaq[]> => {
    return withFallback(
      (async () => {
        const supabase = createStaticClient();
        const { data, error } = await supabase
          .from("faqs")
          .select("question, answer, category, sort_order")
          .eq("is_published", true)
          .order("sort_order");
        if (error || !data?.length) return null;
        return data;
      })(),
      FALLBACK_FAQS
    );
  },
  ["marketing-faqs"],
  { revalidate: 300 }
);

// ── Player reviews (legacy `reviews` table — real user submissions) ───────────

const REVIEW_AUTHOR_SELECT =
  "id, user_id, rating, comment, admin_liked, admin_liked_at, admin_comment, admin_commented_at, created_at, updated_at, author:profiles!reviews_user_id_fkey(full_name, email, avatar_url, vip_tier)";

/** Homepage review cards — liked reviews first, then newest. */
export const getHomepageReviews = unstable_cache(
  async (): Promise<ReviewWithAuthor[]> => {
    try {
      const supabase = createStaticClient();
      const { data, error } = await supabase
        .from("reviews")
        .select(REVIEW_AUTHOR_SELECT)
        .order("created_at", { ascending: false })
        .limit(24);
      if (error || !data?.length) return [];
      return sortReviewsForDisplay(data as ReviewWithAuthor[]).slice(0, 4);
    } catch {
      return [];
    }
  },
  ["marketing-homepage-reviews"],
  { revalidate: 300 }
);

// ── CMS testimonials (optional marketing quotes — separate from player reviews) ─

const FALLBACK_TESTIMONIALS: Pick<
  Testimonial,
  "author_name" | "author_title" | "quote" | "rating"
>[] = [];

export type MarketingTestimonial = (typeof FALLBACK_TESTIMONIALS)[number];

export const getTestimonials = unstable_cache(
  async (): Promise<MarketingTestimonial[]> => {
    return withFallback(
      (async () => {
        const supabase = createStaticClient();
        const { data, error } = await supabase
          .from("testimonials")
          .select("author_name, author_title, quote, rating")
          .eq("is_published", true)
          .order("sort_order");
        if (error || !data?.length) return null;
        return data;
      })(),
      FALLBACK_TESTIMONIALS
    );
  },
  ["marketing-testimonials"],
  { revalidate: 300 }
);

export type PopupBanner = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  link_url: string | null;
};

/** The single active homepage popup banner, if any (null when none is live). */
export async function getActivePopupBanner(): Promise<PopupBanner | null> {
  return withFallback(
    (async () => {
      const supabase = createStaticClient();
      const { data, error } = await supabase
        .from("banners")
        .select("id, title, subtitle, image_url, link_url, starts_at, ends_at")
        .eq("placement", "home_popup")
        .eq("is_active", true)
        .order("priority");
      if (error || !data?.length) return null;
      const now = Date.now();
      const live = data.find(
        (b) =>
          (!b.starts_at || new Date(b.starts_at).getTime() <= now) &&
          (!b.ends_at || new Date(b.ends_at).getTime() >= now)
      );
      return live ?? null;
    })(),
    null
  );
}

// ── Game categories (with counts) ────────────────────────────────────────────

const FALLBACK_CATEGORIES: (Pick<GameCategory, "key" | "name" | "icon"> & {
  game_count: number;
})[] = [
  { key: "slots", name: "Slots", icon: "cherry", game_count: 6 },
  { key: "fishing", name: "Fishing", icon: "fish", game_count: 2 },
  { key: "table-games", name: "Table Games", icon: "spade", game_count: 1 },
  { key: "arcade", name: "Arcade", icon: "gamepad-2", game_count: 2 },
  { key: "seasonal", name: "Seasonal Events", icon: "snowflake", game_count: 1 },
];

export type MarketingCategory = (typeof FALLBACK_CATEGORIES)[number];

export async function getGameCategories(): Promise<MarketingCategory[]> {
  return withFallback(
    (async () => {
      const supabase = createStaticClient();
      const { data, error } = await supabase
        .from("game_categories")
        .select("key, name, icon, games(count)")
        .order("sort_order");
      if (error || !data?.length) return null;
      return data.map((c) => ({
        key: c.key,
        name: c.name,
        icon: c.icon,
        game_count:
          (c.games as unknown as { count: number }[])?.[0]?.count ?? 0,
      }));
    })(),
    FALLBACK_CATEGORIES
  );
}

// ── Promotions ───────────────────────────────────────────────────────────────

const FALLBACK_PROMOTIONS: Pick<
  Promotion,
  "slug" | "title" | "summary" | "description" | "badge_text" | "coins_bonus" | "xp_bonus" | "is_featured"
>[] = [
  { slug: "first-deposit-bonus", title: "50% Welcome Bonus", badge_text: "NEW PLAYERS",
    summary: "Get 50% extra credits on your first deposit — every game, no code needed.",
    description: "Every new Spinora player gets a 50% bonus on their first deposit, applied automatically. Deposit $100, load $150 in credits across Fire Kirin, Juwa, Orion Stars, Game Vault or any of our 12 games.",
    coins_bonus: 0, xp_bonus: 0, is_featured: true },
  { slug: "vip-reload-bonus", title: "10–15% Reload Bonus", badge_text: "EVERY DEPOSIT",
    summary: "Earn 10–15% extra on every reload after your first — your tier sets the rate.",
    description: "Every deposit after your first earns a reload bonus that scales with your VIP tier: Gold 10%, Platinum 12%, Diamond 14%, Elite 15%. Your tier rises automatically as you play — nothing to claim.",
    coins_bonus: 0, xp_bonus: 0, is_featured: true },
  { slug: "daily-spin", title: "Free Daily Spin", badge_text: "DAILY",
    summary: "Spin the wheel once a day for free bonus coins — resets every 24 hours.",
    description: "Open your dashboard each day for a free spin of the rewards wheel. Land bonus coins, XP boosts and more. It costs nothing and resets daily, so the more you show up, the more you win.",
    coins_bonus: 0, xp_bonus: 0, is_featured: false },
  { slug: "weekly-streak", title: "Weekly Streak Rewards", badge_text: "WEEKLY",
    summary: "Claim daily to build a streak and unlock weekly chests and milestone vaults.",
    description: "Claim one reward a day to keep your streak alive. Five claims in a week opens a Weekly Chest; longer streaks unlock 7-, 30- and 100-day milestone vaults worth thousands of coins.",
    coins_bonus: 0, xp_bonus: 0, is_featured: false },
  { slug: "refer-and-earn", title: "Refer & Earn", badge_text: "UNLIMITED",
    summary: "Invite friends — you both earn bonus credits when they make their first deposit.",
    description: "Share your referral link. When a friend signs up and makes their first deposit, you both get bonus credits automatically. No codes, no limit on invites — stack rewards with every friend who joins.",
    coins_bonus: 0, xp_bonus: 0, is_featured: false },
  { slug: "weekly-leaderboard-bonus", title: "Weekly Leaderboard Bonus", badge_text: "COMPETE",
    summary: "Top-ranked players earn bonus credits every week. Climb the leaderboard to win.",
    description: "Each week, the top players on the Spinora leaderboard earn bonus game credits. Play more to climb the standings and claim your weekly reward.",
    coins_bonus: 0, xp_bonus: 0, is_featured: false },
];

export type MarketingPromotion = (typeof FALLBACK_PROMOTIONS)[number];

export async function getActivePromotions(): Promise<MarketingPromotion[]> {
  return withFallback(
    (async () => {
      const supabase = createStaticClient();
      const { data, error } = await supabase
        .from("promotions")
        .select(
          "slug, title, summary, description, badge_text, coins_bonus, xp_bonus, is_featured"
        )
        .eq("status", "active")
        .order("priority");
      if (error || !data?.length) return null;
      return data;
    })(),
    FALLBACK_PROMOTIONS
  );
}

// ── Games catalog ─────────────────────────────────────────────────────────────

export type MarketingGame = Pick<
  Game,
  "id" | "slug" | "name" | "description" | "image_url" | "badge_text" | "is_featured" | "popularity" | "play_url" | "download_url"
>;

const FALLBACK_GAMES: MarketingGame[] = [
  { id: "a1", slug: "fire-kirin",    name: "Fire Kirin",     description: "The ultimate fish table game — massive schools, legendary catches and jackpots that scale with every shot.",                       image_url: null, badge_text: "HOT",  is_featured: true,  popularity: 100, play_url: null, download_url: null },
  { id: "a2", slug: "juwa",          name: "Juwa",           description: "High-speed fish hunting with multi-level boss battles, explosive bonus rounds and one of the highest payout rates in the lineup.", image_url: null, badge_text: "HOT",  is_featured: true,  popularity: 98,  play_url: null, download_url: null },
  { id: "a3", slug: "orion-stars",   name: "Orion Stars",    description: "Constellation-themed fish table with stellar jackpots that light up the board. Smooth controls, deep multipliers.",               image_url: null, badge_text: null,   is_featured: true,  popularity: 95,  play_url: null, download_url: null },
  { id: "a4", slug: "game-vault",    name: "Game Vault",     description: "An entire vault of premium sweepstakes games in one platform — slots, fish tables and arcade titles.",                            image_url: null, badge_text: "HOT",  is_featured: true,  popularity: 94,  play_url: null, download_url: null },
  { id: "a5", slug: "vegas-sweeps",  name: "Vegas Sweeps",   description: "Authentic Vegas-style slots with real reels, classic bonus rounds and the neon-lit jackpots the Strip is famous for.",            image_url: null, badge_text: null,   is_featured: true,  popularity: 91,  play_url: null, download_url: null },
  { id: "a6", slug: "milky-way",     name: "Milky Way",      description: "Space-themed fish table where galactic multipliers rain down during bonus storms.",                                                 image_url: null, badge_text: null,   is_featured: true,  popularity: 89,  play_url: null, download_url: null },
  { id: "a7", slug: "panda-master",  name: "Panda Master",   description: "Bamboo forest fish action with powerful Panda Boss encounters and sudden multiplier bursts.",                                      image_url: null, badge_text: null,   is_featured: true,  popularity: 87,  play_url: null, download_url: null },
  { id: "a8", slug: "cash-frenzy",   name: "Cash Frenzy",    description: "Non-stop slot action built for speed — rapid spins, free-spin chain reactions and a cash meter that climbs every round.",         image_url: null, badge_text: null,   is_featured: false, popularity: 85,  play_url: null, download_url: null },
  { id: "a9", slug: "vblink",        name: "VBlink",         description: "Blink and you'll miss a payout — VBlink runs at breakneck speed with instant-reload bonus rounds.",                               image_url: null, badge_text: "NEW",  is_featured: false, popularity: 82,  play_url: null, download_url: null },
  { id: "b1", slug: "mafia",         name: "Mafia",          description: "Run the underworld: arcade-style fish table with street boss showdowns and crime syndicate jackpot pools.",                        image_url: null, badge_text: null,   is_featured: false, popularity: 80,  play_url: null, download_url: null },
  { id: "b2", slug: "mr-all-in-one", name: "Mr. All In One", description: "Fish tables, slots and more inside a single platform — the all-in-one destination for players who want variety.",                  image_url: null, badge_text: null,   is_featured: false, popularity: 78,  play_url: null, download_url: null },
  { id: "b3", slug: "cash-machine",  name: "Cash Machine",   description: "Steady paylines and a generous free-spin engine — the Cash Machine rewards consistent play with sweeps coin payouts.",             image_url: null, badge_text: null,   is_featured: false, popularity: 75,  play_url: null, download_url: null },
];

export const getGames = unstable_cache(
  async (): Promise<MarketingGame[]> =>
    withFallback(
      (async () => {
        const supabase = createStaticClient();
        const { data, error } = await supabase
          .from("games")
          .select(
            "id, slug, name, description, image_url, badge_text, is_featured, popularity, play_url, download_url"
          )
          .eq("is_active", true)
          .order("popularity", { ascending: false });
        if (error || !data?.length) return null;
        const rows = data as MarketingGame[];
        const seen = new Set<string>();
        return rows.filter((g) => {
          const key = g.slug.trim().toLowerCase();
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      })(),
      FALLBACK_GAMES
    ),
  ["marketing-games"],
  { revalidate: 300 }
);

// ── Geo (state/city) pages — admin-managed, static fallback = GEO_STATES ────

export async function getGeoStates(): Promise<StateData[]> {
  return withFallback(
    (async () => {
      const supabase = createStaticClient();
      const { data: states, error } = await supabase
        .from("geo_states")
        .select("id, slug, name, abbr, hero_lede, meta_description, hero_image_url, sort_order")
        .eq("is_active", true)
        .order("sort_order");
      if (error || !states?.length) return null;

      const { data: cities } = await supabase
        .from("geo_cities")
        .select("state_id, slug, name, description_snippet, sort_order")
        .eq("is_active", true)
        .order("sort_order");

      return states.map((s) => ({
        name: s.name,
        abbr: s.abbr,
        slug: s.slug,
        heroLede: s.hero_lede,
        metaDescription: s.meta_description,
        heroImageUrl: s.hero_image_url ?? undefined,
        cities: (cities ?? [])
          .filter((c) => c.state_id === s.id)
          .map((c) => ({ name: c.name, slug: c.slug, descriptionSnippet: c.description_snippet })),
      })) as StateData[];
    })(),
    Object.values(GEO_STATES),
  );
}

export async function getGeoState(slug: string): Promise<StateData | null> {
  const states = await getGeoStates();
  return states.find((s) => s.slug === slug) ?? null;
}

export async function getGeoCity(stateSlug: string, citySlug: string): Promise<CityData | null> {
  const state = await getGeoState(stateSlug);
  return state?.cities.find((c) => c.slug === citySlug) ?? null;
}

export async function allGeoStateSlugs(): Promise<string[]> {
  return (await getGeoStates()).map((s) => s.slug);
}

export async function allGeoCityParams(): Promise<{ state: string; city: string }[]> {
  return (await getGeoStates()).flatMap((s) => s.cities.map((c) => ({ state: s.slug, city: c.slug })));
}

// ── Payment methods (deposit page switcher; admin-managed) ───────────────────

export type MarketingPaymentMethod = Pick<
  PaymentMethod,
  "key" | "label" | "kind" | "handle" | "handle_label" | "pay_link" | "qr_image_url" | "instructions"
>;

const FALLBACK_PAYMENT_METHODS: MarketingPaymentMethod[] = [
  { key: "cashapp", label: "Cash App", kind: "handle", handle: "$YourCashtag", handle_label: "Cashtag", pay_link: "https://cash.app/$YourCashtag", qr_image_url: null, instructions: null },
  { key: "chime", label: "Chime", kind: "handle", handle: "$YourChimeSign", handle_label: "Chime $ChimeSign", pay_link: null, qr_image_url: null, instructions: null },
  { key: "paypal", label: "PayPal", kind: "handle", handle: "you@email.com", handle_label: "PayPal", pay_link: "https://paypal.me/you", qr_image_url: null, instructions: null },
  { key: "venmo", label: "Venmo", kind: "handle", handle: "@YourVenmo", handle_label: "Venmo", pay_link: "https://venmo.com/u/YourVenmo", qr_image_url: null, instructions: null },
  { key: "bitcoin", label: "Bitcoin", kind: "crypto", handle: "bc1youraddress", handle_label: "Bitcoin address", pay_link: null, qr_image_url: null, instructions: null },
  { key: "usdt", label: "USDT", kind: "crypto", handle: "0xYourAddress", handle_label: "USDT address (ERC-20)", pay_link: null, qr_image_url: null, instructions: null },
];

export async function getPaymentMethods(): Promise<MarketingPaymentMethod[]> {
  return withFallback(
    (async () => {
      const supabase = createStaticClient();
      const { data, error } = await supabase
        .from("payment_methods")
        .select("key, label, kind, handle, handle_label, pay_link, qr_image_url, instructions")
        .eq("is_active", true)
        .order("sort_order");
      if (error || !data?.length) return null;
      return data as MarketingPaymentMethod[];
    })(),
    FALLBACK_PAYMENT_METHODS,
  );
}

export async function getGame(slug: string): Promise<MarketingGame | null> {
  try {
    const supabase = createStaticClient();
    const { data } = await supabase
      .from("games")
      .select("id, slug, name, description, image_url, badge_text, is_featured, popularity, play_url, download_url")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();
    if (data) return data as MarketingGame;
    // fallback to static list
    return FALLBACK_GAMES.find((g) => g.slug === slug) ?? null;
  } catch {
    return FALLBACK_GAMES.find((g) => g.slug === slug) ?? null;
  }
}

// ── Blog ──────────────────────────────────────────────────────────────────────

export type MarketingPost = Pick<
  BlogPost,
  "id" | "slug" | "title" | "excerpt" | "cover_image_url" | "tags" | "published_at" | "seo_title" | "seo_description"
>;

export type MarketingPostFull = MarketingPost & Pick<BlogPost, "content">;

// Static fallback mirrors migration 20260614000021_blog_seed.sql
const FALLBACK_BLOG_POSTS: MarketingPost[] = [
  { id: "p01", slug: "fire-kirin-online",           title: "Fire Kirin Online — The Complete Player Guide",                                 excerpt: "Everything you need to know about Fire Kirin: how the game works, how to create an account, and how to maximize your 50% first deposit bonus.", cover_image_url: "https://images.pexels.com/photos/35736659/pexels-photo-35736659.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["fire kirin", "fish table", "beginner guide"],           published_at: new Date(Date.now() - 6 * 86400000).toISOString(), seo_title: null, seo_description: null },
  { id: "p02", slug: "juwa-fish-table-game",         title: "Juwa Game — How to Play & Win at Spinora",                                  excerpt: "Juwa is one of the fastest fish table games online. Here's everything you need to know: how to get started, how to win, and how to claim your bonus.", cover_image_url: "https://images.pexels.com/photos/8817671/pexels-photo-8817671.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["juwa", "juwa game", "fish table"],                       published_at: new Date(Date.now() - 5 * 86400000).toISOString(), seo_title: null, seo_description: null },
  { id: "p03", slug: "orion-stars-online",           title: "Orion Stars Online — Complete Game Guide",                                     excerpt: "Orion Stars brings constellation jackpots and stellar multipliers to the fish table genre. Here's how to play and win.", cover_image_url: "https://images.pexels.com/photos/18425164/pexels-photo-18425164.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["orion stars", "orion stars online", "fish table"],       published_at: new Date(Date.now() - 4 * 86400000).toISOString(), seo_title: null, seo_description: null },
  { id: "p04", slug: "fire-kirin-vs-juwa-vs-orion-stars", title: "Fire Kirin vs Juwa vs Orion Stars — Which Fish Table Game Is Best?", excerpt: "Comparing the top 3 fish table games at Spinora: payout styles, game speed, bonus rounds and which one fits your play style.", cover_image_url: "https://images.pexels.com/photos/36484265/pexels-photo-36484265.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["fire kirin vs juwa", "best fish table game"],             published_at: new Date(Date.now() - 4 * 86400000).toISOString(), seo_title: null, seo_description: null },
  { id: "p05", slug: "best-fish-table-games-online", title: "Best Fish Table Games Online in 2025 — All 12 Ranked",                        excerpt: "We rank all 12 Spinora fish table and sweepstakes games by payout style, bonus frequency and beginner-friendliness.", cover_image_url: "https://images.pexels.com/photos/25798270/pexels-photo-25798270.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["fish table games", "best sweepstakes games"],             published_at: new Date(Date.now() - 3 * 86400000).toISOString(), seo_title: null, seo_description: null },
  { id: "p06", slug: "what-are-sweepstakes-games",   title: "What Are Sweepstakes Games? How They Work & Why They're Legal",               excerpt: "Sweepstakes gaming is one of the fastest-growing entertainment models in the US. Here's how it works, why it's legal, and what makes fish table sweepstakes so popular.", cover_image_url: "https://images.pexels.com/photos/29790832/pexels-photo-29790832.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["sweepstakes games", "are sweepstakes games legal"],      published_at: new Date(Date.now() - 3 * 86400000).toISOString(), seo_title: null, seo_description: null },
  { id: "p07", slug: "how-to-deposit-cashapp-fish-table", title: "How to Deposit with CashApp for Fish Table Games — Step by Step",     excerpt: "The fastest way to fund your Spinora account is CashApp. Here's the exact process from first deposit to your game credits being loaded.", cover_image_url: "https://images.pexels.com/photos/29502369/pexels-photo-29502369.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["cashapp fish table", "deposit cashapp sweepstakes"],     published_at: new Date(Date.now() - 2 * 86400000).toISOString(), seo_title: null, seo_description: null },
  { id: "p08", slug: "how-to-deposit-zelle-fish-table", title: "How to Deposit with Zelle for Fish Table Games — Complete Guide",        excerpt: "Zelle is one of the most secure and instant ways to deposit at Spinora. Here's exactly how to do it.", cover_image_url: "https://images.pexels.com/photos/6406691/pexels-photo-6406691.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["zelle fish table", "deposit zelle sweepstakes"],         published_at: new Date(Date.now() - 2 * 86400000).toISOString(), seo_title: null, seo_description: null },
  { id: "p09", slug: "crypto-deposits-fish-table",   title: "CashApp, Zelle or Crypto — Best Deposit Method for Fish Table Games",         excerpt: "Not sure which payment method to use at Spinora? We break down CashApp, Zelle, Bitcoin and USDT so you can choose the right one.", cover_image_url: "https://images.pexels.com/photos/29502363/pexels-photo-29502363.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["crypto fish table", "bitcoin sweepstakes"],               published_at: new Date(Date.now() - 1 * 86400000).toISOString(), seo_title: null, seo_description: null },
  { id: "p10", slug: "50-percent-first-deposit-bonus-explained", title: "50% First Deposit Bonus at Spinora — How to Claim It",       excerpt: "Spinora gives every new player a 50% bonus on their first deposit. Here's exactly how it works, what games it applies to, and how to maximize it.", cover_image_url: "https://images.pexels.com/photos/54284/pexels-photo-54284.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["first deposit bonus", "50% bonus sweepstakes"],          published_at: new Date(Date.now() - 1 * 86400000).toISOString(), seo_title: null, seo_description: null },
  { id: "p11", slug: "how-to-create-fire-kirin-account-online", title: "How to Create a Fire Kirin Account Online in Under 10 Minutes", excerpt: "You don't need to download an app or visit a location. Here's the exact process to create a Fire Kirin account online at Spinora.", cover_image_url: "https://images.pexels.com/photos/4841182/pexels-photo-4841182.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["create fire kirin account online", "fire kirin login"],  published_at: new Date(Date.now() - 12 * 3600000).toISOString(), seo_title: null, seo_description: null },
  { id: "p12", slug: "fish-table-games-online-texas", title: "Fish Table Games Online in Texas — Play Fire Kirin, Juwa & More",          excerpt: "Texas players can access all 12 Spinora fish table and sweepstakes games online. Here's how to get started from Houston, Dallas, San Antonio or anywhere in Texas.", cover_image_url: "https://images.pexels.com/photos/29096083/pexels-photo-29096083.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["fish table games texas", "fire kirin texas"],             published_at: new Date(Date.now() - 8 * 3600000).toISOString(), seo_title: null, seo_description: null },
  { id: "p13", slug: "game-vault-online-guide",       title: "Game Vault Online — Complete Guide to the All-in-One Platform",              excerpt: "Game Vault is the only Spinora game that packs fish tables, slots and arcade games into one platform. Here's everything you need to know.", cover_image_url: "https://images.pexels.com/photos/17370315/pexels-photo-17370315.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["game vault online", "game vault sweepstakes"],           published_at: new Date(Date.now() - 4 * 3600000).toISOString(), seo_title: null, seo_description: null },
  { id: "p14", slug: "panda-master-online-guide",     title: "Panda Master Online — Tips, Strategies & How to Get Started",               excerpt: "Panda Master is a bamboo forest fish table game with powerful Boss encounters and sudden multiplier bursts. Here's how to win.", cover_image_url: "https://images.pexels.com/photos/17255079/pexels-photo-17255079.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["panda master online", "panda master fish table"],        published_at: new Date(Date.now() - 2 * 3600000).toISOString(), seo_title: null, seo_description: null },
  { id: "p15", slug: "milky-way-fish-table-guide",    title: "Milky Way Fish Table Game — Galactic Jackpots Explained",                   excerpt: "Milky Way is a space fish table game where galactic multipliers rain down during bonus storms. Here's everything you need to know.", cover_image_url: "https://images.pexels.com/photos/7267577/pexels-photo-7267577.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["milky way game", "milky way fish table"],                published_at: new Date(Date.now() - 1 * 3600000).toISOString(), seo_title: null, seo_description: null },
  { id: "p16", slug: "win-at-fish-table-games-strategies", title: "How to Win at Fish Table Games — Top Strategies That Actually Work", excerpt: "Most fish table players waste ammo on the wrong targets. Here are the strategies that experienced Spinora players use to stay profitable.", cover_image_url: "https://images.pexels.com/photos/30427909/pexels-photo-30427909.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["how to win fish table", "fish table strategy"],           published_at: new Date(Date.now() - 30 * 60000).toISOString(), seo_title: null, seo_description: null },
  { id: "p17", slug: "vblink-cash-frenzy-guide",      title: "VBlink & Cash Frenzy — The Fastest Slots at Spinora",                    excerpt: "VBlink and Cash Frenzy are the two highest-speed slot titles in the Spinora lineup. Here's what makes them different.", cover_image_url: "https://images.pexels.com/photos/20843727/pexels-photo-20843727.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["vblink game", "cash frenzy online"],                      published_at: new Date(Date.now() - 20 * 60000).toISOString(), seo_title: null, seo_description: null },
  { id: "p18", slug: "fish-table-games-florida",      title: "Fish Table Games Online in Florida — Play From Miami, Orlando & Beyond",     excerpt: "Florida players access all 12 Spinora fish table and sweepstakes games online. Play Fire Kirin, Juwa and more from Miami, Jacksonville, Orlando, Tampa.", cover_image_url: "https://images.pexels.com/photos/4841183/pexels-photo-4841183.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["fish table games florida", "fire kirin florida"],        published_at: new Date(Date.now()).toISOString(), seo_title: null, seo_description: null },

  // ── 30 additional game-focused posts ────────────────────────────────────────
  { id: "p19", slug: "vegas-sweeps-online-guide",          title: "Vegas Sweeps Online — Classic Slots & Neon Jackpots at Spinora",                   excerpt: "Vegas Sweeps brings authentic casino-style slots to sweepstakes gaming. Learn how the reels work, which paylines pay best, and how to claim your first deposit bonus.", cover_image_url: "https://images.pexels.com/photos/9648243/pexels-photo-9648243.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["vegas sweeps", "vegas sweeps online", "sweepstakes slots"],              published_at: new Date(Date.now() - 2 * 3600000).toISOString(),  seo_title: null, seo_description: null },
  { id: "p20", slug: "mafia-fish-table-game-guide",        title: "Mafia Fish Table Game — Boss Showdowns & Crime Pool Jackpots Explained",              excerpt: "Mafia is the underground hit of the Spinora lineup — street boss battles, syndicate jackpot pools and explosive multipliers. Here's how to dominate it.", cover_image_url: "https://images.pexels.com/photos/106152/euro-coins-currency-money-106152.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["mafia fish table", "mafia sweepstakes game"],                       published_at: new Date(Date.now() - 3 * 3600000).toISOString(),  seo_title: null, seo_description: null },
  { id: "p21", slug: "mr-all-in-one-game-guide",           title: "Mr. All In One — Fish Tables, Slots & Arcade in One Login",                           excerpt: "Can't decide between fish tables and slots? Mr. All In One delivers every format on a single platform. Here's a full breakdown of what's inside.", cover_image_url: "https://images.pexels.com/photos/29702644/pexels-photo-29702644.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["mr all in one", "all in one sweepstakes game"],                     published_at: new Date(Date.now() - 4 * 3600000).toISOString(),  seo_title: null, seo_description: null },
  { id: "p22", slug: "cash-machine-fish-table-guide",      title: "Cash Machine Game — Steady Paylines & Free-Spin Engine Guide",                        excerpt: "Cash Machine is the consistent earner of the Spinora catalog — reliable paylines and a generous free-spin engine that rewards patient play.", cover_image_url: "https://images.pexels.com/photos/18425165/pexels-photo-18425165.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["cash machine game", "cash machine fish table"],                    published_at: new Date(Date.now() - 5 * 3600000).toISOString(),  seo_title: null, seo_description: null },
  { id: "p23", slug: "fish-table-games-georgia",           title: "Fish Table Games Online in Georgia — Play Fire Kirin & Juwa From Atlanta",            excerpt: "Georgia players can access all 12 Spinora fish table games online — no download, no location required. Here's how to get started from Atlanta, Savannah or anywhere in GA.", cover_image_url: "https://images.pexels.com/photos/918802/pexels-photo-918802.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["fish table games georgia", "fire kirin georgia", "juwa georgia"],   published_at: new Date(Date.now() - 6 * 3600000).toISOString(),  seo_title: null, seo_description: null },
  { id: "p24", slug: "fish-table-games-california",        title: "Fish Table Games Online in California — LA, San Diego & Beyond",                      excerpt: "California players have full access to Spinora's 12-game lineup online. Learn how to get started from Los Angeles, San Diego, Sacramento or anywhere in CA.", cover_image_url: "https://images.pexels.com/photos/25798269/pexels-photo-25798269.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["fish table games california", "sweepstakes california"],             published_at: new Date(Date.now() - 7 * 3600000).toISOString(),  seo_title: null, seo_description: null },
  { id: "p25", slug: "fish-table-games-ohio",              title: "Fish Table Games Online in Ohio — Columbus, Cleveland & Statewide",                    excerpt: "Ohio residents can play Fire Kirin, Juwa, Orion Stars and 9 other Spinora games online from Columbus, Cleveland, Cincinnati or anywhere in the state.", cover_image_url: "https://images.pexels.com/photos/18848584/pexels-photo-18848584.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["fish table games ohio", "fire kirin ohio"],                          published_at: new Date(Date.now() - 8 * 3600000).toISOString(),  seo_title: null, seo_description: null },
  { id: "p26", slug: "fish-table-games-north-carolina",    title: "Fish Table Games Online in North Carolina — Charlotte, Raleigh & More",               excerpt: "North Carolina players can enjoy all 12 Spinora games online — no physical location needed. Play Fire Kirin, Juwa and more from Charlotte, Raleigh or anywhere in NC.", cover_image_url: "https://images.pexels.com/photos/4836513/pexels-photo-4836513.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["fish table games north carolina", "fire kirin north carolina"],     published_at: new Date(Date.now() - 9 * 3600000).toISOString(),  seo_title: null, seo_description: null },
  { id: "p27", slug: "fish-table-games-michigan",          title: "Fish Table Games Online in Michigan — Detroit, Grand Rapids & Statewide",              excerpt: "Michigan players have full access to Spinora's 12 sweepstakes games. Here's how to start playing Fire Kirin, Juwa and Orion Stars from Detroit, Grand Rapids or anywhere in MI.", cover_image_url: "https://images.pexels.com/photos/35736659/pexels-photo-35736659.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["fish table games michigan", "sweepstakes games michigan"],           published_at: new Date(Date.now() - 10 * 3600000).toISOString(), seo_title: null, seo_description: null },
  { id: "p28", slug: "how-to-deposit-bitcoin-fish-table",  title: "How to Deposit with Bitcoin for Fish Table Games — Instant & Secure",                 excerpt: "Bitcoin and USDT are the fastest deposit methods for Spinora. Here's the step-by-step: what wallet to use, how to send, and when your credits appear.", cover_image_url: "https://images.pexels.com/photos/29502355/pexels-photo-29502355.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["bitcoin fish table", "crypto deposit sweepstakes"],                 published_at: new Date(Date.now() - 11 * 3600000).toISOString(), seo_title: null, seo_description: null },
  { id: "p29", slug: "fire-kirin-tips-and-tricks",         title: "Fire Kirin Tips & Tricks — Expert Strategies to Maximize Your Winnings",              excerpt: "Fire Kirin is the most popular fish table game at Spinora for a reason. Here are the targeting, ammo and timing strategies that experienced players use to stay profitable.", cover_image_url: "https://images.pexels.com/photos/10885433/pexels-photo-10885433.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["fire kirin tips", "fire kirin strategy"],                           published_at: new Date(Date.now() - 12 * 3600000).toISOString(), seo_title: null, seo_description: null },
  { id: "p30", slug: "juwa-tips-and-strategies",           title: "Juwa Game Tips — How to Chain Combos & Win More on Juwa",                             excerpt: "Juwa's chain combo system is the key to big sessions. Here's how to trigger multiplier chains, manage your ammo budget and use boss encounters to your advantage.", cover_image_url: "https://images.pexels.com/photos/259165/pexels-photo-259165.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["juwa tips", "juwa strategy", "juwa combos"],                        published_at: new Date(Date.now() - 13 * 3600000).toISOString(), seo_title: null, seo_description: null },
  { id: "p31", slug: "vip-program-guide-spinora",        title: "Spinora VIP Program — How to Climb from Silver to Elite",                          excerpt: "Spinora has 5 VIP tiers: Silver, Gold, Platinum, Diamond and Elite. Each level unlocks higher reward multipliers. Here's exactly how to earn XP and climb fast.", cover_image_url: "https://images.pexels.com/photos/34972177/pexels-photo-34972177.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["Spinora vip", "vip fish table rewards"],                          published_at: new Date(Date.now() - 14 * 3600000).toISOString(), seo_title: null, seo_description: null },
  { id: "p32", slug: "daily-rewards-coins-guide",          title: "How to Earn Free Coins Every Day at Spinora — Daily Rewards Explained",            excerpt: "Spinora gives every player free coins daily through the daily claim, streak bonuses and achievements. Here's how to maximize every source of free rewards.", cover_image_url: "https://images.pexels.com/photos/34972181/pexels-photo-34972181.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["daily rewards fish table", "free coins sweepstakes"],               published_at: new Date(Date.now() - 15 * 3600000).toISOString(), seo_title: null, seo_description: null },
  { id: "p33", slug: "refer-friends-earn-coins",           title: "Earn Coins by Referring Friends at Spinora — Referral Program Guide",              excerpt: "Every friend you refer to Spinora earns you bonus coins when they qualify. Here's how the referral system works, when coins credit, and how to share your code.", cover_image_url: "https://images.pexels.com/photos/5802154/pexels-photo-5802154.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["referral program sweepstakes", "refer friends fish table"],        published_at: new Date(Date.now() - 16 * 3600000).toISOString(), seo_title: null, seo_description: null },
  { id: "p34", slug: "sweepstakes-games-us-nationwide",    title: "Sweepstakes Fish Table Games Available Nationwide — All 50 States",                   excerpt: "Spinora operates under the sweepstakes model, which means players across all 50 US states can participate. Here's what that means for you and how to get started.", cover_image_url: "https://images.pexels.com/photos/18425164/pexels-photo-18425164.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["sweepstakes games nationwide", "fish table games usa"],             published_at: new Date(Date.now() - 17 * 3600000).toISOString(), seo_title: null, seo_description: null },
  { id: "p35", slug: "orion-stars-tips-strategies",        title: "Orion Stars Tips & Strategies — Unlocking Constellation Jackpots",                   excerpt: "Orion Stars has some of the deepest multiplier mechanics in fish table gaming. Here are the targeting strategies, bonus trigger conditions and timing tips that work.", cover_image_url: "https://images.pexels.com/photos/34926379/pexels-photo-34926379.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["orion stars tips", "orion stars strategy"],                         published_at: new Date(Date.now() - 18 * 3600000).toISOString(), seo_title: null, seo_description: null },
  { id: "p36", slug: "how-to-win-at-sweepstakes-slots",    title: "How to Win at Sweepstakes Slots — What Experienced Players Know",                    excerpt: "Sweepstakes slots play differently from fish tables — understanding paylines, volatility and bonus triggers changes your results. Here's what to look for.", cover_image_url: "https://images.pexels.com/photos/7083955/pexels-photo-7083955.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["sweepstakes slots strategy", "how to win slots sweepstakes"],      published_at: new Date(Date.now() - 19 * 3600000).toISOString(), seo_title: null, seo_description: null },
  { id: "p37", slug: "game-vault-all-games-breakdown",     title: "Game Vault Complete Game List — Everything Inside the Platform",                      excerpt: "Game Vault is unique because it's an entire platform: fish tables, slots, arcade games and more all under one login. Here's the full breakdown of what's included.", cover_image_url: "https://images.pexels.com/photos/36484265/pexels-photo-36484265.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["game vault games list", "game vault platform"],                     published_at: new Date(Date.now() - 20 * 3600000).toISOString(), seo_title: null, seo_description: null },
  { id: "p38", slug: "fish-table-vs-slots-which-is-better", title: "Fish Table Games vs Slots — Which Is Better for You?",                              excerpt: "Fish tables and slots both have strong payouts but very different experiences. Here's how they compare on skill involvement, speed, payout frequency and bonus rounds.", cover_image_url: "https://images.pexels.com/photos/25798270/pexels-photo-25798270.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["fish table vs slots", "fish table or slots"],                       published_at: new Date(Date.now() - 21 * 3600000).toISOString(), seo_title: null, seo_description: null },
  { id: "p39", slug: "how-to-create-juwa-account-online",  title: "How to Create a Juwa Account Online — Fast Setup via Spinora",                    excerpt: "You don't need to visit a store or download an unlisted app. Here's exactly how to create a Juwa account online at Spinora — instant — create your account and load credits in under 2 minutes.", cover_image_url: "https://images.pexels.com/photos/7584353/pexels-photo-7584353.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["create juwa account online", "juwa login"],                          published_at: new Date(Date.now() - 22 * 3600000).toISOString(), seo_title: null, seo_description: null },
  { id: "p40", slug: "how-to-create-orion-stars-account",  title: "How to Create an Orion Stars Account Online — Step-by-Step Guide",                   excerpt: "Creating an Orion Stars account through Spinora takes under 2 minutes. Here's the full process: submitting your request, making your deposit and receiving your login.", cover_image_url: "https://images.pexels.com/photos/4841182/pexels-photo-4841182.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["create orion stars account", "orion stars login online"],           published_at: new Date(Date.now() - 23 * 3600000).toISOString(), seo_title: null, seo_description: null },
  { id: "p41", slug: "panda-master-tips-strategies",       title: "Panda Master Tips — How to Beat the Giant Panda Boss & Win Big",                     excerpt: "The Giant Panda Boss in Panda Master is where the biggest credits drop. Here are the timing and ammo strategies to reliably trigger and beat boss encounters.", cover_image_url: "https://images.pexels.com/photos/41206/background-british-budget-business-41206.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["panda master tips", "panda master boss strategy"],                 published_at: new Date(Date.now() - 24 * 3600000).toISOString(), seo_title: null, seo_description: null },
  { id: "p42", slug: "milky-way-advanced-strategies",      title: "Milky Way Advanced Strategies — Triggering Galactic Storm & 5× Bonus",               excerpt: "Milky Way's Galactic Storm bonus is the most lucrative event in the game — but triggering it requires specific play patterns. Here's what they are.", cover_image_url: "https://images.pexels.com/photos/34972180/pexels-photo-34972180.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["milky way strategy", "milky way galactic storm"],                   published_at: new Date(Date.now() - 25 * 3600000).toISOString(), seo_title: null, seo_description: null },
  { id: "p43", slug: "maximize-fish-table-bonus",          title: "How to Maximize Your Fish Table Bonus — 7 Strategies That Actually Work",             excerpt: "Between the 50% first deposit bonus, daily rewards, VIP multipliers and reload bonuses, there are multiple ways to stretch every dollar at Spinora. Here's how.", cover_image_url: "https://images.pexels.com/photos/4690384/pexels-photo-4690384.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["fish table bonus strategy", "maximize sweepstakes bonus"],          published_at: new Date(Date.now() - 26 * 3600000).toISOString(), seo_title: null, seo_description: null },
  { id: "p44", slug: "vblink-game-guide",                  title: "VBlink Game Guide — Sub-Second Spins & Stacked Bonus Rounds",                        excerpt: "VBlink is the fastest slot-style game in the Spinora lineup. Here's how the sub-second spin mechanic works, how stacked bonuses trigger, and how to play it profitably.", cover_image_url: "https://images.pexels.com/photos/6236114/pexels-photo-6236114.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["vblink game", "vblink online guide"],                               published_at: new Date(Date.now() - 27 * 3600000).toISOString(), seo_title: null, seo_description: null },
  { id: "p45", slug: "cash-frenzy-guide-tips",             title: "Cash Frenzy Tips — Free-Spin Chains & Cash Meter Strategy",                          excerpt: "Cash Frenzy rewards players who understand the free-spin chain mechanic and the climbing cash meter. Here's how to use both to maximize your session.", cover_image_url: "https://images.pexels.com/photos/29096083/pexels-photo-29096083.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["cash frenzy tips", "cash frenzy strategy"],                         published_at: new Date(Date.now() - 28 * 3600000).toISOString(), seo_title: null, seo_description: null },
  { id: "p46", slug: "best-fish-table-games-beginners",    title: "Best Fish Table Games for Beginners — Where to Start at Spinora",                  excerpt: "New to sweepstakes fish table gaming? Some games are far more beginner-friendly than others. Here are the 5 best starting points based on game speed, controls and bonus clarity.", cover_image_url: "https://images.pexels.com/photos/7584351/pexels-photo-7584351.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["fish table games beginners", "easy sweepstakes games"],             published_at: new Date(Date.now() - 29 * 3600000).toISOString(), seo_title: null, seo_description: null },
  { id: "p47", slug: "fish-table-games-atlanta-georgia",   title: "Fish Table Games in Atlanta, GA — Play Online From Home",                            excerpt: "Atlanta players no longer need to find a physical fish table location. Spinora gives you 12 games online, accessible from any phone or computer in the Atlanta metro area.", cover_image_url: "https://images.pexels.com/photos/17370315/pexels-photo-17370315.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["fish table games atlanta", "atlanta sweepstakes gaming"],            published_at: new Date(Date.now() - 30 * 3600000).toISOString(), seo_title: null, seo_description: null },
  { id: "p48", slug: "fish-table-games-houston-texas",     title: "Fish Table Games in Houston, TX — 12 Games Available Online",                        excerpt: "Houston has one of the largest fish table gaming communities in the US. Here's how Spinora brings Fire Kirin, Juwa and 10 other games to any Houston player online.", cover_image_url: "https://images.pexels.com/photos/17255079/pexels-photo-17255079.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["fish table games houston", "houston sweepstakes gaming"],            published_at: new Date(Date.now() - 31 * 3600000).toISOString(), seo_title: null, seo_description: null },

  // ── Wallet / cash-out system + comparison guides (full bodies in blog-content.ts) ──
  { id: "p49", slug: "wallet-deposit-guide-spinora",     title: "How to Add Funds to Your Spinora Wallet — Deposit Guide",                          excerpt: "Fund your Spinora wallet once by CashApp, Zelle, Bitcoin or USDT, then load any game instantly. Here's the step-by-step deposit process and how fast credits arrive.", cover_image_url: "https://images.pexels.com/photos/163069/mobile-phone-money-banknotes-us-dollars-163069.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["Spinora wallet", "how to deposit", "add funds"],                  published_at: new Date(Date.now() - 90 * 60000).toISOString(),  seo_title: null, seo_description: "Add funds to your Spinora wallet by CashApp, Zelle, Bitcoin or USDT and load any game instantly. Step-by-step deposit guide, credited within minutes." },
  { id: "p50", slug: "how-to-load-credits-from-wallet",    title: "How to Load Game Credits From Your Wallet — Instant & Self-Serve",                   excerpt: "Creating a game account is free and instant. Here's how to load credits from your Spinora wallet into any game in seconds — with automatic refunds if a load fails.", cover_image_url: "https://images.pexels.com/photos/3790639/pexels-photo-3790639.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["load credits", "Spinora wallet", "game account"],                published_at: new Date(Date.now() - 80 * 60000).toISOString(),  seo_title: null, seo_description: "Load credits from your Spinora wallet into any game instantly. Free account creation, atomic wallet debit, and automatic refunds if a load fails." },
  { id: "p51", slug: "how-cash-out-works-spinora",       title: "How Cash-Out Works at Spinora — Redeem & Get Paid",                                excerpt: "Redeem winnings from any game to your cash-out balance, then request a payout via CashApp, Zelle or crypto. Here's exactly how Spinora cash-outs work, including redeem rules.", cover_image_url: "https://images.pexels.com/photos/1006060/pexels-photo-1006060.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["cash out", "redeem winnings", "Spinora payout"],                 published_at: new Date(Date.now() - 70 * 60000).toISOString(),  seo_title: null, seo_description: "Redeem winnings from any game to your cash-out balance, then get paid via CashApp, Zelle or crypto. How Spinora cash-outs and redeem rules work." },
  { id: "p52", slug: "fire-kirin-vs-game-vault",           title: "Fire Kirin vs Game Vault — Which Should You Play?",                                  excerpt: "Fire Kirin is a focused fish-table shooter; Game Vault bundles fish tables, slots and arcade in one login. Here's how they compare on style, bonuses and who each is for.", cover_image_url: "https://images.pexels.com/photos/4841183/pexels-photo-4841183.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["fire kirin vs game vault", "best sweepstakes game"],               published_at: new Date(Date.now() - 60 * 60000).toISOString(),  seo_title: null, seo_description: "Fire Kirin vs Game Vault compared: a focused fish-table shooter versus an all-in-one platform of fish tables, slots and arcade. Which should you play?" },
  { id: "p53", slug: "juwa-vs-vegas-sweeps",               title: "Juwa vs Vegas Sweeps — Fish Table or Slots?",                                       excerpt: "Juwa is a fast, skill-leaning fish table; Vegas Sweeps is classic slot-reel gaming. Here's how they compare on pace, skill, bonuses and which fits your style.", cover_image_url: "https://images.pexels.com/photos/29702644/pexels-photo-29702644.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["juwa vs vegas sweeps", "fish table vs slots"],                     published_at: new Date(Date.now() - 50 * 60000).toISOString(),  seo_title: null, seo_description: "Juwa vs Vegas Sweeps compared: a fast skill-leaning fish table versus classic neon slots. Pace, skill, bonuses and which to create first." },
  { id: "p54", slug: "game-vault-vs-juwa",                 title: "Game Vault vs Juwa — Variety or Focus?",                                            excerpt: "Game Vault is an all-in-one platform; Juwa is a single fast fish-table game. Here's the comparison on variety, intensity, bonuses and cash-out so you can choose.", cover_image_url: "https://images.pexels.com/photos/18425165/pexels-photo-18425165.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["game vault vs juwa", "best sweepstakes game"],                     published_at: new Date(Date.now() - 40 * 60000).toISOString(),  seo_title: null, seo_description: "Game Vault vs Juwa compared: an all-in-one platform versus a single fast fish-table shooter. Variety, intensity, bonuses and cash-out." },

  // ── More comparisons, how-tos & trust ──
  { id: "p55", slug: "orion-stars-vs-fire-kirin",          title: "Orion Stars vs Fire Kirin — Which Fish Table Wins?",                                 excerpt: "Fire Kirin leans on boss catches and scaling jackpots; Orion Stars goes deep on constellation multipliers. Here's how they compare and which fits your play style.", cover_image_url: "https://images.pexels.com/photos/8817671/pexels-photo-8817671.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["orion stars vs fire kirin", "best fish table game"],              published_at: new Date(Date.now() - 38 * 60000).toISOString(),  seo_title: null, seo_description: "Orion Stars vs Fire Kirin compared: boss-driven jackpots versus constellation multipliers. Which fish table should you play?" },
  { id: "p56", slug: "game-vault-vs-orion-stars",          title: "Game Vault vs Orion Stars — Variety or Deep Multipliers?",                           excerpt: "Game Vault bundles fish tables, slots and arcade in one login; Orion Stars is a focused fish table with stacking multipliers. Here's the full comparison.", cover_image_url: "https://images.pexels.com/photos/918802/pexels-photo-918802.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["game vault vs orion stars", "best sweepstakes game"],             published_at: new Date(Date.now() - 36 * 60000).toISOString(),  seo_title: null, seo_description: "Game Vault vs Orion Stars compared: an all-in-one platform versus a focused fish table with deep multipliers. Which to play?" },
  { id: "p57", slug: "how-to-redeem-winnings-fast",        title: "How to Redeem Your Winnings Fast at Spinora",                                      excerpt: "Redeem winnings from any game to your cash-out balance instantly, then request a payout. Here's the fastest redeem flow and how to avoid common delays.", cover_image_url: "https://images.pexels.com/photos/7267577/pexels-photo-7267577.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["redeem winnings", "fast cash out", "Spinora payout"],            published_at: new Date(Date.now() - 34 * 60000).toISOString(),  seo_title: null, seo_description: "Redeem winnings to your cash-out balance instantly, then get paid via CashApp, Zelle or crypto. The fastest Spinora redeem flow." },
  { id: "p58", slug: "spinora-vip-tiers-explained",      title: "Spinora VIP Tiers Explained — Silver to Elite",                                    excerpt: "Spinora has five VIP tiers with rising reward multipliers and reload bonuses. Here's what each tier unlocks and how to climb from Silver to Elite fast.", cover_image_url: "https://images.pexels.com/photos/35415350/pexels-photo-35415350.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["Spinora vip tiers", "vip rewards"],                            published_at: new Date(Date.now() - 32 * 60000).toISOString(),  seo_title: null, seo_description: "Spinora VIP tiers explained: Silver, Gold, Platinum, Diamond and Elite. Multipliers, reload bonuses and how to climb fast." },
  { id: "p59", slug: "are-online-fish-table-games-safe",   title: "Are Online Fish Table Games Safe? What to Look For",                                 excerpt: "Online fish table games are safe on a reputable platform with verified payments, transparent cash-out rules and account security. Here's how Spinora protects players.", cover_image_url: "https://images.pexels.com/photos/25798269/pexels-photo-25798269.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["are fish table games safe", "safe sweepstakes gaming"],          published_at: new Date(Date.now() - 30 * 60000).toISOString(),  seo_title: null, seo_description: "Are online fish table games safe? What to look for in a platform — verified payments, transparent cash-out rules and account security." },
  { id: "p60", slug: "how-to-choose-a-fish-table-game",    title: "How to Choose a Fish Table Game — Beginner's Guide",                                 excerpt: "Choosing a fish table game comes down to pace, skill and bonus style. Here's how to match a game to your style and why you can try several for free.", cover_image_url: "https://images.pexels.com/photos/18848584/pexels-photo-18848584.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["choose fish table game", "best fish table for me"],               published_at: new Date(Date.now() - 28 * 60000).toISOString(),  seo_title: null, seo_description: "How to choose a fish table game: match pace, skill and bonus style to how you like to play — and try several free at Spinora." },

  // ── Flagship "how to win" guides ────────────────────────────────────────────
  { id: "p61", slug: "how-to-win-at-fire-kirin",  title: "How to Win at Fire Kirin — Strategies That Actually Work",   excerpt: "Fire Kirin rewards cannon-power discipline and boss-fish timing over button-mashing. Here is the strategy experienced players use to stay profitable.", cover_image_url: "https://images.pexels.com/photos/30427909/pexels-photo-30427909.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["how to win fire kirin", "fire kirin strategy"],   published_at: new Date(Date.now() - 12 * 60000).toISOString(), seo_title: null, seo_description: "How to win at Fire Kirin: cannon-power management, boss-fish timing and bonus-window strategy from experienced Spinora players." },
  { id: "p62", slug: "how-to-win-at-juwa",        title: "How to Win at Juwa — Chain Combos and Boss Timing Explained", excerpt: "Juwa's fast pace rewards players who manage ammo and chain combos deliberately. Here is how to play Juwa profitably.",                                  cover_image_url: "https://images.pexels.com/photos/20843727/pexels-photo-20843727.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["how to win juwa", "juwa strategy"],               published_at: new Date(Date.now() - 10 * 60000).toISOString(), seo_title: null, seo_description: "How to win at Juwa: Chain Reaction setups, Dragon Storm timing and ammo budgeting strategy from experienced Spinora players." },
  { id: "p63", slug: "how-to-win-at-orion-stars", title: "How to Win at Orion Stars — Constellation Jackpot Strategy", excerpt: "Orion Stars rewards patient, targeted play over volume. Here is how to prioritize constellation fish and Deep Space Boss encounters.",                  cover_image_url: "https://images.pexels.com/photos/9648243/pexels-photo-9648243.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["how to win orion stars", "orion stars strategy"], published_at: new Date(Date.now() - 8 * 60000).toISOString(),  seo_title: null, seo_description: "How to win at Orion Stars: constellation-fish prioritization, Nebula Bonus timing and Deep Space Boss strategy explained." },

  // ── Batch 2: query-gap capture, missing games, comparisons, feature guides ──
  { id: "p64", slug: "fish-table-sweepstakes-explained",              title: "Fish Table Sweepstakes Games — The Complete Guide",                        excerpt: "What fish table sweepstakes games are, how the legal sweepstakes model works, and how to start playing any game in the Spinora lineup.", cover_image_url: "https://images.pexels.com/photos/4836513/pexels-photo-4836513.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["fish table sweepstakes", "sweepstakes fish table games"],        published_at: new Date(Date.now() - 46 * 10000).toISOString(), seo_title: "Fish Table Sweepstakes Games — The Complete Guide | Spinora", seo_description: "Fish table sweepstakes games explained: how the legal sweepstakes model works, the Spinora game lineup, and how to start playing in minutes." },
  { id: "p65", slug: "fish-em-up-online-alternatives",                 title: "Looking for Fish Em Up? Play These Fish Table Games at Spinora Instead", excerpt: "Fish Em Up isn't part of the Spinora catalog — here are the closest fish table games you can actually play, like Fire Kirin and Juwa.", cover_image_url: "https://images.pexels.com/photos/106152/euro-coins-currency-money-106152.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["fish em up", "play fish em up", "fish table games online"],       published_at: new Date(Date.now() - 44 * 10000).toISOString(), seo_title: "Fish Em Up Online — Play These Fish Table Alternatives | Spinora", seo_description: "Searching for Fish Em Up? It's not in the Spinora lineup — play Fire Kirin, Juwa, Orion Stars and more fish table games instead, free account today." },
  { id: "p66", slug: "luckytap-slots-guide-spinora-alternative",     title: "Twin Happiness, Smashing Sevens, Survivor & Family Feud — LuckyTap Slots Guide", excerpt: "Twin Happiness, Smashing Sevens Win Ways, Survivor and Family Feud are LuckyTap slots not on Spinora — here's what to play instead.", cover_image_url: "https://images.pexels.com/photos/10885433/pexels-photo-10885433.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["twin happiness slot", "smashing sevens win ways", "survivor luckytap", "family feud luckytap"], published_at: new Date(Date.now() - 42 * 10000).toISOString(), seo_title: "LuckyTap Slots Guide — Twin Happiness, Smashing Sevens & More | Spinora", seo_description: "Twin Happiness, Smashing Sevens Win Ways, Survivor and Family Feud aren't on Spinora — see the closest slot games you can actually play here." },
  { id: "p67", slug: "how-sweepstakes-payouts-work",                   title: "How Sweepstakes Game Payouts Work — Volatility, Boss Fish & Jackpot Pools", excerpt: "How payouts work across fish table and slot sweepstakes games — volatility, boss encounters, and shared jackpot pools explained.", cover_image_url: "https://images.pexels.com/photos/259165/pexels-photo-259165.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["sweepstakes game payouts", "fish table payout", "how sweepstakes games pay"], published_at: new Date(Date.now() - 40 * 10000).toISOString(), seo_title: "How Sweepstakes Game Payouts Work | Spinora", seo_description: "How fish table and slot sweepstakes payouts actually work — volatility, boss encounters and jackpot pools explained honestly, no fake odds." },
  { id: "p68", slug: "ultrapanda-game-guide",                          title: "Ultrapanda Online — Complete Game Guide",                                   excerpt: "Ultrapanda blends fish table shooting with slot-style bonus rounds. Here's how it works and how to start playing at Spinora.", cover_image_url: "https://images.pexels.com/photos/29790831/pexels-photo-29790831.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["ultrapanda", "ultrapanda online", "ultrapanda game"],             published_at: new Date(Date.now() - 38 * 10000).toISOString(), seo_title: "Ultrapanda Online — Complete Game Guide | Spinora", seo_description: "Play Ultrapanda at Spinora — fish table shooting plus slot-style bonus rounds. How it works, strategy basics, and how to get started." },
  { id: "p69", slug: "gameroom-game-guide",                            title: "Gameroom Online — Slots, Fish Tables & Keno Guide",                        excerpt: "Gameroom bundles slots, fish tables and keno in one account, with a $5 minimum deposit. Here's the full breakdown.", cover_image_url: "https://images.pexels.com/photos/35736659/pexels-photo-35736659.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["gameroom online", "gameroom game", "gameroom sweepstakes"],       published_at: new Date(Date.now() - 36 * 10000).toISOString(), seo_title: "Gameroom Online — Slots, Fish Tables & Keno Guide | Spinora", seo_description: "Gameroom at Spinora: slots, fish tables and keno in one account, $5 minimum deposit, 50% first deposit bonus. Full game guide." },
  { id: "p70", slug: "mafia-vs-juwa",                                  title: "Mafia vs Juwa — Which Fish Table Should You Play?",                       excerpt: "Mafia's Boss battles and jackpot pools vs Juwa's fast Chain Reaction combos — full comparison to help you choose.", cover_image_url: "https://images.pexels.com/photos/18425164/pexels-photo-18425164.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["mafia vs juwa", "best fish table game"],                          published_at: new Date(Date.now() - 34 * 10000).toISOString(), seo_title: "Mafia vs Juwa — Which Fish Table Wins? | Spinora", seo_description: "Mafia vs Juwa compared: Boss battles and jackpot pools versus fast Chain Reaction combos. Which fish table game should you play?" },
  { id: "p71", slug: "panda-master-vs-ultrapanda",                     title: "Panda Master vs Ultrapanda — Which Panda Game Should You Play?",          excerpt: "Panda Master's Giant Panda Boss vs Ultrapanda's hybrid slot bonus rounds — full comparison.", cover_image_url: "https://images.pexels.com/photos/36484265/pexels-photo-36484265.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["panda master vs ultrapanda", "best fish table game"],             published_at: new Date(Date.now() - 32 * 10000).toISOString(), seo_title: "Panda Master vs Ultrapanda Compared | Spinora", seo_description: "Panda Master vs Ultrapanda: a pure fish table Boss shooter versus a hybrid slot-and-fish game. Which panda-themed game fits your style?" },
  { id: "p72", slug: "cash-machine-vs-cash-frenzy",                    title: "Cash Machine vs Cash Frenzy — Which Slot Should You Play?",               excerpt: "Cash Machine's steady paylines vs Cash Frenzy's free-spin chains — full comparison of Spinora's two consistency-focused slots.", cover_image_url: "https://images.pexels.com/photos/25798270/pexels-photo-25798270.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["cash machine vs cash frenzy", "best sweepstakes slot"],           published_at: new Date(Date.now() - 30 * 10000).toISOString(), seo_title: "Cash Machine vs Cash Frenzy Compared | Spinora", seo_description: "Cash Machine vs Cash Frenzy: steady low-variance paylines versus free-spin chains and a climbing cash meter. Which slot fits your style?" },
  { id: "p73", slug: "vblink-vs-milky-way",                            title: "VBlink vs Milky Way — Which Game Should You Play?",                       excerpt: "VBlink's sub-second spins vs Milky Way's Galactic Storm multiplier — full comparison.", cover_image_url: "https://images.pexels.com/photos/4841182/pexels-photo-4841182.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["vblink vs milky way", "best sweepstakes game"],                   published_at: new Date(Date.now() - 28 * 10000).toISOString(), seo_title: "VBlink vs Milky Way Compared | Spinora", seo_description: "VBlink vs Milky Way: sub-second stacked-bonus spins versus a space-themed fish table with a 5x Galactic Storm event. Full comparison." },
  { id: "p74", slug: "mr-all-in-one-vs-game-vault",                    title: "Mr. All In One vs Game Vault — Which All-In-One Platform Wins?",          excerpt: "Both bundle fish tables, slots and arcade games — here's how Mr. All In One and Game Vault actually compare.", cover_image_url: "https://images.pexels.com/photos/34926379/pexels-photo-34926379.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["mr all in one vs game vault", "best sweepstakes platform"],       published_at: new Date(Date.now() - 26 * 10000).toISOString(), seo_title: "Mr. All In One vs Game Vault Compared | Spinora", seo_description: "Mr. All In One vs Game Vault: two all-in-one sweepstakes platforms compared on library size, variety and bonuses. Which should you create first?" },
  { id: "p75", slug: "gameroom-vs-orion-stars",                        title: "Gameroom vs Orion Stars — Variety or Deep Jackpots?",                     excerpt: "Gameroom's slots-fish-keno variety vs Orion Stars' layered constellation jackpots — full comparison.", cover_image_url: "https://images.pexels.com/photos/7083955/pexels-photo-7083955.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["gameroom vs orion stars", "best sweepstakes game"],              published_at: new Date(Date.now() - 24 * 10000).toISOString(), seo_title: "Gameroom vs Orion Stars Compared | Spinora", seo_description: "Gameroom vs Orion Stars: a multi-format slots/fish/keno platform versus a focused fish table with deep jackpot tiers. Which fits you?" },
  { id: "p76", slug: "spinora-xp-leveling-explained",                title: "Spinora XP & Leveling Explained — How to Climb Levels Fast",            excerpt: "The exact XP curve behind Spinora levels, where XP comes from, and how leveling connects to VIP tiers.", cover_image_url: "https://images.pexels.com/photos/7584353/pexels-photo-7584353.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["Spinora xp", "Spinora leveling", "how to level up fast"],    published_at: new Date(Date.now() - 22 * 10000).toISOString(), seo_title: "Spinora XP & Leveling Explained | Spinora", seo_description: "How Spinora XP and leveling actually work: the exact XP curve, every XP source, and how leveling connects to VIP tier multipliers." },
  { id: "p77", slug: "spinora-leaderboard-guide",                    title: "Spinora Leaderboard Guide — How Rankings Are Calculated",               excerpt: "How Spinora leaderboards rank players, the daily/weekly/monthly/all-time reset schedule, and how to climb fast.", cover_image_url: "https://images.pexels.com/photos/7842994/pexels-photo-7842994.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["Spinora leaderboard", "leaderboard rewards"],                   published_at: new Date(Date.now() - 20 * 10000).toISOString(), seo_title: "Spinora Leaderboard Guide — How Rankings Work | Spinora", seo_description: "How Spinora leaderboard rankings are calculated, the reset schedule for daily/weekly/monthly/all-time boards, and how to climb fast." },
  { id: "p78", slug: "spinora-payment-methods-compared",             title: "All Spinora Payment Methods Compared",                                  excerpt: "CashApp, Zelle, Chime, PayPal, Venmo, Bitcoin and USDT compared — which deposit method is fastest for you.", cover_image_url: "https://images.pexels.com/photos/5437587/pexels-photo-5437587.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["Spinora payment methods", "how to deposit Spinora"],         published_at: new Date(Date.now() - 18 * 10000).toISOString(), seo_title: "All Spinora Payment Methods Compared", seo_description: "CashApp, Zelle, Chime, PayPal, Venmo, Bitcoin and USDT compared for Spinora deposits — which method is fastest and best for your amount." },
  { id: "p79", slug: "spinora-telegram-support-guide",               title: "How to Get Fast Support at Spinora via Telegram",                       excerpt: "How to reach Spinora support through Telegram, what it's best for, and how VIP tiers affect response time.", cover_image_url: "https://images.pexels.com/photos/41206/background-british-budget-business-41206.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["Spinora telegram support", "Spinora contact"],                published_at: new Date(Date.now() - 16 * 10000).toISOString(), seo_title: "Spinora Telegram Support Guide", seo_description: "How to contact Spinora support via Telegram for deposits, account setup and general questions, plus VIP priority response times." },
  { id: "p80", slug: "sweepstakes-vs-real-money-gambling",             title: "Sweepstakes vs Real-Money Gambling — Key Legal Differences Explained",    excerpt: "The legal difference between sweepstakes gaming and real-money gambling, and why it means Spinora is available nationwide.", cover_image_url: "https://images.pexels.com/photos/29825627/pexels-photo-29825627.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["sweepstakes vs gambling", "are sweepstakes games legal"],        published_at: new Date(Date.now() - 14 * 10000).toISOString(), seo_title: "Sweepstakes vs Real-Money Gambling Explained | Spinora", seo_description: "Sweepstakes games vs real-money gambling: the legal structure that makes sweepstakes gaming available nationwide, explained clearly." },
  { id: "p81", slug: "is-spinora-legit",                             title: "Is Spinora Legit? Trust, Verification & Support Explained",             excerpt: "How Spinora verifies deposits, keeps an append-only transaction ledger, and handles support — what to check on any platform.", cover_image_url: "https://images.pexels.com/photos/7584351/pexels-photo-7584351.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["is Spinora legit", "Spinora trust and safety"],               published_at: new Date(Date.now() - 12 * 10000).toISOString(), seo_title: "Is Spinora Legit? Trust & Verification Explained", seo_description: "Is Spinora legit? How deposits are manually verified, transactions are recorded on an append-only ledger, and support actually works." },
  { id: "p82", slug: "sweepstakes-no-deposit-bonus-explained",         title: "Sweepstakes No Deposit Bonus — Does Spinora Offer One?",                excerpt: "Spinora doesn't offer a true no-deposit bonus — here's what's actually free: the welcome bonus, daily rewards and referral coins.", cover_image_url: "https://images.pexels.com/photos/4841691/pexels-photo-4841691.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["sweepstakes no deposit bonus", "free sweepstakes coins"],       published_at: new Date(Date.now() - 10 * 10000).toISOString(), seo_title: "Sweepstakes No Deposit Bonus Explained | Spinora", seo_description: "Does Spinora have a no-deposit bonus? Here's the honest answer, plus what's genuinely free: welcome bonus, daily rewards and referrals." },
  { id: "p83", slug: "sweeps-coins-explained",                         title: "Sweeps Coins Explained — And How Spinora's System Actually Works",       excerpt: "What sweeps coins usually mean on other platforms, and how Spinora's wallet, game credits and coins/XP system actually works instead.", cover_image_url: "https://images.pexels.com/photos/3790639/pexels-photo-3790639.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["sweeps coins explained", "gold coins vs sweeps coins"],          published_at: new Date(Date.now() - 8 * 10000).toISOString(),  seo_title: "Sweeps Coins Explained | Spinora", seo_description: "What are sweeps coins? How the common gold-coins/sweeps-coins model works elsewhere, and how Spinora's wallet and rewards system differs." },
  { id: "p84", slug: "boss-fish-jackpot-timing-guide",                 title: "Boss Fish & Jackpot Timing Guide — Every Spinora Game Compared",        excerpt: "When to expect Boss encounters and jackpot windows across Fire Kirin, Juwa, Orion Stars, Mafia, Panda Master and Milky Way.", cover_image_url: "https://images.pexels.com/photos/1006060/pexels-photo-1006060.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["boss fish timing", "jackpot timing sweepstakes"],                 published_at: new Date(Date.now() - 6 * 10000).toISOString(),  seo_title: "Boss Fish & Jackpot Timing Guide | Spinora", seo_description: "Boss encounter and jackpot timing patterns across every major Spinora fish table game — Fire Kirin, Juwa, Orion Stars, Mafia and more." },
  { id: "p85", slug: "spinora-vs-online-casinos",                    title: "Spinora vs Online Casinos — What's the Difference?",                    excerpt: "How Spinora's sweepstakes model differs from a licensed online casino, and what that means for where you can play.", cover_image_url: "https://images.pexels.com/photos/8817671/pexels-photo-8817671.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", tags: ["sweepstakes vs online casino", "Spinora vs casino"],           published_at: new Date(Date.now() - 4 * 10000).toISOString(),  seo_title: "Spinora vs Online Casinos Explained", seo_description: "Spinora vs online casinos: how the sweepstakes model differs from licensed real-money gambling, and what it means for player access." },
];

/** All blog slugs (static catalog) — used by the sitemap. */
export const ALL_BLOG_SLUGS: string[] = FALLBACK_BLOG_POSTS.map((p) => p.slug);

export async function getPublishedBlogPosts(): Promise<MarketingPost[]> {
  return withFallback(
    (async () => {
      const admin = createAdminClient();
      const supabase = admin ?? createStaticClient();
      const { data, error } = await supabase
        .from("blog_posts")
        .select("id, slug, title, excerpt, cover_image_url, published_at, seo_title, seo_description")
        .order("published_at", { ascending: false })
        .limit(50);
      if (error || !data?.length) return null;
      return (data as MarketingPost[]).map(spinoraBrandPost);
    })(),
    FALLBACK_BLOG_POSTS
  ).then((posts) => posts.map(spinoraBrandPost));
}

export const getLatestBlogPosts = unstable_cache(
  async (): Promise<MarketingPost[]> => {
    return withFallback(
      (async () => {
        const admin = createAdminClient();
        const supabase = admin ?? createStaticClient();
        const { data, error } = await supabase
          .from("blog_posts")
          .select("id, slug, title, excerpt, cover_image_url, published_at, seo_title, seo_description")
          .order("published_at", { ascending: false })
          .limit(6);
        if (error || !data?.length) return null;
        return (data as MarketingPost[]).map(spinoraBrandPost);
      })(),
      FALLBACK_BLOG_POSTS.slice(0, 6).map(spinoraBrandPost)
    ).then((posts) => posts.map(spinoraBrandPost));
  },
  ["marketing-latest-blog-posts-spinora-v2"],
  { revalidate: 300 }
);

/** Posts whose title or tags mention the game — for game→blog interlinking. */
export async function getRelatedPosts(gameName: string, limit = 3): Promise<MarketingPost[]> {
  const all = await getPublishedBlogPosts();
  const needle = gameName.toLowerCase();
  const matches = all.filter(
    (p) =>
      p.title.toLowerCase().includes(needle) ||
      (p.tags ?? []).some((t) => t.toLowerCase().includes(needle))
  );
  return (matches.length ? matches : all).slice(0, limit);
}

export async function getBlogPost(slug: string): Promise<MarketingPostFull | null> {
  const cached = DYNAMIC_AI_POSTS.get(slug);
  if (cached) {
    return spinoraBrandPostFull({
      id: cached.slug,
      slug: cached.slug,
      title: cached.title,
      excerpt: cached.excerpt,
      cover_image_url: cached.cover_image,
      tags: cached.tags,
      published_at: new Date().toISOString(),
      seo_title: cached.seo_title,
      seo_description: cached.seo_description,
      content: cached.content,
    });
  }

  try {
    const admin = createAdminClient();
    const supabase = admin ?? createStaticClient();
    
    // 1. Direct exact slug match
    const { data: exact } = await supabase
      .from("blog_posts")
      .select("id, slug, title, excerpt, cover_image_url, published_at, seo_title, seo_description, content")
      .eq("slug", slug)
      .maybeSingle();

    if (exact?.content) return spinoraBrandPostFull(exact as MarketingPostFull);

    // 2. Fuzzy prefix match (e.g. "juwa-2752" -> "juwa")
    const prefix = slug.split("-")[0];
    if (prefix && prefix.length > 2) {
      const { data: fuzzy } = await supabase
        .from("blog_posts")
        .select("id, slug, title, excerpt, cover_image_url, published_at, seo_title, seo_description, content")
        .ilike("slug", `${prefix}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fuzzy?.content) return spinoraBrandPostFull(fuzzy as MarketingPostFull);
    }

    // 3. Fallback to hardcoded seed post
    const fb = fallbackPost(slug);
    if (fb) return spinoraBrandPostFull(fb);

    // 4. Ultimate fallback: return newest published post so page never 404s
    const { data: newest } = await supabase
      .from("blog_posts")
      .select("id, slug, title, excerpt, cover_image_url, published_at, seo_title, seo_description, content")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (newest?.content) return spinoraBrandPostFull(newest as MarketingPostFull);

    return null;
  } catch {
    const fb = fallbackPost(slug);
    return fb ? spinoraBrandPostFull(fb) : null;
  }
}

/** Static fallback post when DB has no body yet. */
function fallbackPost(slug: string): MarketingPostFull | null {
  const card = FALLBACK_BLOG_POSTS.find((p) => p.slug === slug);
  if (!card) return null;
  return spinoraBrandPostFull({ ...card, content: card.excerpt });
}

// ── Leaderboard preview (real data only — launch state otherwise) ───────────

export type LeaderboardPreviewEntry = {
  rank: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  level: number;
  score: number;
};

export async function getLeaderboardPreview(
  limit = 5
): Promise<LeaderboardPreviewEntry[]> {
  return withFallback(
    (async () => {
      const supabase = createStaticClient();
      const { data, error } = await supabase.rpc("public_profiles_top", {
        p_limit: limit,
      });
      if (error || !data?.length) return null;
      return data.map((p, i) => ({
        rank: i + 1,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        level: p.level,
        score: p.xp,
      }));
    })(),
    [] // honest launch state — no fabricated players
  );
}
