"use server";

import { revalidatePath } from "next/cache";
import {
  getBlogSettings,
  getChatbotSettings,
  getTelegramSettings,
  updateBlogSettings,
  updateChatbotSettings,
  updateTelegramSettings,
  type ChatbotAiSettings,
} from "@/lib/ai/settings";
import { authorize } from "@/lib/actions/admin/core";

export async function fetchAiSettingsAction() {
  const auth = await authorize("cms.manage");
  if ("error" in auth) return { ok: false as const, error: auth.error };

  const [blog, telegram, chatbot] = await Promise.all([
    getBlogSettings(),
    getTelegramSettings(),
    getChatbotSettings(),
  ]);

  return { ok: true as const, blog, telegram, chatbot };
}

export async function fetchChatbotSettingsAction() {
  const auth = await authorize("support.manage");
  if ("error" in auth) return { ok: false as const, error: auth.error };
  const chatbot = await getChatbotSettings();
  return { ok: true as const, chatbot };
}

export async function updateChatbotSettingsAction(
  patch: Partial<ChatbotAiSettings>
): Promise<{ ok: boolean; error?: string }> {
  const auth = await authorize("support.manage");
  if ("error" in auth) return { ok: false, error: auth.error };

  const result = await updateChatbotSettings(patch);
  if (result.ok) revalidatePath("/admin/ai-bot");
  return result;
}

export async function updateBlogSettingsAction(
  patch: Parameters<typeof updateBlogSettings>[0]
): Promise<{ ok: boolean; error?: string }> {
  const auth = await authorize("cms.manage");
  if ("error" in auth) return { ok: false, error: auth.error };

  const result = await updateBlogSettings(patch);
  if (result.ok) revalidatePath("/admin/ai-blog");
  return result;
}

export async function updateTelegramSettingsAction(
  patch: Parameters<typeof updateTelegramSettings>[0]
): Promise<{ ok: boolean; error?: string }> {
  const auth = await authorize("cms.manage");
  if ("error" in auth) return { ok: false, error: auth.error };

  const result = await updateTelegramSettings(patch);
  if (result.ok) revalidatePath("/admin/telegram");
  return result;
}
