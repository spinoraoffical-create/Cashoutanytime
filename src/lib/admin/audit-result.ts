/** Shown when the change is already saved and the audit row was not. */
export const AUDIT_SAVED_WARNING =
  "Saved, but not written to the audit log. The change was not undone.";

export function partialAuditResult(audited: boolean): { auditWarning?: string } {
  if (audited) return {};
  return { auditWarning: AUDIT_SAVED_WARNING };
}

/** Safe log text for a missed audit row. No amounts or account identifiers. */
export function missedAuditMessage(action: string): string {
  const safe = /^[a-z0-9._-]{1,40}$/i.test(action) ? action : "audit";
  return `${safe} audit row was not saved`;
}

/** Operator text for admin_payout_cashout. The RPC itself is unchanged. */
export function payoutOperatorMessage(databaseMessage: string): string {
  if (/insufficient/i.test(databaseMessage)) {
    return "The cash-out balance is too low for that amount.";
  }
  return "The cash-out could not be recorded.";
}
