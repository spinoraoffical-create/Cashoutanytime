import { NextResponse } from "next/server";
import { createPaydoraDeposit } from "@/lib/payments/paydora";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, clientIp, rateLimitUserMessage } from "@/lib/rate-limit";
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

    if (!paymentMethodId) {
      return NextResponse.json({ error: "Choose a payment method." }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Choose a deposit amount." }, { status: 400 });
    }
    const blocked = await responsibleBlock(amount);
    if (blocked) {
      return NextResponse.json({ error: blocked }, { status: 403 });
    }

    const ip = clientIp(req);
    const deposit = await createPaydoraDeposit({
      paymentMethodId,
      amount,
      userName: user.id,
      customerIp: ip === "unknown" ? "127.0.0.1" : ip,
      deviceFingerprint: fingerprint || `player_${user.id}`,
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
      { error: playerPaymentError(err) },
      { status: status >= 400 && status < 600 ? status : 500 }
    );
  }
}
