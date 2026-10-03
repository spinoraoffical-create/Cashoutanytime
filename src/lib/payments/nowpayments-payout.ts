const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY || "";
const NOWPAYMENTS_BASE_URL = "https://api.nowpayments.io/v1";

export interface PayoutRecipient {
  address: string;
  amount: number;
  currency: string; // e.g. "btc", "usdttrc20"
  extra_id?: string;
}

export async function createNowPaymentsPayout(recipients: PayoutRecipient[]) {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;

  if (!apiKey) {
    return {
      success: true,
      payout_id: `payout_mock_${Date.now()}`,
      status: "processing",
      message: "Mock payout triggered (Set NOWPAYMENTS_API_KEY for live crypto payout)",
    };
  }

  try {
    // 1. Authenticate payout JWT token
    const authRes = await fetch(`${NOWPAYMENTS_BASE_URL}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: process.env.NOWPAYMENTS_EMAIL || "admin@spinora.vip",
        password: process.env.NOWPAYMENTS_PASSWORD || "",
      }),
    });

    const authData = await authRes.json();
    const token = authData.token;

    // 2. Trigger Mass Payout API
    const res = await fetch(`${NOWPAYMENTS_BASE_URL}/payout`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        withdrawals: recipients.map((r) => ({
          address: r.address,
          amount: r.amount,
          currency: r.currency,
          ipn_callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/nowpayments/payout-webhook`,
        })),
      }),
    });

    const data = await res.json();
    return { success: true, payout_id: data.id, withdrawals: data.withdrawals };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}
