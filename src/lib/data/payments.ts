import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  DEPOSIT_PAYMENT_METHODS,
  type DepositPaymentMethod,
} from "@/lib/payments/methods";

/** Prefer DB payment methods; fall back to code/env constants. */
export async function getActivePaymentMethods(): Promise<DepositPaymentMethod[]> {
  try {
    const supabase = await createClient();
    if (!supabase) return DEPOSIT_PAYMENT_METHODS;

    const { data, error } = await supabase
      .from("payment_methods")
      .select("key, label, handle, handle_label, pay_link, qr_image_url, sort_order")
      .eq("is_active", true)
      .order("sort_order");

    if (error || !data?.length) return DEPOSIT_PAYMENT_METHODS;

    const accents = DEPOSIT_PAYMENT_METHODS.reduce(
      (acc, m) => {
        acc[m.id] = m.accent;
        return acc;
      },
      {} as Record<string, string>
    );

    return data.map((row) => ({
      id: row.key as DepositPaymentMethod["id"],
      label: row.label,
      username: row.handle || "—",
      copyLabel: row.handle_label || row.label,
      payLink: row.pay_link || undefined,
      qrImage: row.qr_image_url || "/payments/cashapp-qr.png",
      accent: accents[row.key] ?? "from-violet-500/20 to-fuchsia-600/10 border-violet-500/30",
    }));
  } catch {
    return DEPOSIT_PAYMENT_METHODS;
  }
}
