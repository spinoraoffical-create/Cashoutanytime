import { NextResponse } from "next/server";
import {
  isPaidDepositStatus,
  verifyPaydoraSignature,
  type PaydoraWebhookEnvelope,
} from "@/lib/payments/paydora";
import { creditPaydoraDeposit, reversePaydoraDeposit } from "@/lib/payments/paydora-wallet";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    const userId = String(payload.data?.userName || "").trim();
    const amount = Number(payload.data?.paidAmount ?? payload.data?.amount ?? 0);
    const depositId = payload.data?.depositId;

    if (payload.event === "deposit.paid" && depositId && UUID_RE.test(userId) && amount > 0) {
      const status = payload.data?.status || "paid";
      if (!isPaidDepositStatus(status)) {
        return new NextResponse("IGNORED", { status: 200 });
      }
      await creditPaydoraDeposit({
        userId,
        amount,
        depositId,
        referenceId: payload.data?.referenceId,
      });
    }

    if (
      payload.event === "deposit.refunded" &&
      depositId &&
      UUID_RE.test(userId) &&
      amount > 0
    ) {
      await reversePaydoraDeposit({
        userId,
        amount,
        depositId,
      });
    }
  } catch (err) {
    console.error("[paydora/webhook]", err);
    return new NextResponse("RETRY", { status: 500 });
  }

  return new NextResponse("OK", { status: 200 });
}
