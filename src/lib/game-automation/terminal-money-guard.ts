/**
 * The in-memory transfer guard is retired.
 * Money calls use the durable ledger in transfer-ledger.ts.
 * These functions throw so a restart cannot silently send a second transfer.
 */
export function beginMoneyAttempt(): never {
  throw new Error("The in-memory transfer guard is disabled. Use the durable transfer ledger.");
}

export function finishMoneyAttempt(): never {
  throw new Error("The in-memory transfer guard is disabled. Use the durable transfer ledger.");
}

export function moneyAttemptError(): never {
  throw new Error("The in-memory transfer guard is disabled. Use the durable transfer ledger.");
}
