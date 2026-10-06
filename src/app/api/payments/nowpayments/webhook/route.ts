import { NextResponse } from "next/server";
import { verifyNowPaymentsSignature } from "@/lib/payments/nowpayments";
import { creditPaydoraDeposit } from "@/lib/payments/paydora-wallet";

export async function POST(req: Request) {
  try {
    if (!process.env.NOWPAYMENTS_IPN_SECRET?.trim()) {
      console.error("[nowpayments/webhook] NOWPAYMENTS_IPN_SECRET is not set");
      return NextResponse.json({ error: "Webhook secret missing" }, { status: 500 });
    }

    const rawBody = await req.text();
    const signature = req.headers.get("x-nowpayments-sig") || "";
    if (!verifyNowPaymentsSignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const payload = JSON.parse(rawBody) as {
      payment_status?: string;
      payment_id?: string | number;
      price_amount?: number | string;
      order_id?: string;
    };

    if (payload.payment_status === "finished" || payload.payment_status === "confirmed") {
      const parts = String(payload.order_id || "").split("_");
      const userId = parts[1] || "";
      const amount = Number(payload.price_amount || 0);
      const paymentId = String(payload.payment_id || payload.order_id || "");
      if (/^[0-9a-f-]{36}$/i.test(userId) && amount > 0 && paymentId) {
        await creditPaydoraDeposit({
          userId,
          amount,
          depositId: `nowpayments:${paymentId}`,
          referenceId: payload.order_id,
          methodValue: "usdt",
          methodName: "Crypto",
        });
      }
    }

    return NextResponse.json({ success: true, payment_status: payload.payment_status });
  } catch (err) {
    console.error("[nowpayments/webhook]", err);
    return NextResponse.json({ error: "Retry" }, { status: 500 });
  }
}
