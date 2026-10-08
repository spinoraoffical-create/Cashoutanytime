import { NextResponse } from "next/server";
import { verifyNowPaymentsSignature } from "@/lib/payments/nowpayments";
import { creditPaydoraDeposit } from "@/lib/payments/paydora-wallet";
import { createAdminClient } from "@/lib/supabase/admin";

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
      const orderId = String(payload.order_id || "").trim();
      const amount = Number(payload.price_amount || 0);
      if (!orderId || !(amount > 0)) {
        return NextResponse.json({ error: "Payment intent or game is missing" }, { status: 500 });
      }
      const admin = createAdminClient();
      if (!admin) return NextResponse.json({ error: "Retry" }, { status: 500 });
      const { data: intent, error: intentError } = await admin
        .from("payment_intents")
        .select("user_id, game_slug, game_name")
        .eq("provider", "nowpayments")
        .eq("external_id", orderId)
        .maybeSingle();
      if (intentError) throw new Error(intentError.message);
      const saved = intent as { user_id?: string; game_slug?: string | null; game_name?: string | null } | null;
      if (!saved?.user_id || !saved.game_slug) {
        return NextResponse.json({ error: "Payment intent or game is missing" }, { status: 500 });
      }
      await creditPaydoraDeposit({
        userId: saved.user_id,
        amount,
        depositId: orderId,
        referenceId: orderId,
        methodValue: "usdt",
        methodName: "Crypto",
        gameSlug: saved.game_slug,
        gameName: saved.game_name,
        provider: "nowpayments",
      });
    }

    return NextResponse.json({ success: true, payment_status: payload.payment_status });
  } catch (err) {
    console.error("[nowpayments/webhook]", err);
    return NextResponse.json({ error: "Retry" }, { status: 500 });
  }
}
