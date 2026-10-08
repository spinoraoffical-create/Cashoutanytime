import { NextResponse } from "next/server";
import { createPaydoraDeposit, getPaydoraPaymentMethods, isRemovedCheckoutMethod } from "@/lib/payments/paydora";
import { rememberPaymentIntent } from "@/lib/payments/auto-settle";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, publicClientIp, rateLimitUserMessage } from "@/lib/rate-limit";
import { playerPaymentError } from "@/lib/player-safe-error";
import { responsibleBlock } from "@/lib/responsible/play-guard";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in to deposit." }, { status: 401 });
    }

    const limited = await checkRateLimit("paydoraCreate", user.id);
    if (!limited.allowed) {
      return NextResponse.json({ error: rateLimitUserMessage(limited) }, { status: 429 });
    }

    const body = await req.json();
    const paymentMethodId = String(body.paymentMethodId || "").trim();
    const amount = Number(body.amount);
    const fingerprint = String(body.deviceFingerprint || "").trim();
    const gameSlug = String(body.gameSlug || "").trim();
    const gameName = String(body.gameName || "").trim();
    const promoCode = String(body.promoCode || body.ref || "").trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Choose a deposit amount." }, { status: 400 });
    }
    if (!gameSlug) {
      return NextResponse.json({ error: "Choose a game before paying." }, { status: 400 });
    }
    const blocked = await responsibleBlock(amount);
    if (blocked) {
      return NextResponse.json({ error: blocked }, { status: 403 });
    }

    const catalog = await getPaydoraPaymentMethods();
    const allowed = catalog.deposits.filter((method) => !isRemovedCheckoutMethod(method));
    const chosen = allowed.find((method) => method.id === paymentMethodId);
    if (!chosen) {
      return NextResponse.json({ error: "Choose Card, Chime, or Cash App." }, { status: 400 });
    }

    const ip = publicClientIp(req);
    if (!ip) {
      return NextResponse.json({ error: "Checkout could not start. Try again." }, { status: 400 });
    }

    const deposit = await createPaydoraDeposit({
      paymentMethodId: chosen.id,
      amount,
      userName: user.id,
      customerIp: ip,
      deviceFingerprint: fingerprint || `player_${user.id}`,
      idempotencyKey: `dep_${user.id}_${chosen.id}_${Date.now()}`,
    });
    if (!deposit?.id || !deposit.paymentUrl) {
      return NextResponse.json({ error: "No checkout URL returned from payment server" }, { status: 502 });
    }

    const admin = createAdminClient();
    if (!admin || !deposit.id) {
      return NextResponse.json({ error: "Could not save this payment. Try again." }, { status: 500 });
    }
    await rememberPaymentIntent(admin, {
      provider: "paydora",
      externalId: deposit.id,
      userId: user.id,
      gameSlug,
      gameName,
      promoCode,
      baseAmount: amount,
    });

    return NextResponse.json({
      success: true,
      payUrl: deposit.paymentUrl,
      depositId: deposit.id,
      referenceId: deposit.referenceId,
      amount: deposit.amount,
      status: deposit.status,
    });
  } catch (err) {
    const status = (err as { status?: number }).status || 500;
    return NextResponse.json(
      { error: playerPaymentError(err) },
      { status: status >= 400 && status < 600 ? status : 500 }
    );
  }
}
