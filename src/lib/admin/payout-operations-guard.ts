import type { AdminListDecision } from "@/lib/admin/list-scope";

export const PAYOUT_STATUSES = ["requested", "reserved", "submitted", "paid", "failed", "manual_review"] as const;

/** Sentences written by the Paydora payout route. Anything else stays hidden. */
export const APPROVED_HOLD_NOTES = [
  "Risk review",
  "Above the automatic cash-out limit",
  "Automatic cash out is off until a limit is set",
] as const;

/** Paydora checkout method keys from the payment client. */
export const SAFE_PAYOUT_METHODS = ["card", "chime", "cashapp", "googlepay", "applepay"] as const;

/** Provider status values this app writes or compares. */
export const SAFE_PROVIDER_STATUSES = ["submitted", "paid"] as const;

/**
 * Provider reference and withdrawal id have no confirmed-safe format in this app.
 * The allowlist stays empty, so those values are never rendered.
 */
export const SAFE_PROVIDER_REFERENCES: readonly string[] = [];

export const NETWORK_LOOKUP_ERROR =
  "The player list for this network could not be loaded. No payout records were opened.";

export type ShownField = { state: "empty" } | { state: "hidden" } | { state: "visible"; value: string };

export type PayoutQueryPlan =
  | { action: "deny" }
  | { action: "error"; message: string }
  | { action: "empty" }
  | { action: "query"; scope: { mode: "all" } | { mode: "network"; userIds: string[] } };

const METHOD_LABELS: Record<(typeof SAFE_PAYOUT_METHODS)[number], string> = {
  card: "Card",
  chime: "Chime",
  cashapp: "Cash App",
  googlepay: "Google Pay",
  applepay: "Apple Pay",
};

const PROVIDER_STATUS_LABELS: Record<(typeof SAFE_PROVIDER_STATUSES)[number], string> = {
  submitted: "Submitted",
  paid: "Paid",
};

export function payoutStatusHelp(status: string) {
  switch (status) {
    case "requested":
      return "The request is saved. A provider payment is not confirmed.";
    case "reserved":
      return "The request is reserved. A provider payment is not confirmed.";
    case "submitted":
      return "Sent to the provider. Submitted does not mean paid. The final outcome is not confirmed yet.";
    case "paid":
      return "The provider payment is confirmed.";
    case "manual_review":
      return "Manual review requires investigation before any further money action.";
    case "failed":
      return "The system recorded a failure. Failed does not mean refunded, and a failed status does not by itself show that a refund was posted.";
    default:
      return "Stored status on the payout record.";
  }
}

export function showExact(value: string | null | undefined, allow: readonly string[]): ShownField {
  const text = value?.trim() ?? "";
  if (!text) return { state: "empty" };
  return allow.includes(text) ? { state: "visible", value: text } : { state: "hidden" };
}

export function showToken(value: string | null | undefined, allow: readonly string[]): ShownField {
  const text = value?.trim().toLowerCase() ?? "";
  if (!text) return { state: "empty" };
  const match = allow.find((item) => item === text);
  return match ? { state: "visible", value: match } : { state: "hidden" };
}

export function showHoldNote(value: string | null | undefined): ShownField {
  return showExact(value, APPROVED_HOLD_NOTES);
}

export function showPayoutStatus(value: string | null | undefined): ShownField {
  return showToken(value, PAYOUT_STATUSES);
}

export function showPayoutMethod(value: string | null | undefined): ShownField {
  const shown = showToken(value, SAFE_PAYOUT_METHODS);
  if (shown.state !== "visible") return shown;
  return { state: "visible", value: METHOD_LABELS[shown.value as (typeof SAFE_PAYOUT_METHODS)[number]] };
}

export function showProviderStatus(value: string | null | undefined): ShownField {
  const shown = showToken(value, SAFE_PROVIDER_STATUSES);
  if (shown.state !== "visible") return shown;
  return { state: "visible", value: PROVIDER_STATUS_LABELS[shown.value as (typeof SAFE_PROVIDER_STATUSES)[number]] };
}

export function showProviderReference(value: string | null | undefined): ShownField {
  return showExact(value, SAFE_PROVIDER_REFERENCES);
}

export function shownText(field: ShownField, emptyLabel: string) {
  if (field.state === "visible") return field.value;
  if (field.state === "hidden") return "Not shown";
  return emptyLabel;
}

/**
 * Decides whether a payout table read is allowed.
 * A network lookup failure and an empty network never become an unrestricted read.
 * Platform access ignores a network lookup so it keeps the existing full list.
 */
export function planPayoutQuery(input: {
  decision: AdminListDecision;
  networkLookup: { ok: true; userIds: string[] } | { ok: false } | null;
}): PayoutQueryPlan {
  if (input.decision.mode === "deny") return { action: "deny" };
  if (input.decision.mode === "all") return { action: "query", scope: { mode: "all" } };
  if (!input.networkLookup) return { action: "error", message: NETWORK_LOOKUP_ERROR };
  if (!input.networkLookup.ok) return { action: "error", message: NETWORK_LOOKUP_ERROR };
  if (input.networkLookup.userIds.length === 0) return { action: "empty" };
  return { action: "query", scope: { mode: "network", userIds: [...input.networkLookup.userIds] } };
}
