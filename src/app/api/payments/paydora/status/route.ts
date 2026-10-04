import { NextResponse } from "next/server";
import { getPaydoraDeposit, isPaidDepositStatus } from "@/lib/payments/paydora";
import { hasPaydoraPaymentBeenCredited } from "@/lib/payments/paydora-wallet";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

    const allowed = await rateLimit("paydoraStatus", user.id);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }

    const url = new URL(req.url);
    const depositId = url.searchParams.get("id")?.trim();
    if (!depositId) return NextResponse.json({ error: "Missing deposit id." }, { status: 400 });

    const deposit = await getPaydoraDeposit(depositId);
    if (deposit.userName && deposit.userName !== user.id) {
      return NextResponse.json({ error: "Deposit not found." }, { status: 404 });
    }

    const credited = await hasPaydoraPaymentBeenCredited(deposit.id, user.id);

    return NextResponse.json({
      status: deposit.status,
      amount: deposit.amount,
      paidAmount: deposit.paidAmount,
      paid: isPaidDepositStatus(deposit.status),
      credited,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
