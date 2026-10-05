import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createPaydoraWithdrawal, getPaydoraPaymentMethods } from "@/lib/payments/paydora";
import {
  debitPaydoraPayout,
  refundFailedPaydoraPayout,
} from "@/lib/payments/paydora-wallet";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitUserMessage } from "@/lib/rate-limit";
import { playerPaymentError } from "@/lib/player-safe-error";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const limited = await checkRateLimit("paydoraPayout", user.id);
    if (!limited.allowed) {
      const unavailable = limited.reason === "unavailable";
      return NextResponse.json(
        { error: rateLimitUserMessage(limited) },
        { status: unavailable ? 503 : 429 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("wallet_balance, kyc_status")
      .eq("id", user.id)
      .single();

    if (profile?.kyc_status !== "verified") {
      return NextResponse.json(
        {
          error:
            profile?.kyc_status === "pending"
              ? "KYC is under review. Cashout is available after approval."
              : "KYC verification is required before cashout.",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const methodValue = String(body.method || body.payoutType || "").trim().toLowerCase();
    const amount = Number(body.amount);
    const address = String(body.address || body.accountNo || "").trim();
    const chimePhoneEmail = String(body.chimePhoneEmail || "").trim();

    if (!methodValue) return NextResponse.json({ error: "Choose a payout method." }, { status: 400 });
    if (!Number.isFinite(amount) || amount < 1) {
      return NextResponse.json({ error: "Payout amount must be at least $1.00" }, { status: 400 });
    }

    const currentBalance = Number(profile?.wallet_balance || 0);
    if (currentBalance < amount) {
      return NextResponse.json(
        { error: `Insufficient wallet balance ($${currentBalance.toFixed(2)})` },
        { status: 400 }
      );
    }

    const methods = await getPaydoraPaymentMethods();
    const method = methods.withdrawals.find((m) => m.value.toLowerCase() === methodValue);
    if (!method) {
      return NextResponse.json({ error: "That payout method is not enabled." }, { status: 400 });
    }

    const payoutKey = `payout:${randomUUID()}`;
    const debit = await debitPaydoraPayout({
      userId: user.id,
      amount,
      payoutKey,
    });
    if (!debit.debited) {
      return NextResponse.json({ error: "This payout was already submitted." }, { status: 409 });
    }

    try {
      const withdrawal = await createPaydoraWithdrawal({
        paymentMethodId: method.id,
        amount,
        userName: user.id,
        address: address || undefined,
        chimePhoneEmail: chimePhoneEmail || undefined,
        cardNumber: body.cardNumber ? String(body.cardNumber) : undefined,
        cardValid: body.cardValid ? String(body.cardValid) : undefined,
        idempotencyKey: payoutKey,
      });

      return NextResponse.json({
        success: true,
        withdrawalId: withdrawal.id,
        referenceId: withdrawal.referenceId,
        status: withdrawal.status,
        amount: withdrawal.amount,
      });
    } catch (err) {
      await refundFailedPaydoraPayout({
        userId: user.id,
        amount,
        payoutKey,
      });
      throw err;
    }
  } catch (err) {
    const status = (err as { status?: number }).status || 500;
    return NextResponse.json(
      {
        error: playerPaymentError(
          err,
          "Cash outs are temporarily unavailable. Please try again later or contact support."
        ),
      },
      { status: status >= 400 && status < 600 ? status : 500 }
    );
  }
}
