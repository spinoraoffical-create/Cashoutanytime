import { NextResponse } from "next/server";
import { createPaydoraWithdrawal, getPaydoraPaymentMethods } from "@/lib/payments/paydora";
import { creditPaydoraDeposit } from "@/lib/payments/paydora-wallet";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
      return NextResponse.json({ error: rateLimitUserMessage(limited) }, { status: 429 });
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("wallet_balance, kyc_status")
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

    const day = new Date().toISOString().slice(0, 10);
    const idempotencyKey =
      String(body.idempotencyKey || "").trim() ||
      `wd_${user.id}_${methodValue}_${amount.toFixed(2)}_${address || chimePhoneEmail}_${day}`;

    const adminForRules = createAdminClient();
    if (!adminForRules) return NextResponse.json({ error: "Payouts are temporarily unavailable." }, { status: 503 });
    const { data: ops, error: opsError } = await adminForRules.from("platform_ops").select("cashout_auto_limit").eq("key", "cashout").maybeSingle();
    const rulesReady = !opsError && ops;
    const autoLimit = Number((ops as { cashout_auto_limit?: number } | null)?.cashout_auto_limit ?? 0);
    const { data: fraud } = await adminForRules
      .from("fraud_scores")
      .select("user_id, blocked, manual_review, risk_score")
      .eq("user_id", user.id)
      .maybeSingle();
    const risk = fraud as { blocked?: boolean; manual_review?: boolean; risk_score?: number } | null;
    const flagged = Boolean(risk && (risk.blocked || risk.manual_review || Number(risk.risk_score ?? 0) >= 50));
    if (rulesReady && (autoLimit <= 0 || amount > autoLimit || flagged)) {
      await adminForRules.from("cashout_holds").upsert(
        {
          payout_key: idempotencyKey,
          user_id: user.id,
          amount,
          reason: flagged ? "Risk review" : amount > autoLimit && autoLimit > 0 ? "Above the automatic cash-out limit" : "Automatic cash out is off until a limit is set",
          status: "held",
        },
        { onConflict: "payout_key", ignoreDuplicates: true }
      );
      return NextResponse.json({
        held: true,
        error: "This cash out is waiting for a Super Admin. Your wallet was not charged.",
      }, { status: 202 });
    }
    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: "Payouts are temporarily unavailable." }, { status: 503 });

    const { data: debit, error: debitError } = await admin.rpc("debit_paydora_payout", {
      p_user_id: user.id,
      p_amount: amount,
      p_payout_key: idempotencyKey,
    });
    if (debitError) {
      const message = /insufficient/i.test(debitError.message)
        ? `Insufficient wallet balance ($${currentBalance.toFixed(2)})`
        : "Could not reserve that payout. Try again.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const debitRow = (debit ?? {}) as { debited?: boolean; duplicate?: boolean };
    if (debitRow.duplicate) {
      return NextResponse.json({ success: true, duplicate: true, status: "already_submitted" });
    }
    if (!debitRow.debited) {
      return NextResponse.json({ error: "Could not reserve that payout. Try again." }, { status: 400 });
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
      await creditPaydoraDeposit({
        userId: user.id,
        amount,
        depositId: `payout-void:${idempotencyKey}`,
        methodName: "Payout refund",
      });
      throw err;
    }

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
