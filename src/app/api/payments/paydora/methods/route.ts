import { NextResponse } from "next/server";
import { amountsForMethod, getPaydoraPaymentMethods, isRemovedCheckoutMethod } from "@/lib/payments/paydora";
import { playerPaymentError } from "@/lib/player-safe-error";

export async function GET() {
  try {
    const methods = await getPaydoraPaymentMethods();
    return NextResponse.json({
      deposits: methods.deposits
        .filter((m) => !isRemovedCheckoutMethod(m))
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
