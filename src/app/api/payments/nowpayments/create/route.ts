import { NextResponse } from "next/server";
import { createNowPaymentInvoice } from "@/lib/payments/nowpayments";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitUserMessage } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in to deposit." }, { status: 401 });

    const limited = await checkRateLimit("paydoraCreate", user.id);
    if (!limited.allowed) {
      return NextResponse.json({ error: rateLimitUserMessage(limited) }, { status: 429 });
    }

    const body = await req.json();
    const amount = Number(body.amount);
    const currency = typeof body.currency === "string" ? body.currency : "usdttrc20";
    if (!Number.isFinite(amount) || amount < 5) {
      return NextResponse.json({ error: "Minimum deposit is $5" }, { status: 400 });
    }

    const origin = new URL(req.url).origin;
    const orderId = `dep_${user.id}_${Date.now()}`;
    const invoice = await createNowPaymentInvoice({
      amount,
      currency: "usd",
      payCurrency: currency,
      orderId,
      orderDescription: `Sweepstakes Hub deposit $${amount.toFixed(2)}`,
      ipnCallbackUrl: `${origin}/api/payments/nowpayments/webhook`,
      successUrl: `${origin}/dashboard/wallet?deposit=success`,
      cancelUrl: `${origin}/dashboard/wallet?deposit=cancelled`,
    });

    if (!invoice.success) {
      return NextResponse.json({ error: invoice.error || "Could not start the crypto payment." }, { status: 502 });
    }

    return NextResponse.json(invoice);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
