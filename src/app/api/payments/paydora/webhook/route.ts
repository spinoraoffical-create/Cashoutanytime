import { NextResponse } from "next/server";
import {
  verifyPaydoraSignature,
  type PaydoraWebhookEnvelope,
} from "@/lib/payments/paydora";
import { ageDenial } from "@/lib/compliance/age";
import { realValueDenial } from "@/lib/compliance/real-value";
import { recordHeldPaydoraWebhook } from "@/lib/payments/auto-settle";
import { collectedFromWebhook, decidePaydoraWebhook } from "@/lib/payments/paydora-webhook-decision";
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

  const depositId = payload.data?.depositId || payload.deliveryId || "";
  const eventName = payload.event || "unknown";
  const admin = createAdminClient();
  let previouslyHeld = false;
  if (admin && payload.data?.depositId) {
    const { data: existing } = await admin
      .from("webhook_events")
      .select("status, error")
      .eq("provider", "paydora")
      .eq("event_key", payload.data.depositId)
      .maybeSingle();
    const row = existing as { status?: string; error?: string | null } | null;
    previouslyHeld = Boolean(row && row.status !== "processed" && (row.error || "").startsWith("held:"));
  }

  let savedAmount: number | null = null;
  let hasIntent = false;
  let ageBlocked = false;
  let savedUserId = "";
  let savedGameSlug: string | null = null;
  let savedGameName: string | null = null;
  let savedPaymentMethod: string | null = null;
  if (admin && payload.event === "deposit.paid" && payload.data?.depositId && !realValueDenial("deposits") && !previouslyHeld) {
    const { data: intent, error: intentError } = await admin
      .from("payment_intents")
      .select("user_id, game_slug, game_name, promo_code, base_amount, payment_method")
      .eq("provider", "paydora")
      .eq("external_id", payload.data.depositId)
      .maybeSingle();
    if (intentError) {
      console.error("[paydora/webhook]", intentError.message);
      return new NextResponse("RETRY", { status: 500 });
    }
    const saved = intent as {
      user_id?: string;
      game_slug?: string | null;
      game_name?: string | null;
      base_amount?: number | null;
      payment_method?: string | null;
    } | null;
    savedAmount = Number(saved?.base_amount);
    hasIntent = Boolean(saved?.user_id && saved.game_slug && Number.isFinite(savedAmount) && savedAmount > 0);
    savedUserId = saved?.user_id || "";
    savedGameSlug = saved?.game_slug ?? null;
    savedGameName = saved?.game_name ?? null;
    savedPaymentMethod = saved?.payment_method ?? null;
    if (hasIntent) {
      const { data: profile } = await admin.from("profiles").select("date_of_birth").eq("id", savedUserId).maybeSingle();
      ageBlocked = Boolean(ageDenial((profile as { date_of_birth?: string | null } | null)?.date_of_birth));
    }
  }

  const decision = decidePaydoraWebhook({
    depositsOn: !realValueDenial("deposits"),
    previouslyHeld,
    event: eventName,
    status: payload.data?.status,
    currency: payload.data?.currency,
    savedAmount,
    collectedAmount: collectedFromWebhook(payload.data || {}),
    hasIntent,
    ageBlocked,
  });

  if (decision.action !== "credit" && decision.action !== "reverse") {
    const saved = await recordHeldPaydoraWebhook({
      depositId,
      eventName,
      error: decision.reason,
      status: decision.action === "ignore" ? "ignored" : "received",
    });
    if (!saved) return new NextResponse("RETRY", { status: 500 });
    return new NextResponse("HELD", { status: 200 });
  }

  try {
    if (decision.action === "credit") {
      if (!payload.data?.depositId || !hasIntent || !savedGameSlug) {
        throw new Error("Payment intent or game is missing");
      }
      await creditPaydoraDeposit({
        userId: savedUserId,
        amount: decision.amount,
        depositId: payload.data.depositId,
        referenceId: payload.data.referenceId,
        gameSlug: savedGameSlug,
        gameName: savedGameName,
        methodValue: savedPaymentMethod,
        provider: "paydora",
      });
    }

    if (decision.action === "reverse" && payload.data?.depositId) {
      await reversePaydoraDeposit({
        userId: payload.data.userName || "",
        amount: decision.amount,
        depositId: payload.data.depositId,
      });
    }
  } catch (err) {
    console.error("[paydora/webhook]", err);
    return new NextResponse("RETRY", { status: 500 });
  }

  return new NextResponse("OK", { status: 200 });
}
