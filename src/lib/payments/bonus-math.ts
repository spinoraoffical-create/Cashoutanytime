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

export type DepositKind = "first" | "reload";

export type StoredGameBonus = {
  firstDepositBonusPercent: number | null;
  reloadBonusPercent: number | null;
  maxBonusAmount?: number | null;
  minDeposit?: number | null;
  bonusEnabled?: boolean | null;
  startsAt?: string | null;
  endsAt?: string | null;
};

/** Dates are optional. A blank date does not turn the bonus off. */
export function offerIsLive(
  offer: Pick<StoredGameBonus, "startsAt" | "endsAt">,
  now = Date.now(),
): boolean {
  const start = offer.startsAt ? Date.parse(offer.startsAt) : Number.NaN;
  const end = offer.endsAt ? Date.parse(offer.endsAt) : Number.NaN;
  if (Number.isFinite(start) && start > now) return false;
  if (Number.isFinite(end) && end <= now) return false;
  return true;
}

/** Same percent the deposit credit uses. A missing number cannot be priced. */
export function quoteBonus(input: StoredGameBonus & { paid: number; kind: DepositKind }) {
  const belowMin =
    input.minDeposit != null &&
    Number.isFinite(Number(input.minDeposit)) &&
    roundMoney(input.paid) < Number(input.minDeposit);
  if (input.bonusEnabled === false || !offerIsLive(input) || belowMin) {
    const base = roundMoney(input.paid);
    return { base, percent: 0, bonus: 0, finalCredit: base };
  }
  const raw = input.kind === "first" ? input.firstDepositBonusPercent : input.reloadBonusPercent;
  if (raw == null) return null;
  const percent = Number(raw);
  if (!Number.isFinite(percent)) return null;
  const priced = bonusForPercent(input.paid, percent);
  if (input.maxBonusAmount == null || !Number.isFinite(Number(input.maxBonusAmount))) return priced;
  const bonus = roundMoney(Math.min(priced.bonus, Math.max(0, Number(input.maxBonusAmount))));
  return { ...priced, bonus, finalCredit: roundMoney(priced.base + bonus) };
}

export function formatBonusPercent(value: number | null | undefined): string | null {
  if (value == null) return null;
  const percent = Number(value);
  if (!Number.isFinite(percent)) return null;
  return Number.isInteger(percent) ? String(percent) : String(Math.round(percent * 100) / 100);
}

/** Card badge. Hidden when the saved first-deposit offer is off or zero. */
export function firstDepositBadge(percent: number | null | undefined, enabled: boolean | null = true): string | null {
  if (enabled === false) return null;
  const label = formatBonusPercent(percent);
  if (label == null || Number(label) <= 0) return null;
  return `${label}% First Deposit Bonus`;
}

export function bonusDetailLines(offer: StoredGameBonus): string[] {
  if (offer.bonusEnabled === false) return ["This game's deposit bonus is turned off."];
  const first = formatBonusPercent(offer.firstDepositBonusPercent);
  const later = formatBonusPercent(offer.reloadBonusPercent);
  if (first == null && later == null) return [];
  const lines = [
    `First deposit bonus ${first ?? "0"}%. Later deposits ${later ?? "0"}%.`,
  ];
  if (offer.minDeposit != null && Number.isFinite(Number(offer.minDeposit))) {
    lines.push(`Minimum deposit for this bonus $${roundMoney(Number(offer.minDeposit)).toFixed(2)}.`);
  }
  if (offer.maxBonusAmount != null && Number.isFinite(Number(offer.maxBonusAmount))) {
    lines.push(`Maximum bonus credit $${roundMoney(Number(offer.maxBonusAmount)).toFixed(2)}.`);
  }
  if (offer.endsAt) lines.push(`This offer ends ${offer.endsAt}.`);
  return lines;
}
