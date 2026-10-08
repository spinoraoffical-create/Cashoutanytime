export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

/** credit = paid + paid * percent / 100, rounded to cents. */
export function bonusForPercent(paid: number, percent: number) {
  const base = roundMoney(paid);
  const bonus = Math.round(base * percent) / 100;
  return {
    base,
    percent,
    bonus,
    finalCredit: roundMoney(base + bonus),
  };
}

export function depositKind(priorCreditedCount: number): "first" | "reload" {
  return priorCreditedCount === 0 ? "first" : "reload";
}

export type CreditLedger = {
  balance: number;
  credits: Map<string, number>;
  refunds: Set<string>;
};

/** One wallet credit per payment id. A replay returns the same balance. */
export function creditOnce(ledger: CreditLedger, paymentId: string, finalCredit: number) {
  const existing = ledger.credits.get(paymentId);
  if (existing != null) return { balance: ledger.balance, duplicate: true, finalCredit: existing };
  ledger.credits.set(paymentId, finalCredit);
  ledger.balance = roundMoney(ledger.balance + finalCredit);
  return { balance: ledger.balance, duplicate: false, finalCredit };
}

/** Refund removes the credited final amount, not the paid amount. */
export function refundFinalCredit(ledger: CreditLedger, paymentId: string) {
  const key = `refund:${paymentId}`;
  if (ledger.refunds.has(key)) return { balance: ledger.balance, duplicate: true, removed: 0 };
  const finalCredit = ledger.credits.get(paymentId);
  if (finalCredit == null) throw new Error("Bonus ledger final credit is missing");
  ledger.refunds.add(key);
  ledger.balance = roundMoney(ledger.balance - finalCredit);
  return { balance: ledger.balance, duplicate: false, removed: finalCredit };
}

export function playerVisibleTo(parentIds: readonly string[], parentAgentId: string | null) {
  return Boolean(parentAgentId && parentIds.includes(parentAgentId));
}
