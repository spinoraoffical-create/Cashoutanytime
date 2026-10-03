import { NextResponse } from "next/server";
import { createNowPaymentInvoice } from "@/lib/payments/nowpayments";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { amount, currency, userId } = body;

    if (!amount || amount < 5) {
      return NextResponse.json({ error: "Minimum deposit is $5" }, { status: 400 });
    }

    const orderId = `dep_${userId || "guest"}_${Date.now()}`;

    const invoice = await createNowPaymentInvoice({
      amount: Number(amount),
      currency: "usd",
      payCurrency: currency || "usdttrc20",
      orderId,
      orderDescription: `Spinora Casino Deposit $${amount}`,
    });

    // Record pending transaction log on server console
    if (userId) {
      console.log(`[nowpayments/create] Deposit requested: user ${userId}, amount ${amount}, orderId ${orderId}, invoiceUrl ${invoice.invoice_url}`);
    }

    return NextResponse.json(invoice);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
