import { NextResponse } from "next/server";
import { realValueDenial } from "@/lib/compliance/real-value";
import { amountsForMethod, checkoutMethodRank, getPaydoraPaymentMethods, isPaydoraConfigured, isRemovedCheckoutMethod } from "@/lib/payments/paydora";
import { DEPOSITS_UNAVAILABLE } from "@/lib/player-safe-error";

export async function GET() {
  if (realValueDenial("deposits") || !isPaydoraConfigured()) {
    return NextResponse.json({ error: DEPOSITS_UNAVAILABLE }, { status: 503 });
  }
  try {
    const methods = await getPaydoraPaymentMethods();
    return NextResponse.json({
      deposits: methods.deposits
        .filter((m) => !isRemovedCheckoutMethod(m))
        .sort((a, b) => checkoutMethodRank(a) - checkoutMethodRank(b))
        .map((m) => ({
          ...m,
          amounts: amountsForMethod(m.value),
        })),
      withdrawals: methods.withdrawals,
    });
  } catch (err) {
    console.error("[paydora/methods]", err instanceof Error ? err.message : "payment methods failed");
    return NextResponse.json({ error: DEPOSITS_UNAVAILABLE }, { status: 503 });
  }
}
