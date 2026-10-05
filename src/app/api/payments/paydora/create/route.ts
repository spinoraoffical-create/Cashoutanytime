import { NextResponse } from "next/server";
import { createPaydoraDeposit } from "@/lib/payments/paydora";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitUserMessage } from "@/lib/rate-limit";
import { DEPOSITS_UNAVAILABLE, playerPaymentError } from "@/lib/player-safe-error";

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
      const unavailable = limited.reason === "unavailable";
      return NextResponse.json(
        { error: rateLimitUserMessage(limited) },
        { status: unavailable ? 503 : 429 }
      );
    }

    const body = await req.json();
    const paymentMethodId = String(body.paymentMethodId || "").trim();
    const amount = Number(body.amount);
    const gameSlug = body.gameSlug ? String(body.gameSlug).trim() : "";

    if (!paymentMethodId) {
      return NextResponse.json({ error: "Choose a payment method." }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Choose a deposit amount." }, { status: 400 });
    }

    const deposit = await createPaydoraDeposit({
      paymentMethodId,
      amount,
      userName: user.id,
      gameId: gameSlug || undefined,
      idempotencyKey: `dep_${user.id}_${Date.now()}`,
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
      { error: playerPaymentError(err, DEPOSITS_UNAVAILABLE) },
      { status: status >= 400 && status < 600 ? status : 500 }
    );
  }
}
