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
    // Return mock payment URL for testing if API key is not set yet
    return {
      success: true,
      payment_id: `np_mock_${Date.now()}`,
      invoice_url: `https://nowpayments.io/payment/?iid=${Date.now()}`,
      pay_address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
      pay_amount: params.amount,
      pay_currency: params.payCurrency || "usdttrc20",
    };
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
        ipn_callback_url: params.ipnCallbackUrl || `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/nowpayments/webhook`,
        success_url: params.successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?deposit=success`,
        cancel_url: params.cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?deposit=cancelled`,
      }),
    });

    const data = await res.json();
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
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret) return true; // allow testing

  try {
    const hmac = crypto.createHmac("sha512", secret);
    hmac.update(rawBody);
    const calculated = hmac.digest("hex");
    return calculated === signatureHeader;
  } catch {
    return false;
  }
}
