import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { enqueueAlert, recordCashoutInvestigation, recordLegacyOutcome } from "@/lib/telegram/control/delivery";
import { cashoutAlertPlan, fallbackAfterEnqueue, legacyOutcomeFromSend, type AlertCategory, type LegacyOutcome } from "@/lib/telegram/control/rules";

/** Returns handled when a delivery job owns the event. Callers then skip the old sender. */
export async function safePaymentAlert(input: {
  category: AlertCategory;
  eventKey: string;
  source: "provider" | "ledger" | "admin";
  reference: string;
  amount?: number | null;
  detail?: string | null;
  adminPath?: string | null;
}): Promise<{ disposition: "handled" | "legacy"; eventKey: string }> {
  const eventKey = input.eventKey.trim().slice(0, 160);
  try {
    const result = await enqueueAlert(input);
    return { disposition: fallbackAfterEnqueue(result), eventKey };
  } catch {
    return { disposition: "legacy", eventKey };
  }
}

export async function noteLegacySend(
  eventKey: string,
  input: { configured: boolean; ok: boolean | null; thrown: boolean }
): Promise<LegacyOutcome> {
  const outcome = legacyOutcomeFromSend(input);
  try {
    await recordLegacyOutcome(eventKey, outcome);
  } catch {
    /* The job stays attempt_started, which is not promoted. */
  }
  return outcome;
}

/** The payout RPC does not return a ledger id. Do not search recent wallet rows. */
export async function investigateRecordedCashout(
  db: SupabaseClient,
  amount: number
): Promise<{ eventKey: string } | null> {
  if (cashoutAlertPlan(null).kind !== "investigate") return null;
  try {
    return await recordCashoutInvestigation(db, amount);
  } catch {
    return null;
  }
}
