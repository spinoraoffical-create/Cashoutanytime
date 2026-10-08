"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { type DepositPaymentMethodId } from "@/lib/payments/methods";
import { createNotification } from "@/lib/actions/notifications";
import { adminDb, writeAudit } from "@/lib/actions/admin/core";
import { getAgentScope, playerInScope } from "@/lib/agents/scope";
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
  _creditAmount?: number
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
    return { error: "The wallet is credited when Paydora confirms the payment." };
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
