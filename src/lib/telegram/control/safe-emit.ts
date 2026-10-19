import "server-only";

import { enqueueAlert } from "@/lib/telegram/control/delivery";
import type { AlertCategory } from "@/lib/telegram/control/rules";

/** Returns handled when the new bot queue accepted the event. Callers then skip the old sender. */
export async function safePaymentAlert(input: {
  category: AlertCategory;
  eventKey: string;
  source: "provider" | "ledger" | "admin";
  reference: string;
  amount?: number | null;
  detail?: string | null;
  adminPath?: string | null;
}): Promise<"handled" | "legacy"> {
  try {
    const result = await enqueueAlert(input);
    if (result.reason === "queued" || result.reason === "duplicate") return "handled";
    return "legacy";
  } catch {
    return "legacy";
  }
}
