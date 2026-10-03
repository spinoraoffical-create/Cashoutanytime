"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  AdminActionResult,
  adminDb,
  authorize,
  writeAudit,
} from "@/lib/actions/admin/core";
import { adminLink, tgEsc, tgNotify } from "@/lib/telegram";

export async function setBanAction(input: {
  userId: string;
  banned: boolean;
  reason?: string;
}): Promise<AdminActionResult> {
  const auth = await authorize("users.manage");
  if ("error" in auth) return { ok: false, error: auth.error };

  const db = adminDb();
  const { data: before } = await db
    .from("profiles")
    .select("is_suspended")
    .eq("id", input.userId)
    .single();

  const { error } = await db
    .from("profiles")
    .update({
      is_suspended: input.banned,
    })
    .eq("id", input.userId);

  if (error) return { ok: false, error: "Could not update the member." };

  await writeAudit({
    actorId: auth.staff.userId,
    action: input.banned ? "user.ban" : "user.unban",
    entityType: "profile",
    entityId: input.userId,
    before,
    after: { is_suspended: input.banned, reason: input.reason ?? null },
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${input.userId}`);
  return { ok: true, message: input.banned ? "Member banned." : "Member reinstated." };
}

export async function deleteUserAccountAction(userId: string): Promise<AdminActionResult> {
  const auth = await authorize("users.delete");
  if ("error" in auth) return { ok: false, error: auth.error };
  if (userId === auth.staff.userId) {
    return { ok: false, error: "You can't delete your own account." };
  }

  const db = adminDb();
  const { data: before } = await db.from("profiles").select("*").eq("id", userId).single();

  const { error } = await db.rpc("admin_delete_user_account", { target_user_id: userId });
  if (error) return { ok: false, error: "Could not delete the account." };

  await writeAudit({
    actorId: auth.staff.userId,
    action: "user.delete",
    entityType: "profile",
    entityId: userId,
    before,
  });

  revalidatePath("/admin/users");
  return { ok: true, message: "Account permanently deleted." };
}

const adjustSchema = z.object({
  userId: z.uuid(),
  currency: z.enum(["coins", "xp"]),
  amount: z.number().int().refine((n) => n !== 0, "Amount can't be zero"),
  note: z.string().trim().min(3, "Add a reason").max(200),
});

export async function adjustBalanceAction(input: {
  userId: string;
  currency: "coins" | "xp";
  amount: number;
  note: string;
}): Promise<AdminActionResult> {
  const auth = await authorize("users.manage");
  if ("error" in auth) return { ok: false, error: auth.error };

  const parsed = adjustSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const db = adminDb();
  const rpc =
    parsed.data.currency === "coins" ? "grant_coins" : "grant_xp";

  // XP can't go negative; coins can be debited but not below zero (DB guards it).
  const { error } = await db.rpc(rpc, {
    target_user: parsed.data.userId,
    amount: parsed.data.amount,
    entry_type: "admin_adjustment",
    ref_type: "admin",
    ref_id: null,
    note: parsed.data.note,
  });

  if (error) {
    return {
      ok: false,
      error: /balance/.test(error.message)
        ? "That would put the member's balance below zero."
        : "Adjustment failed.",
    };
  }

  await writeAudit({
    actorId: auth.staff.userId,
    action: "user.balance_adjust",
    entityType: "profile",
    entityId: parsed.data.userId,
    after: {
      currency: parsed.data.currency,
      amount: parsed.data.amount,
      note: parsed.data.note,
    },
  });

  revalidatePath(`/admin/users/${parsed.data.userId}`);
  revalidatePath("/admin/users");
  return { ok: true, message: "Balance adjusted." };
}

// ── Real-money wallet: credit / debit (uses the same definer RPCs the app does) ──

const walletSchema = z.object({
  userId: z.uuid(),
  amount: z.number().refine((n) => n !== 0, "Amount can't be zero"),
  note: z.string().trim().min(3, "Add a reason").max(200),
});

export async function adjustWalletAction(input: {
  userId: string;
  amount: number;
  note: string;
}): Promise<AdminActionResult> {
  const auth = await authorize("users.manage");
  if ("error" in auth) return { ok: false, error: auth.error };

  const parsed = walletSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const db = adminDb();
  const credit = parsed.data.amount > 0;
  const { error } = await db.rpc(credit ? "credit_wallet" : "debit_wallet", {
    p_user: parsed.data.userId,
    p_amount: Math.abs(parsed.data.amount),
    p_kind: "adjustment",
    p_desc: parsed.data.note,
    p_ref: null,
  });

  if (error) {
    return {
      ok: false,
      error: /insufficient/i.test(error.message)
        ? "That would put the wallet below zero."
        : "Wallet adjustment failed.",
    };
  }

  await writeAudit({
    actorId: auth.staff.userId,
    action: "user.wallet_adjust",
    entityType: "profile",
    entityId: parsed.data.userId,
    after: { amount: parsed.data.amount, note: parsed.data.note },
  });

  await tgNotify("finance", `⚙️ <b>Wallet ${credit ? "credited" : "debited"}</b>\n${credit ? "+" : "-"}$${Math.abs(parsed.data.amount).toFixed(2)} · ${tgEsc(parsed.data.userId.slice(0, 8))}...\n${tgEsc(parsed.data.note)}\n${adminLink("/admin/users", "👉 View User")}`);
  revalidatePath(`/admin/users/${parsed.data.userId}`);
  revalidatePath("/admin/users");
  return { ok: true, message: credit ? "Wallet credited." : "Wallet debited." };
}

// ── Redeem (cash-out) payout: debit cashout_wallet + ledger row ──

const payoutSchema = z.object({
  userId: z.uuid(),
  amount: z.number().positive("Amount must be positive"),
  note: z.string().trim().max(200).optional(),
});

export async function recordCashoutPayoutAction(input: {
  userId: string;
  amount: number;
  note?: string;
}): Promise<AdminActionResult> {
  const auth = await authorize("users.manage");
  if ("error" in auth) return { ok: false, error: auth.error };

  const parsed = payoutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const db = adminDb();
  const { error } = await db.rpc("admin_payout_cashout", {
    p_user: parsed.data.userId,
    p_amount: parsed.data.amount,
    p_note: parsed.data.note ?? null,
  });

  if (error) {
    return {
      ok: false,
      error: /insufficient/i.test(error.message)
        ? "Member's cash-out balance is too low for that payout."
        : "Payout failed.",
    };
  }

  await writeAudit({
    actorId: auth.staff.userId,
    action: "user.cashout_payout",
    entityType: "profile",
    entityId: parsed.data.userId,
    after: { amount: parsed.data.amount, note: parsed.data.note ?? null },
  });

  await tgNotify("finance", `💸 <b>Cashout payout</b>\n$${parsed.data.amount.toFixed(2)} · ${tgEsc(parsed.data.userId.slice(0, 8))}...${parsed.data.note ? `\n${tgEsc(parsed.data.note)}` : ""}\n${adminLink("/admin/payouts", "👉 View Payouts")}`);
  revalidatePath(`/admin/users/${parsed.data.userId}`);
  revalidatePath("/admin/users");
  return { ok: true, message: "Cash-out payout recorded." };
}

export async function setUserRolesAction(input: {
  userId: string;
  roleKeys: string[];
}): Promise<AdminActionResult> {
  const auth = await authorize("users.roles");
  if ("error" in auth) return { ok: false, error: auth.error };

  const db = adminDb();

  const { data: roles } = await db.from("roles").select("id, key");
  const roleMap = new Map((roles ?? []).map((r) => [r.key, r.id]));

  // never allow removing your own super_admin (lockout guard)
  const wantsKeys = new Set(input.roleKeys);
  const targetRoleIds = input.roleKeys
    .map((k) => roleMap.get(k as never))
    .filter((id): id is string => Boolean(id));

  const { data: before } = await db
    .from("user_roles")
    .select("role_id")
    .eq("user_id", input.userId);

  // replace the user's roles atomically-ish: delete then insert
  const { error: delError } = await db
    .from("user_roles")
    .delete()
    .eq("user_id", input.userId);
  if (delError) return { ok: false, error: "Could not update roles." };

  if (targetRoleIds.length > 0) {
    const { error: insError } = await db.from("user_roles").insert(
      targetRoleIds.map((role_id) => ({
        user_id: input.userId,
        role_id,
        granted_by: auth.staff.userId,
      }))
    );
    if (insError) return { ok: false, error: "Could not assign the new roles." };
  }

  await writeAudit({
    actorId: auth.staff.userId,
    action: "user.roles_set",
    entityType: "profile",
    entityId: input.userId,
    before: { role_ids: (before ?? []).map((r) => r.role_id) },
    after: { roles: [...wantsKeys] },
  });

  revalidatePath(`/admin/users/${input.userId}`);
  revalidatePath("/admin/users");
  return { ok: true, message: "Roles updated." };
}
