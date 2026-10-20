"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";

import { authorize, adminDb } from "@/lib/actions/admin/core";
import { expireOpenLinkCodes, hashLinkCode, sendAlertBotTest, sendOwnerTest, sendPlayersDeliveryCheck } from "@/lib/telegram/control/delivery";
import { alertTestAccess, deliveryCheckAccess, isTelegramBotKey, webhookRecoveryDecision } from "@/lib/telegram/control/rules";

export async function createTelegramLinkAction(purpose: "owner" | "customer"): Promise<{ ok: true; deepLink: string } | { ok: false; error: string }> {
  const auth = await authorize("settings.manage");
  if ("error" in auth) return { ok: false, error: auth.error };
  if (purpose === "owner" && auth.staff.userId) {
    const { data: roles } = await adminDb()
      .from("user_roles")
      .select("roles(key)")
      .eq("user_id", auth.staff.userId);
    const isOwner = ((roles ?? []) as unknown as Array<{ roles?: { key?: string } | null }>).some((item) => item.roles?.key === "super_admin");
    if (!isOwner) return { ok: false, error: "Only an owner can link the owner bot." };
  }
  const username = purpose === "owner" ? process.env.TELEGRAM_OWNER_BOT_USERNAME : process.env.TELEGRAM_SUPPORT_BOT_USERNAME;
  if (!username) return { ok: false, error: "The bot username is not set." };
  const code = randomBytes(24).toString("hex");
  const codeHash = hashLinkCode(code);
  if (!codeHash) return { ok: false, error: "TELEGRAM_LINK_PEPPER is not set." };
  const db = adminDb();
  await expireOpenLinkCodes(db, auth.staff.userId, purpose);
  const { error } = await db.from("telegram_link_challenges").insert({
    code_hash: codeHash,
    purpose,
    user_id: auth.staff.userId,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  if (error) return { ok: false, error: "Apply the Telegram SQL before creating a link code." };
  revalidatePath("/admin/telegram-center");
  return { ok: true, deepLink: `https://t.me/${username.replace(/^@/, "")}?start=${code}` };
}

export async function sendTelegramOwnerTestAction(): Promise<{ ok: boolean; error?: string }> {
  const auth = await authorize("settings.manage");
  if ("error" in auth) return { ok: false, error: auth.error };
  const { data: roles } = await adminDb()
    .from("user_roles")
    .select("roles(key)")
    .eq("user_id", auth.staff.userId);
  const isOwner = ((roles ?? []) as unknown as Array<{ roles?: { key?: string } | null }>).some((item) => item.roles?.key === "super_admin");
  if (!isOwner) return { ok: false, error: "Only an owner can send the test." };
  const result = await sendOwnerTest();
  if (result.ok) {
    await adminDb().from("telegram_control_audit").insert({
      actor_id: auth.staff.userId,
      action: "telegram.owner_test",
      detail: "Queued a test to the saved owner chat.",
    });
  }
  return result;
}

export async function sendPlayersDeliveryCheckAction(): Promise<{
  ok: boolean;
  repeated?: boolean;
  status?: string;
  error?: string;
}> {
  const auth = await authorize("settings.manage");
  if ("error" in auth) return { ok: false, error: auth.error };
  const { data: roles } = await adminDb()
    .from("user_roles")
    .select("roles(key)")
    .eq("user_id", auth.staff.userId);
  const isOwner = ((roles ?? []) as unknown as Array<{ roles?: { key?: string } | null }>).some((item) => item.roles?.key === "super_admin");
  const access = deliveryCheckAccess(isOwner);
  if (!access.ok) return access;
  const result = await sendPlayersDeliveryCheck();
  if (result.ok && !result.repeated) {
    await adminDb().from("telegram_control_audit").insert({
      actor_id: auth.staff.userId,
      action: "telegram.delivery_check",
      detail: "players delivery-check queued",
    });
  }
  revalidatePath("/admin/telegram-center");
  return result;
}

export async function sendTelegramAlertTestAction(
  bot: string
): Promise<{ ok: boolean; status?: "accepted" | "failed" | "uncertain"; error?: string; repeated?: boolean }> {
  const auth = await authorize("settings.manage");
  if ("error" in auth) return { ok: false, error: auth.error };
  const { data: roles } = await adminDb()
    .from("user_roles")
    .select("roles(key)")
    .eq("user_id", auth.staff.userId);
  const isOwner = ((roles ?? []) as unknown as Array<{ roles?: { key?: string } | null }>).some((item) => item.roles?.key === "super_admin");
  const access = alertTestAccess({ isSuperAdmin: isOwner, bot });
  if (!access.ok) return access;
  const result = await sendAlertBotTest(access.bot);
  if (!result.repeated && result.status) {
    await adminDb().from("telegram_control_audit").insert({
      actor_id: auth.staff.userId,
      action: "telegram.alert_test",
      detail: `${access.bot} ${result.status}`,
    });
  }
  revalidatePath("/admin/telegram-center");
  return result;
}

async function ownerOnly(): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const auth = await authorize("settings.manage");
  if ("error" in auth) return { ok: false, error: auth.error };
  const { data: roles } = await adminDb()
    .from("user_roles")
    .select("roles(key)")
    .eq("user_id", auth.staff.userId);
  const isOwner = ((roles ?? []) as unknown as Array<{ roles?: { key?: string } | null }>).some((item) => item.roles?.key === "super_admin");
  if (!isOwner) return { ok: false, error: "Only an owner can recover a webhook update." };
  return { ok: true, userId: auth.staff.userId };
}

/** Reopen allows Telegram to deliver the same update id again. It does not run the command. */
export async function recoverTelegramUpdateAction(
  bot: string,
  updateId: number,
  action: "reopen" | "dismiss"
): Promise<{ ok: boolean; error?: string }> {
  const auth = await ownerOnly();
  if (!auth.ok) return auth;
  if (!isTelegramBotKey(bot) || !Number.isInteger(updateId) || updateId < 0) {
    return { ok: false, error: "That update cannot be recovered." };
  }
  const db = adminDb();
  const { data, error } = await db
    .from("telegram_webhook_updates")
    .select("status, command_name")
    .eq("bot_key", bot)
    .eq("update_id", updateId)
    .maybeSingle();
  if (error || !data) return { ok: false, error: "That update is not in the delivery table." };
  const row = data as { status: string; command_name: string | null };
  const decision = webhookRecoveryDecision({ status: row.status, action });
  if (decision === "refuse") return { ok: false, error: "Only an exhausted update can be reopened or dismissed." };
  const next =
    decision === "reopen"
      ? { status: "failed", attempts: 0, last_error: "Reopened. The command was not run. Telegram must deliver this update id again." }
      : { status: "reviewed", last_error: "Dismissed. The command was not run." };
  const { error: updateError } = await db
    .from("telegram_webhook_updates")
    .update(next)
    .eq("bot_key", bot)
    .eq("update_id", updateId)
    .eq("status", "exhausted");
  if (updateError) return { ok: false, error: "The update was not changed." };
  await db.from("telegram_control_audit").insert({
    actor_id: auth.userId,
    action: decision === "reopen" ? "telegram.update_reopen" : "telegram.update_dismiss",
    detail: `${bot} ${updateId} ${row.command_name ?? "no command"}`,
  });
  revalidatePath("/admin/telegram-center");
  return { ok: true };
}
