import { NextResponse } from "next/server";
import { amountsForMethod, checkoutMethodRank, getPaydoraPaymentMethods, isRemovedCheckoutMethod } from "@/lib/payments/paydora";
import { playerPaymentError } from "@/lib/player-safe-error";

export async function GET() {
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
    const status = (err as { status?: number }).status || 500;
    return NextResponse.json({ error: playerPaymentError(err) }, { status });
  }
}
