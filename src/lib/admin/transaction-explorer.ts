const USER_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ExplorerQuery =
  | { kind: "empty" }
  | { kind: "uuid"; id: string }
  | { kind: "text"; text: string };

export type TraceGroup = "wallet" | "request" | "provider" | "payout";

export type TraceEvent = {
  at: string;
  group: TraceGroup;
  title: string;
  detail: string;
  evidence: string;
  verified: boolean;
};

/** Search text only. A UUID can be a player, transaction, deposit, load, or payout id. */
export function parseExplorerQuery(raw: string | null | undefined): ExplorerQuery {
  const text = raw?.trim() ?? "";
  if (!text) return { kind: "empty" };
  if (USER_ID.test(text)) return { kind: "uuid", id: text };
  const safe = text.slice(0, 80).replace(/[^a-zA-Z0-9 @._+-]/g, "");
  if (!safe) return { kind: "empty" };
  return { kind: "text", text: safe };
}

export function sortTrace(events: TraceEvent[]): TraceEvent[] {
  return [...events].sort((a, b) => a.at.localeCompare(b.at));
}

/** Wallet rows are listed. They are not added to requests or provider updates. */
export function walletMovementCount(events: TraceEvent[]): number {
  return events.filter((event) => event.group === "wallet").length;
}
