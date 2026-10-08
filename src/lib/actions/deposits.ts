"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getDepositMethod, type DepositPaymentMethodId } from "@/lib/payments/methods";
import { createNotification } from "@/lib/actions/notifications";
import { adminDb, writeAudit } from "@/lib/actions/admin/core";
import { getAgentScope, playerInScope } from "@/lib/agents/scope";
import { rememberPaymentIntent } from "@/lib/payments/auto-settle";
import { creditPaydoraDeposit } from "@/lib/payments/paydora-wallet";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RequestStatus } from "@/types/database";

export interface DepositRequestRow {
  id: string;
  user_id: string;
  game_slug: string | null;
  game_name: string;
  payment_method: DepositPaymentMethodId;
  amount: number | null;
  proof_url: string;
  status: RequestStatus;
  admin_notes: string | null;
  wallet_credited?: boolean;
  created_at: string;
  user?: { full_name: string | null; email: string } | null;
}

export async function submitDepositRequest(_input: {
  gameSlug: string;
  gameName: string;
  paymentMethod: DepositPaymentMethodId;
  amount?: number;
  proofPath: string;
}) {
  return { error: "Deposits are paid through Paydora. Your wallet is credited when Paydora confirms the payment." };
}

export async function getAdminDepositRequests(): Promise<DepositRequestRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return [];

  const { data } = await supabase
    .from("deposit_requests")
    .select("*, user:profiles!deposit_requests_user_id_fkey(full_name, email)")
    .order("created_at", { ascending: false });

  return (data ?? []) as DepositRequestRow[];
}

export async function updateDepositStatus(
  depositId: string,
  status: RequestStatus,
  adminNotes?: string,
  creditAmount?: number
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const scope = await getAgentScope();
  const legacyAdmin = profile?.role === "admin" || profile?.role === "super_admin";
  const network = scope && (scope.level === "store" || scope.level === "sub");
  if (!legacyAdmin && !network) return { error: "Unauthorized" };

  const reader = legacyAdmin ? supabase : adminDb();
  const { data: existing, error: selectError } = await reader
    .from("deposit_requests")
    .select("user_id, game_slug, game_name, payment_method, amount, status, wallet_credited")
    .eq("id", depositId)
    .single();

  if (selectError) {
    console.error("Select deposit request error:", selectError);
    return { error: `Query error: ${selectError.message}` };
  }
  if (!existing) return { error: "Deposit request not found" };

  if (status === "completed") {
    if (existing.status === "completed" || existing.wallet_credited) {
      return { error: "Deposit already completed" };
    }

    const amount =
      creditAmount != null && !Number.isNaN(creditAmount) && creditAmount > 0
        ? Math.round(creditAmount * 100) / 100
        : existing.amount != null && existing.amount > 0
          ? Number(existing.amount)
          : null;

    if (amount == null || amount <= 0) {
      return { error: "Enter the deposit amount before confirming." };
    }

    if (network && scope) {
      if (!(await playerInScope(scope, existing.user_id))) {
        return { error: "That player is outside your network." };
      }
      if (scope.level === "sub" && (scope.approveLimit == null || amount > scope.approveLimit)) {
        return { error: "That amount is above your approval limit." };
      }
    }

    const method = getDepositMethod(existing.payment_method as DepositPaymentMethodId);
    const methodLabel = method?.label ?? existing.payment_method;
    const admin = createAdminClient();
    if (!admin) return { error: "Admin client unavailable" };

    let gameSlug = (existing.game_slug as string | null) || null;
    if (!gameSlug && existing.game_name) {
      const { data: game } = await admin
        .from("games")
        .select("slug")
        .ilike("name", existing.game_name)
        .maybeSingle();
      gameSlug = (game as { slug?: string } | null)?.slug ?? null;
    }
    if (!gameSlug) {
      return { error: "This deposit has no game, so it was not credited." };
    }

    try {
      await rememberPaymentIntent(admin, {
        provider: "manual",
        externalId: depositId,
        userId: existing.user_id,
        gameSlug,
        gameName: existing.game_name,
        baseAmount: amount,
      });
      const credited = await creditPaydoraDeposit({
        userId: existing.user_id,
        amount,
        depositId,
        methodValue: existing.payment_method,
        methodName: methodLabel,
        gameName: existing.game_name,
        gameSlug,
        provider: "manual",
      });
      if (credited.finalCredit == null) {
        return { error: "This payment has no bonus quote, so it was not credited." };
      }
      const finalCredit = credited.finalCredit;
      const note = `Paid $${amount.toFixed(2)}. Credited $${finalCredit.toFixed(2)} with the game bonus.`;
      await admin
        .from("deposit_requests")
        .update({
          status: "completed",
          wallet_credited: true,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          admin_notes: adminNotes?.trim() ? `${adminNotes.trim()} · ${note}` : note,
        })
        .eq("id", depositId);

      await writeAudit({
        actorId: user.id,
        action: "deposit.complete",
        entityType: "deposit_request",
        entityId: depositId,
        after: { status, userId: existing.user_id, paid: amount, finalCredit, game: gameSlug },
      });
      revalidatePath("/admin/deposits");
      revalidatePath("/dashboard/deposits");
      revalidatePath("/dashboard");
      revalidatePath("/admin/transactions");
      revalidatePath("/admin/failed-loads");
      return { success: true, paid: amount, finalCredit };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Could not credit this deposit." };
    }
  } else {
    if (network && scope && !(await playerInScope(scope, existing.user_id))) {
      return { error: "That player is outside your network." };
    }
    const update: Record<string, string | null> = { status };
    if (adminNotes?.trim()) update.admin_notes = adminNotes.trim();

    const writer = legacyAdmin ? supabase : adminDb();
    const { error } = await writer
      .from("deposit_requests")
      .update({
        ...update,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", depositId);

    if (error) return { error: error.message };

    if (status === "rejected") {
      await createNotification(
        existing.user_id,
        "Deposit issue",
        `We could not confirm your ${existing.game_name} deposit. Contact support if you need help.`,
        "warning"
      );
    }
  }

  await writeAudit({
    actorId: user.id,
    action: "deposit.update",
    entityType: "deposit_request",
    entityId: depositId,
    after: { status, userId: existing.user_id },
  });

  revalidatePath("/admin/deposits");
  revalidatePath("/dashboard/deposits");
  revalidatePath("/dashboard");
  revalidatePath("/admin/transactions");
  return { success: true };
}
