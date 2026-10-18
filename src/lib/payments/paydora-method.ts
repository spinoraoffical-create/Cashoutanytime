const EXACT = new Set([
  "paypal",
  "chime",
  "cashapp",
  "bitcoin",
  "usdt",
  "venmo",
  "card",
  "googlepay",
  "applepay",
]);

/** Known checkout labels only. An unrecognized method stays unrecognized. */
export function mapPaydoraMethod(value?: string | null): string | null {
  const compact = (value || "").trim().toLowerCase().replace(/[\s_-]/g, "");
  if (!compact) return null;
  if (EXACT.has(compact)) return compact;
  if (compact.includes("chime")) return "chime";
  if (compact.includes("googlepay")) return "googlepay";
  if (compact.includes("applepay")) return "applepay";
  if (compact.includes("card")) return "card";
  if (compact.includes("cashapp") || compact.includes("cash")) return "cashapp";
  if (compact.includes("venmo")) return "venmo";
  if (compact.includes("paypal")) return "paypal";
  if (compact.includes("bitcoin") || compact === "btc" || compact.includes("btc")) return "bitcoin";
  if (compact.includes("usdt") || compact.includes("tether")) return "usdt";
  return null;
}
