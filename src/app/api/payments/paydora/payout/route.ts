import { NextResponse } from "next/server";
import { createPaydoraWithdrawal, getPaydoraPaymentMethods } from "@/lib/payments/paydora";
import {
  classifyProviderFailure,
  payoutAmount,
  payoutDestinationKey,
} from "@/lib/payments/payout-reservation";
import { isRestrictedPaymentRequest } from "@/lib/compliance/restricted-state";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, rateLimitUserMessage } from "@/lib/rate-limit";
import { playerPaymentError } from "@/lib/player-safe-error";

type ReservedPayout = {
  reused?: boolean;
  debited?: boolean;
  promoted?: boolean;
  idempotency_key?: string;
  status?: string;
  amount?: number;
  provider_withdrawal_id?: string | null;
  provider_reference_id?: string | null;
  provider_status?: string | null;
};

type ProviderAttempt = {
  call_provider?: boolean;
  in_progress?: boolean;
  status?: string;
  idempotency_key?: string;
  provider_withdrawal_id?: string | null;
  provider_reference_id?: string | null;
};

export async function POST(req: Request) {
  try {
    if (isRestrictedPaymentRequest(req.headers)) {
      return NextResponse.json({ error: "Cash outs are unavailable in your state." }, { status: 403 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const limited = await checkRateLimit("paydoraPayout", user.id);
    if (!limited.allowed) {
      return NextResponse.json({ error: rateLimitUserMessage(limited) }, { status: 429 });
    }

    const body = await req.json();
    const methodValue = String(body.method || body.payoutType || "").trim().toLowerCase();
    const amount = payoutAmount(Number(body.amount));
    const address = String(body.address || body.accountNo || "").trim();
    const chimePhoneEmail = String(body.chimePhoneEmail || "").trim();

    if (!methodValue) return NextResponse.json({ error: "Choose a payout method." }, { status: 400 });
    if (!Number.isFinite(amount) || amount < 1) {
      return NextResponse.json({ error: "Payout amount must be at least $1.00" }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("cashout_wallet, kyc_status")
      .eq("id", user.id)
      .single();

    const kyc = (profile as { kyc_status?: string | null } | null)?.kyc_status;
    if (kyc !== "verified" && kyc !== "approved") {
      return NextResponse.json(
        {
          error:
            kyc === "pending"
              ? "KYC is under review. Cash out opens after your ID is approved."
              : "Verify your ID before cashing out.",
        },
        { status: 403 }
      );
    }

    const currentBalance = Number((profile as { cashout_wallet?: number } | null)?.cashout_wallet || 0);
    const methods = await getPaydoraPaymentMethods();
    const method = methods.withdrawals.find((item) => item.value.toLowerCase() === methodValue);
    if (!method) {
      return NextResponse.json({ error: "That payout method is not enabled." }, { status: 400 });
    }

    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: "Payouts are temporarily unavailable." }, { status: 503 });

    const { data: ops, error: opsError } = await admin
      .from("platform_ops")
      .select("cashout_auto_limit")
      .eq("key", "cashout")
      .maybeSingle();
    if (opsError || !ops) {
      return NextResponse.json({
        held: true,
        error: "This cash out is waiting for a Super Admin. Your wallet was not charged.",
      }, { status: 202 });
    }
    const autoLimit = Number((ops as { cashout_auto_limit?: number } | null)?.cashout_auto_limit ?? 0);
    const { data: fraud, error: fraudError } = await admin
      .from("fraud_scores")
      .select("user_id, blocked, rewards_blocked, manual_review, risk_score")
      .eq("user_id", user.id)
      .maybeSingle();
    if (fraudError) {
      return NextResponse.json({
        held: true,
        error: "This cash out is waiting for a Super Admin. Your wallet was not charged.",
      }, { status: 202 });
    }
    const risk = fraud as { blocked?: boolean; rewards_blocked?: boolean; manual_review?: boolean; risk_score?: number } | null;
    const flagged = Boolean(
      risk && (risk.blocked || risk.rewards_blocked || risk.manual_review || Number(risk.risk_score ?? 0) >= 50)
    );
    const hold = autoLimit <= 0 || amount > autoLimit || flagged;
    const holdReason = flagged
      ? "Risk review"
      : amount > autoLimit && autoLimit > 0
        ? "Above the automatic cash-out limit"
        : "Automatic cash out is off until a limit is set";

    const destinationKey = payoutDestinationKey({
      method: methodValue,
      amount,
      address,
      chimePhoneEmail,
      cardNumber: body.cardNumber ? String(body.cardNumber) : "",
      cardValid: body.cardValid ? String(body.cardValid) : "",
    });
    const { data: reservedRaw, error: reserveError } = await admin.rpc("reserve_paydora_payout", {
      p_user_id: user.id,
      p_amount: amount,
      p_method: methodValue,
      p_destination_key: destinationKey,
      p_hold: hold,
      p_hold_reason: hold ? holdReason : null,
    });
    if (reserveError) {
      const message = /insufficient/i.test(reserveError.message)
        ? `Insufficient cash-out balance ($${currentBalance.toFixed(2)})`
        : "Could not reserve that payout. Try again.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const reserved = (reservedRaw ?? {}) as ReservedPayout;
    const idempotencyKey = reserved.idempotency_key || "";
    if (!idempotencyKey || idempotencyKey.startsWith("refund:")) {
      return NextResponse.json({ error: "Could not reserve that payout. Try again." }, { status: 400 });
    }

    if (reserved.status === "manual_review") {
      await admin.from("cashout_holds").upsert(
        {
          payout_key: idempotencyKey,
          user_id: user.id,
          amount,
          reason: holdReason,
          status: "held",
        },
        { onConflict: "payout_key", ignoreDuplicates: true }
      );
      return NextResponse.json({
        held: true,
        error: "This cash out is waiting for a Super Admin. Your wallet was not charged.",
      }, { status: 202 });
    }

    if (reserved.promoted) {
      await admin
        .from("cashout_holds")
        .update({ status: "released", resolved_at: new Date().toISOString() })
        .eq("payout_key", idempotencyKey)
        .eq("status", "held");
    }

    if (reserved.status === "submitted" || reserved.status === "paid") {
      return NextResponse.json({
        success: true,
        duplicate: true,
        status: reserved.status === "paid" ? "paid" : "already_submitted",
        withdrawalId: reserved.provider_withdrawal_id,
        referenceId: reserved.provider_reference_id,
      });
    }

    if (reserved.status !== "reserved") {
      return NextResponse.json({ success: true, status: "pending", error: "pending" });
    }

    const { data: attemptRaw, error: attemptError } = await admin.rpc("begin_paydora_provider_attempt", {
      p_user_id: user.id,
      p_idempotency_key: idempotencyKey,
    });
    if (attemptError) {
      return NextResponse.json({ success: true, status: "pending", error: "pending" });
    }
    const attempt = (attemptRaw ?? {}) as ProviderAttempt;
    if (!attempt.call_provider) {
      if (attempt.status === "submitted" || attempt.status === "paid") {
        return NextResponse.json({
          success: true,
          duplicate: true,
          status: attempt.status === "paid" ? "paid" : "already_submitted",
          withdrawalId: attempt.provider_withdrawal_id,
          referenceId: attempt.provider_reference_id,
        });
      }
      return NextResponse.json({ success: true, status: "pending", error: "pending" });
    }

    let withdrawal;
    try {
      withdrawal = await createPaydoraWithdrawal({
        paymentMethodId: method.id,
        amount,
        userName: user.id,
        address: address || undefined,
        chimePhoneEmail: chimePhoneEmail || undefined,
        cardNumber: body.cardNumber ? String(body.cardNumber) : undefined,
        cardValid: body.cardValid ? String(body.cardValid) : undefined,
        idempotencyKey,
      });
    } catch (err) {
      const status = (err as { status?: number }).status;
      const message = err instanceof Error ? err.message : "";
      const outcome = classifyProviderFailure(status, message);
      if (outcome !== "rejected") {
        if (outcome === "duplicate") {
          await admin.rpc("record_paydora_payout_submitted", {
            p_user_id: user.id,
            p_idempotency_key: idempotencyKey,
            p_withdrawal_id: null,
            p_reference_id: null,
            p_provider_status: "submitted",
          });
        }
        return NextResponse.json({
          success: true,
          status: outcome === "duplicate" ? "already_submitted" : "pending",
          error: outcome === "duplicate" ? "already submitted" : "pending",
        });
      }
      await admin.rpc("fail_paydora_payout", {
        p_user_id: user.id,
        p_idempotency_key: idempotencyKey,
      });
      throw err;
    }

    await admin.rpc("record_paydora_payout_submitted", {
      p_user_id: user.id,
      p_idempotency_key: idempotencyKey,
      p_withdrawal_id: withdrawal.id,
      p_reference_id: withdrawal.referenceId,
      p_provider_status: withdrawal.status,
    });

    return NextResponse.json({
      success: true,
      withdrawalId: withdrawal.id,
      referenceId: withdrawal.referenceId,
      status: withdrawal.status,
      amount: withdrawal.amount,
    });
  } catch (err) {
    const status = (err as { status?: number }).status || 500;
    return NextResponse.json(
      { error: playerPaymentError(err) },
      { status: status >= 400 && status < 600 ? status : 500 }
    );
  }
}
