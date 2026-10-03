import { createAdminClient } from "@/lib/supabase/admin";

export const AI_SETTINGS_IDS = {
  blog: "00000000-0000-0000-0000-000000000001",
  telegram: "00000000-0000-0000-0000-000000000001",
  chatbot: "00000000-0000-0000-0000-000000000001",
} as const;

export type BlogAiSettings = {
  is_enabled: boolean;
  topics: string[];
  target_keywords: string[];
  posting_frequency_hours: number;
  ai_provider: string;
  ai_model: string;
  auto_publish: boolean;
  auto_telegram_broadcast: boolean;
  last_generated_at: string | null;
};

export type TelegramAiSettings = {
  auto_post_blog: boolean;
  auto_post_promos: boolean;
  template_header: string;
  template_footer: string;
  autopilot_enabled: boolean;
  last_autopilot_at: string | null;
};

export type ChatbotAiSettings = {
  is_enabled: boolean;
  bot_name: string;
  system_prompt: string;
  auto_reply_enabled: boolean;
  human_handover_threshold: number;
  telegram_escalation_enabled: boolean;
  personality: "standard" | "vip" | "energetic";
};

const DEFAULT_BLOG: BlogAiSettings = {
  is_enabled: true,
  topics: ["Online Gaming", "Fish Table Games", "Slot Strategies", "Casino Bonuses"],
  target_keywords: ["spinora bonus code", "juwa 777 download", "online slots"],
  posting_frequency_hours: 24,
  ai_provider: "smart_auto",
  ai_model: "gpt-4o-mini",
  auto_publish: true,
  auto_telegram_broadcast: true,
  last_generated_at: null,
};

const DEFAULT_TELEGRAM: TelegramAiSettings = {
  auto_post_blog: true,
  auto_post_promos: true,
  template_header: "🔥 <b>SPINORA GAMING UPDATE</b> 🔥",
  template_footer: "👉 Join now & claim your instant deposit bonus! 🚀",
  autopilot_enabled: true,
  last_autopilot_at: null,
};

const DEFAULT_CHATBOT: ChatbotAiSettings = {
  is_enabled: true,
  bot_name: "Spinora AI Assistant",
  system_prompt:
    "You are Spinora AI Assistant, a friendly gaming support bot. Help with game accounts (Juwa, Fire Kirin, Game Vault), deposits, cashouts, VIP tiers, and bonuses. Keep answers concise.",
  auto_reply_enabled: true,
  human_handover_threshold: 0.6,
  telegram_escalation_enabled: true,
  personality: "standard",
};

let botSenderCache: string | null | undefined;

export async function getBlogSettings(): Promise<BlogAiSettings> {
  const db = createAdminClient();
  if (!db) return DEFAULT_BLOG;
  try {
    const { data } = await db
      .from("ai_blog_settings")
      .select("*")
      .eq("id", AI_SETTINGS_IDS.blog)
      .maybeSingle();
    return data ? { ...DEFAULT_BLOG, ...data } : DEFAULT_BLOG;
  } catch {
    return DEFAULT_BLOG;
  }
}

export async function getTelegramSettings(): Promise<TelegramAiSettings> {
  const db = createAdminClient();
  if (!db) return DEFAULT_TELEGRAM;
  try {
    const { data } = await db
      .from("ai_telegram_settings")
      .select("*")
      .eq("id", AI_SETTINGS_IDS.telegram)
      .maybeSingle();
    return data ? { ...DEFAULT_TELEGRAM, ...data } : DEFAULT_TELEGRAM;
  } catch {
    return DEFAULT_TELEGRAM;
  }
}

export async function getChatbotSettings(): Promise<ChatbotAiSettings> {
  const db = createAdminClient();
  if (!db) return DEFAULT_CHATBOT;
  try {
    const { data } = await db
      .from("ai_chatbot_settings")
      .select("*")
      .eq("id", AI_SETTINGS_IDS.chatbot)
      .maybeSingle();
    if (!data) return DEFAULT_CHATBOT;
    return {
      ...DEFAULT_CHATBOT,
      ...data,
      personality: (data.personality as ChatbotAiSettings["personality"]) || "standard",
      telegram_escalation_enabled:
        data.telegram_escalation_enabled ?? DEFAULT_CHATBOT.telegram_escalation_enabled,
    };
  } catch {
    return DEFAULT_CHATBOT;
  }
}

const AI_MIGRATION_HINT =
  "Run supabase/migrations/20260720000300_kyc_and_ai_system.sql in Supabase SQL Editor.";

function aiTableError(message: string): string {
  if (/ai_|schema cache|does not exist|relation/i.test(message)) {
    return AI_MIGRATION_HINT;
  }
  return message;
}

export async function updateBlogSettings(
  patch: Partial<BlogAiSettings>
): Promise<{ ok: boolean; error?: string }> {
  const db = createAdminClient();
  if (!db) return { ok: false, error: "Database unavailable" };
  const { error } = await db
    .from("ai_blog_settings")
    .upsert({ id: AI_SETTINGS_IDS.blog, ...patch, updated_at: new Date().toISOString() }, { onConflict: "id" });
  return error ? { ok: false, error: aiTableError(error.message) } : { ok: true };
}

export async function updateTelegramSettings(
  patch: Partial<TelegramAiSettings>
): Promise<{ ok: boolean; error?: string }> {
  const db = createAdminClient();
  if (!db) return { ok: false, error: "Database unavailable" };
  const { error } = await db
    .from("ai_telegram_settings")
    .upsert({ id: AI_SETTINGS_IDS.telegram, ...patch, updated_at: new Date().toISOString() }, { onConflict: "id" });
  return error ? { ok: false, error: aiTableError(error.message) } : { ok: true };
}

export async function updateChatbotSettings(
  patch: Partial<ChatbotAiSettings>
): Promise<{ ok: boolean; error?: string }> {
  const db = createAdminClient();
  if (!db) return { ok: false, error: "Database unavailable" };
  const { error } = await db
    .from("ai_chatbot_settings")
    .upsert({ id: AI_SETTINGS_IDS.chatbot, ...patch, updated_at: new Date().toISOString() }, { onConflict: "id" });
  return error ? { ok: false, error: aiTableError(error.message) } : { ok: true };
}

/** Profile ID used as sender for AI bot messages in conversations. */
export async function getBotSenderProfileId(): Promise<string | null> {
  if (process.env.SPINORA_BOT_SENDER_ID?.trim()) {
    return process.env.SPINORA_BOT_SENDER_ID.trim();
  }
  if (botSenderCache !== undefined) return botSenderCache;

  const db = createAdminClient();
  if (!db) {
    botSenderCache = null;
    return null;
  }

  const { data } = await db
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  botSenderCache = data?.id ?? null;
  return botSenderCache ?? null;
}

export function personalityPrompt(personality: ChatbotAiSettings["personality"]): string {
  switch (personality) {
    case "vip":
      return "Use a luxury VIP concierge tone for high-stakes players.";
    case "energetic":
      return "Use an energetic, hype casino host tone with emojis.";
    default:
      return "Use a friendly, clear, professional support tone.";
  }
}
