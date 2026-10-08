import { NextResponse } from "next/server";
import {
  isPaidDepositStatus,
  verifyPaydoraSignature,
  type PaydoraWebhookEnvelope,
} from "@/lib/payments/paydora";
import { creditPaydoraDeposit, reversePaydoraDeposit } from "@/lib/payments/paydora-wallet";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const raw = Buffer.from(await req.arrayBuffer());
  const signature = req.headers.get("x-signature") || "";

  if (!process.env.PAYDORA_WEBHOOK_SECRET?.trim()) {
    console.error("[paydora/webhook] PAYDORA_WEBHOOK_SECRET is not set");
    return new NextResponse("WEBHOOK SECRET MISSING", { status: 500 });
  }

  if (!verifyPaydoraSignature(raw, signature)) {
    return new NextResponse("INVALID SIGNATURE", { status: 401 });
  }

  let payload: PaydoraWebhookEnvelope;
  try {
    payload = JSON.parse(raw.toString("utf8"));
  } catch {
    return new NextResponse("BAD JSON", { status: 400 });
  }

  try {
    const userId = payload.data?.userName || "";
    const amount = Number(payload.data?.paidAmount ?? payload.data?.amount ?? 0);

    if (payload.event === "deposit.paid" && payload.data?.depositId && userId && amount > 0) {
      if (isPaidDepositStatus(payload.data.status || "paid") || payload.event === "deposit.paid") {
        const admin = createAdminClient();
        if (!admin) throw new Error("Admin client unavailable");
        const { data: intent, error: intentError } = await admin
          .from("payment_intents")
          .select("user_id, game_slug, game_name, promo_code, base_amount")
          .eq("provider", "paydora")
          .eq("external_id", payload.data.depositId)
          .maybeSingle();
        if (intentError) throw new Error(intentError.message);
        const saved = intent as {
          user_id?: string;
          game_slug?: string | null;
          game_name?: string | null;
          promo_code?: string | null;
          base_amount?: number | null;
        } | null;
        const savedAmount = Number(saved?.base_amount);
        if (!saved?.user_id || !saved.game_slug || !Number.isFinite(savedAmount) || savedAmount <= 0) {
          throw new Error("Payment intent or game is missing");
        }
        await creditPaydoraDeposit({
          userId: saved.user_id,
          amount: savedAmount,
          depositId: payload.data.depositId,
          referenceId: payload.data.referenceId,
          gameSlug: saved.game_slug,
          gameName: saved.game_name,
          provider: "paydora",
        });
      }
    }

    if (payload.event === "deposit.refunded" && payload.data?.depositId && userId && amount > 0) {
      await reversePaydoraDeposit({
        userId,
        amount,
        depositId: payload.data.depositId,
      });
    }
  } catch (err) {
    console.error("[paydora/webhook]", err);
    return new NextResponse("RETRY", { status: 500 });
  }

  return new NextResponse("OK", { status: 200 });
}
