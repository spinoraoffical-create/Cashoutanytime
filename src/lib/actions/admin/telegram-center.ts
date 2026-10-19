"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";

import { authorize, adminDb } from "@/lib/actions/admin/core";
import { hashLinkCode, sendOwnerTest } from "@/lib/telegram/control/delivery";

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
  const { error } = await adminDb().from("telegram_link_challenges").insert({
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
