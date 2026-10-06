import crypto from "crypto";

const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY || "";
const NOWPAYMENTS_IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET || "";
const NOWPAYMENTS_BASE_URL = "https://api.nowpayments.io/v1";

export interface CreatePaymentParams {
  amount: number;
  currency?: string;
  payCurrency?: string;
  orderId: string;
  orderDescription: string;
  ipnCallbackUrl?: string;
  successUrl?: string;
  cancelUrl?: string;
}

export async function createNowPaymentInvoice(params: CreatePaymentParams) {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;

  if (!apiKey) {
    return { success: false, error: "Crypto deposits are not configured yet." };
  }

  try {
    const res = await fetch(`${NOWPAYMENTS_BASE_URL}/invoice`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        price_amount: params.amount,
        price_currency: params.currency || "usd",
        pay_currency: params.payCurrency || "usdttrc20",
        order_id: params.orderId,
        order_description: params.orderDescription,
        ipn_callback_url: params.ipnCallbackUrl,
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.invoice_url) {
      return { success: false, error: data.message || data.error || "Could not start the crypto payment." };
    }
    return {
      success: true,
      payment_id: data.id || data.payment_id,
      invoice_url: data.invoice_url,
      pay_address: data.pay_address,
      pay_amount: data.pay_amount,
      pay_currency: data.pay_currency,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

export function verifyNowPaymentsSignature(rawBody: string, signatureHeader: string): boolean {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET?.trim();
  if (!secret || !signatureHeader) return false;

  try {
    const hmac = crypto.createHmac("sha512", secret);
    hmac.update(rawBody);
    const calculated = hmac.digest("hex");
    return calculated === signatureHeader;
  } catch {
    return false;
  }
}
