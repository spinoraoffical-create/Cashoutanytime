"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  AdminActionResult,
  adminDb,
  authorize,
  writeAudit,
} from "@/lib/actions/admin/core";
import type { Json } from "@/lib/database.types";

export async function updateSettingAction(input: {
  key: string;
  value: Json;
}): Promise<AdminActionResult> {
  const auth = await authorize("settings.manage");
  if ("error" in auth) return { ok: false, error: auth.error };

  const db = adminDb();
  const { error } = await db
    .from("site_settings")
    .upsert({ key: input.key, value: input.value, updated_by: auth.staff.userId }, { onConflict: "key" });

  if (error) return { ok: false, error: "Could not save the setting." };

  await writeAudit({
    actorId: auth.staff.userId,
    action: "setting.update",
    entityType: "site_setting",
    entityId: input.key,
    after: input.value,
  });

  revalidatePath("/admin/settings");
  return { ok: true, message: "Setting saved." };
}

const telegramPromoMessageSchema = z.object({
  text: z.string().trim().min(3).max(500),
  link: z.string().trim().max(500).optional().default(""),
  image_url: z.string().trim().max(500).optional().default(""),
  is_active: z.boolean(),
});

export async function upsertTelegramPromoMessageAction(
  input: z.infer<typeof telegramPromoMessageSchema> & { id?: string }
): Promise<AdminActionResult> {
  const auth = await authorize("settings.manage");
  if ("error" in auth) return { ok: false, error: auth.error };

  const parsed = telegramPromoMessageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };

  const payload = {
    text: parsed.data.text,
    link: parsed.data.link || null,
    image_url: parsed.data.image_url || null,
    is_active: parsed.data.is_active,
  };

  const db = adminDb();
  const result = input.id
    ? await db.from("telegram_promo_messages").update(payload).eq("id", input.id)
    : await db.from("telegram_promo_messages").insert(payload);
  if (result.error) return { ok: false, error: "Could not save the promo message." };

  await writeAudit({
    actorId: auth.staff.userId,
    action: input.id ? "telegram_promo_message.update" : "telegram_promo_message.create",
    entityType: "telegram_promo_message",
    entityId: input.id ?? null,
    after: payload,
  });

  revalidatePath("/admin/settings");
  return { ok: true, message: "Promo message saved." };
}

export async function deleteTelegramPromoMessageAction(id: string): Promise<AdminActionResult> {
  const auth = await authorize("settings.manage");
  if ("error" in auth) return { ok: false, error: auth.error };

  const db = adminDb();
  const { error } = await db.from("telegram_promo_messages").delete().eq("id", id);
  if (error) return { ok: false, error: "Could not delete the promo message." };

  await writeAudit({
    actorId: auth.staff.userId,
    action: "telegram_promo_message.delete",
    entityType: "telegram_promo_message",
    entityId: id,
  });

  revalidatePath("/admin/settings");
  return { ok: true, message: "Deleted." };
}

/** Manual test — posts the next promo in the rotation immediately. */
export async function sendTelegramPromoNowAction(): Promise<AdminActionResult> {
  const auth = await authorize("settings.manage");
  if ("error" in auth) return { ok: false, error: auth.error };

  const { runTelegramPromoBroadcast } = await import("@/lib/telegram/promo-broadcast");
  const result = await runTelegramPromoBroadcast({ force: true });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  if (result.status === "skipped") {
    return { ok: false, error: result.reason };
  }

  return { ok: true, message: `Sent to Telegram: "${result.preview}"` };
}
