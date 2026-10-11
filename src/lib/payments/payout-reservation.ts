import crypto from "crypto";

export type PayoutStatus = "requested" | "reserved" | "submitted" | "paid" | "failed" | "manual_review";

const OPEN_STATUSES = new Set<PayoutStatus>(["requested", "reserved", "submitted", "manual_review"]);

export function payoutAmount(value: number) {
  return Math.round(value * 100) / 100;
}

/** Stable provider identity for one cash-out. The raw card number is not stored. */
export function payoutDestinationKey(input: {
  method: string;
  amount: number;
  address: string;
  chimePhoneEmail: string;
  cardNumber: string;
  cardValid: string;
}) {
  const material = [
    input.method.trim().toLowerCase(),
    payoutAmount(input.amount).toFixed(2),
    input.address.trim().toLowerCase(),
    input.chimePhoneEmail.trim().toLowerCase(),
    input.cardNumber.trim(),
    input.cardValid.trim(),
  ].join("\n");
  return crypto.createHash("sha256").update(material).digest("hex");
}

/**
 * Matches the payout route's provider classification.
 * A timeout, 408, 429, 5xx, or any response that is not an explicit 4xx rejection stays ambiguous.
 */
export function classifyProviderFailure(
  status: number | undefined,
  message: string
): "duplicate" | "ambiguous" | "rejected" {
  const text = message.toLowerCase();
  const duplicate = status === 409 || /duplicate|already/.test(text);
  const explicitReject =
    typeof status === "number" &&
    status >= 400 &&
    status < 500 &&
    status !== 408 &&
    status !== 409 &&
    status !== 429 &&
    !/duplicate|already|timeout|timed out/.test(text);
  if (explicitReject) return "rejected";
  if (duplicate) return "duplicate";
  return "ambiguous";
}

type LedgerRow = {
  userId: string;
  amount: number;
  method: string;
  destinationKey: string;
  idempotencyKey: string;
  status: PayoutStatus;
  providerAttemptAt: number | null;
  withdrawalId: string | null;
};

export type ReserveResult = {
  reused: boolean;
  debited: boolean;
  promoted: boolean;
  idempotencyKey: string;
  status: PayoutStatus;
  amount: number;
};

/**
 * In-memory stand-in for reserve_paydora_payout / fail_paydora_payout.
 * Concurrent callers share one lock per cash-out fingerprint, the same rule as the advisory lock.
 */
export function createPayoutLedger(openingBalances: Record<string, number>) {
  const balances = new Map<string, number>(
    Object.entries(openingBalances).map(([userId, amount]) => [userId, payoutAmount(amount)])
  );
  const rows: LedgerRow[] = [];
  const debitedKeys = new Set<string>();
  const voidKeys = new Set<string>();
  const locks = new Map<string, Promise<void>>();
  let now = 0;
  let sequence = 0;

  function fingerprint(input: { userId: string; amount: number; method: string; destinationKey: string }) {
    return `${input.userId}|${payoutAmount(input.amount).toFixed(2)}|${input.method}|${input.destinationKey}`;
  }

  function withLock<T>(key: string, fn: () => T): Promise<T> {
    const prev = locks.get(key) ?? Promise.resolve();
    const run = prev.catch(() => undefined).then(fn);
    locks.set(
      key,
      run.then(
        () => undefined,
        () => undefined
      )
    );
    return run;
  }

  function debit(userId: string, amount: number, key: string) {
    if (debitedKeys.has(key)) return false;
    const balance = balances.get(userId) ?? 0;
    if (balance < amount) throw new Error("insufficient funds");
    balances.set(userId, payoutAmount(balance - amount));
    debitedKeys.add(key);
    return true;
  }

  function reserveSync(input: {
    userId: string;
    amount: number;
    method: string;
    destinationKey: string;
    hold: boolean;
  }): ReserveResult {
    const amount = payoutAmount(input.amount);
    const open = rows.find(
      (row) =>
        row.userId === input.userId &&
        row.amount === amount &&
        row.method === input.method &&
        row.destinationKey === input.destinationKey &&
        OPEN_STATUSES.has(row.status)
    );
    if (open && open.status === "manual_review" && !input.hold) {
      debit(open.userId, open.amount, open.idempotencyKey);
      open.status = "reserved";
      return {
        reused: true,
        debited: true,
        promoted: true,
        idempotencyKey: open.idempotencyKey,
        status: "reserved",
        amount: open.amount,
      };
    }
    if (open && open.status === "requested") {
      debit(open.userId, open.amount, open.idempotencyKey);
      open.status = "reserved";
      return {
        reused: true,
        debited: true,
        promoted: false,
        idempotencyKey: open.idempotencyKey,
        status: "reserved",
        amount: open.amount,
      };
    }
    if (open) {
      return {
        reused: true,
        debited: false,
        promoted: false,
        idempotencyKey: open.idempotencyKey,
        status: open.status,
        amount: open.amount,
      };
    }

    const balance = balances.get(input.userId) ?? 0;
    if (balance < amount) throw new Error("insufficient funds");
    const idempotencyKey = `wd_${++sequence}`;
    if (input.hold) {
      rows.push({
        userId: input.userId,
        amount,
        method: input.method,
        destinationKey: input.destinationKey,
        idempotencyKey,
        status: "manual_review",
        providerAttemptAt: null,
        withdrawalId: null,
      });
      return { reused: false, debited: false, promoted: false, idempotencyKey, status: "manual_review", amount };
    }

    debit(input.userId, amount, idempotencyKey);
    rows.push({
      userId: input.userId,
      amount,
      method: input.method,
      destinationKey: input.destinationKey,
      idempotencyKey,
      status: "reserved",
      providerAttemptAt: null,
      withdrawalId: null,
    });
    return { reused: false, debited: true, promoted: false, idempotencyKey, status: "reserved", amount };
  }

  return {
    balance(userId: string) {
      return balances.get(userId) ?? 0;
    },
    advance(ms: number) {
      now += ms;
    },
    row(idempotencyKey: string) {
      return rows.find((row) => row.idempotencyKey === idempotencyKey) ?? null;
    },
    reserve(input: {
      userId: string;
      amount: number;
      method: string;
      destinationKey: string;
      hold: boolean;
    }) {
      return withLock(fingerprint(input), () => reserveSync(input));
    },
    beginAttempt(userId: string, idempotencyKey: string) {
      return withLock(idempotencyKey, () => {
        const row = rows.find((item) => item.userId === userId && item.idempotencyKey === idempotencyKey);
        if (!row) throw new Error("payout not found");
        if (row.status === "submitted" || row.status === "paid" || row.status === "manual_review" || row.status === "failed") {
          return { callProvider: false, inProgress: false, status: row.status, idempotencyKey };
        }
        if (row.status !== "reserved") {
          return { callProvider: false, inProgress: false, status: row.status, idempotencyKey };
        }
        if (row.providerAttemptAt != null && row.providerAttemptAt > now - 120_000) {
          return { callProvider: false, inProgress: true, status: "reserved" as const, idempotencyKey };
        }
        row.providerAttemptAt = now;
        return { callProvider: true, inProgress: false, status: "reserved" as const, idempotencyKey };
      });
    },
    applyProviderResult(
      userId: string,
      idempotencyKey: string,
      outcome: "rejected" | "ambiguous" | "duplicate" | "accepted",
      providerStatus?: string
    ) {
      return withLock(idempotencyKey, () => {
        const row = rows.find((item) => item.userId === userId && item.idempotencyKey === idempotencyKey);
        if (!row) throw new Error("payout not found");
        if (outcome === "ambiguous") {
          return { status: row.status, refunded: false, duplicate: false };
        }
        if (outcome === "duplicate" || outcome === "accepted") {
          if (row.status === "reserved" || row.status === "submitted") {
            row.status = providerStatus?.trim().toLowerCase() === "paid" ? "paid" : "submitted";
          }
          return { status: row.status, refunded: false, duplicate: false };
        }
        if (row.status === "failed") return { status: "failed" as const, refunded: false, duplicate: true };
        if (row.status !== "reserved") return { status: row.status, refunded: false, duplicate: false };
        const voidKey = `payout-void:${row.idempotencyKey}`;
        if (!voidKeys.has(voidKey)) {
          voidKeys.add(voidKey);
          balances.set(userId, payoutAmount((balances.get(userId) ?? 0) + row.amount));
          row.status = "failed";
          return { status: "failed" as const, refunded: true, duplicate: false };
        }
        row.status = "failed";
        return { status: "failed" as const, refunded: false, duplicate: true };
      });
    },
  };
}
