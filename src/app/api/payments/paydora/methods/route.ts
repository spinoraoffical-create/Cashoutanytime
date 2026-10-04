import { NextResponse } from "next/server";
import { amountsForMethod, getPaydoraPaymentMethods } from "@/lib/payments/paydora";

export async function GET() {
  try {
    const methods = await getPaydoraPaymentMethods();
    return NextResponse.json({
      deposits: methods.deposits.map((m) => ({
        ...m,
        amounts: amountsForMethod(m.value),
      })),
      withdrawals: methods.withdrawals,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not load payment methods";
    const status = (err as { status?: number }).status || 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
