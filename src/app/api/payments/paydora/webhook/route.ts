import { NextResponse } from "next/server";
import {
  isPaidDepositStatus,
  verifyPaydoraSignature,
  type PaydoraWebhookEnvelope,
} from "@/lib/payments/paydora";
import { creditPaydoraDeposit, reversePaydoraDeposit } from "@/lib/payments/paydora-wallet";

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
        await creditPaydoraDeposit({
          userId,
          amount,
          depositId: payload.data.depositId,
          referenceId: payload.data.referenceId,
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
