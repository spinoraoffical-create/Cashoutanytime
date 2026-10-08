import { NextResponse } from "next/server";
import { getPaydoraDeposit, isPaidDepositStatus } from "@/lib/payments/paydora";
import { playerPaymentError } from "@/lib/player-safe-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function paymentState(status: string): "paid" | "pending" | "failed" {
  const value = status.toLowerCase();
  if (isPaidDepositStatus(value)) return "paid";
  if (["failed", "expired", "cancelled", "canceled", "refunded", "rejected"].includes(value)) return "failed";
  return "pending";
}

/** Read-only. Wallet credit happens only in the Paydora webhook. */
export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

    const url = new URL(req.url);
    const depositId = url.searchParams.get("id")?.trim();
    if (!depositId) return NextResponse.json({ error: "Missing deposit id." }, { status: 400 });

    const deposit = await getPaydoraDeposit(depositId);
    if (deposit.userName && deposit.userName !== user.id) {
      return NextResponse.json({ error: "Deposit not found." }, { status: 404 });
    }

    let credited = false;
    const admin = createAdminClient();
    if (admin) {
      const { data } = await admin
        .from("deposit_bonus_ledger")
        .select("wallet_credited")
        .eq("deposit_key", deposit.id)
        .eq("user_id", user.id)
        .maybeSingle();
      credited = Boolean((data as { wallet_credited?: boolean } | null)?.wallet_credited);
    }

    return NextResponse.json({
      state: paymentState(deposit.status || "pending"),
      status: deposit.status,
      amount: deposit.amount,
      paidAmount: deposit.paidAmount,
      credited,
    });
  } catch (err) {
    return NextResponse.json({ error: playerPaymentError(err) }, { status: 500 });
  }
}
