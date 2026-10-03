"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getDepositMethod, type DepositPaymentMethodId } from "@/lib/payments/methods";
import { notifyAdminOfDeposit } from "@/lib/telegram/notify-admin-deposit";
import { createNotification } from "@/lib/actions/notifications";
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

export async function submitDepositRequest(input: {
  gameSlug: string;
  gameName: string;
  paymentMethod: DepositPaymentMethodId;
  amount?: number;
  proofPath: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in to submit a deposit." };

  if (!getDepositMethod(input.paymentMethod)) {
    return { error: "Invalid payment method." };
  }

  if (!input.proofPath?.trim()) {
    return { error: "Payment screenshot is required." };
  }

  const amount =
    input.amount != null && !Number.isNaN(input.amount) && input.amount > 0
      ? Math.round(input.amount * 100) / 100
      : null;

  const { data: row, error } = await supabase
    .from("deposit_requests")
    .insert({
      user_id: user.id,
      game_slug: input.gameSlug,
      game_name: input.gameName,
      payment_method: input.paymentMethod,
      amount,
      proof_url: input.proofPath.trim(),
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    if (error.message.includes("deposit_requests")) {
      return { error: "Deposits not set up. Run supabase/deposit-requests.sql in Supabase." };
    }
    return { error: error.message };
  }

  void notifyAdminOfDeposit({
    userId: user.id,
    gameName: input.gameName,
    paymentMethod: input.paymentMethod,
    amount,
    proofPath: input.proofPath.trim(),
    depositId: row.id,
  });

  revalidatePath("/admin/deposits");
  revalidatePath("/dashboard/deposits");
  return { success: true, id: row.id };
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
  if (profile?.role !== "admin") return { error: "Unauthorized" };

  const { data: existing, error: selectError } = await supabase
    .from("deposit_requests")
    .select("user_id, game_name, payment_method, amount, status, wallet_credited")
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

    const method = getDepositMethod(existing.payment_method as DepositPaymentMethodId);
    const methodLabel = method?.label ?? existing.payment_method;

    const { error: rpcError } = await supabase.rpc("complete_deposit_request", {
      p_deposit_id: depositId,
      p_amount: amount,
      p_admin_notes: adminNotes?.trim() ?? null,
    });

    if (rpcError) {
      if (rpcError.code === "42883" || rpcError.message.includes("Could not find the function")) {
        return {
          error: "Deposit wallet credit not set up. Run supabase/deposit-wallet-credit.sql in Supabase.",
        };
      }
      return { error: rpcError.message };
    }

    await createNotification(
      existing.user_id,
      "Deposit confirmed! 💰",
      `$${amount.toFixed(2)} has been added to your Total Deposit wallet (${existing.game_name} · ${methodLabel}).`,
      "success"
    );
  } else {
    const update: Record<string, string | null> = { status };
    if (adminNotes?.trim()) update.admin_notes = adminNotes.trim();

    const { error } = await supabase
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

  revalidatePath("/admin/deposits");
  revalidatePath("/dashboard/deposits");
  revalidatePath("/dashboard");
  revalidatePath("/admin/transactions");
  return { success: true };
}
