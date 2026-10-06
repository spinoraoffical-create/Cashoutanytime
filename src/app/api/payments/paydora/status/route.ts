import { NextResponse } from "next/server";
import { getPaydoraDeposit, isPaidDepositStatus } from "@/lib/payments/paydora";
import { creditPaydoraDeposit } from "@/lib/payments/paydora-wallet";
import { createClient } from "@/lib/supabase/server";

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
    const methodValue = url.searchParams.get("method");
    const methodName = url.searchParams.get("methodName");
    const gameName = url.searchParams.get("gameName");
    const gameSlug = url.searchParams.get("gameSlug");

    const deposit = await getPaydoraDeposit(depositId);
    if (deposit.userName && deposit.userName !== user.id) {
      return NextResponse.json({ error: "Deposit not found." }, { status: 404 });
    }

    let credited = false;
    if (isPaidDepositStatus(deposit.status)) {
      const amount = Number(deposit.paidAmount ?? deposit.amount);
      const result = await creditPaydoraDeposit({
        userId: user.id,
        amount,
        depositId: deposit.id,
        referenceId: deposit.referenceId,
        methodValue,
        methodName,
        gameName,
        gameSlug,
      });
      credited = Boolean(result.credited);
    }

    return NextResponse.json({
      status: deposit.status,
      amount: deposit.amount,
      paidAmount: deposit.paidAmount,
      credited,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
