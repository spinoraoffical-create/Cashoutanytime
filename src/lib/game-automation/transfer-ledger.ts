/** Durable transfer claims. No wallet writes and no provider calls. */

export const TRANSFER_PROVIDERS = ["fire-kirin", "milky-way", "orion-stars"] as const;
export type TransferProvider = (typeof TRANSFER_PROVIDERS)[number];
export type TransferAction = "recharge" | "redeem";
export type TransferState = "pending" | "submitted" | "confirmed" | "failed" | "unknown" | "manual_review";
export type ClaimDecision = "proceed" | "hold" | "already_recorded" | "paused";

export type Reservation = {
  amount: number;
  action: TransferAction;
  open: boolean;
};

export type ClaimInput = {
  operationKey: string;
  provider: TransferProvider;
  action: TransferAction;
  amount: number;
  requestId: string;
  playerAccount: string;
  providerTransactionId?: string | null;
  providerIdempotent: boolean;
};

export type ClaimResult = { decision: ClaimDecision; state: TransferState | "paused" | null };

export type TransferCounts = {
  installed: boolean;
  pending: number | null;
  submitted: number | null;
  unknown: number | null;
  manualReview: number | null;
};

const SECRET_KEY = /sign|passwd|password|agentkey|authorization|cookie|token|secret/i;

export function redactProviderMeta(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const clean: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY.test(key)) continue;
    if (item && typeof item === "object" && !Array.isArray(item)) {
      clean[key] = redactProviderMeta(item);
    } else {
      clean[key] = item;
    }
  }
  return clean;
}

export function transferBlockedError(decision: Exclude<ClaimDecision, "proceed">): Error {
  if (decision === "paused") return new Error("This provider is paused. The transfer was not sent.");
  if (decision === "already_recorded") return new Error("This transfer request was already sent.");
  return new Error("Provider outcome unknown. This transfer was not sent again.");
}

export function isProviderTransferUnknown(message: string): boolean {
  return /timed out|timeout|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|socket hang up|network|aborted|unreachable|empty response|invalid JSON|bad gateway|fetch failed|outcome unknown/i.test(
    message
  );
}

type Row = {
  state: TransferState;
  provider: TransferProvider;
  action: TransferAction;
  amount: number;
  requestId: string;
  playerAccount: string;
  providerIdempotent: boolean;
  response: Record<string, unknown>;
  note: string;
};

export type TransferBackend = {
  rows: Map<string, Row>;
  pauses: Map<TransferProvider, boolean>;
  reservations: Map<string, Reservation>;
  tail: Promise<void>;
};

export function createTransferBackend(): TransferBackend {
  const pauses = new Map<TransferProvider, boolean>();
  for (const provider of TRANSFER_PROVIDERS) pauses.set(provider, true);
  return { rows: new Map(), pauses, reservations: new Map(), tail: Promise.resolve() };
}

export class MemoryTransferStore {
  private readonly backend: TransferBackend;

  constructor(backend: TransferBackend) {
    this.backend = backend;
  }

  async claim(input: ClaimInput): Promise<ClaimResult> {
    return this.locked(() => this.claimNow(input));
  }

  async markSubmitted(operationKey: string): Promise<boolean> {
    return this.locked(() => {
      const row = this.backend.rows.get(operationKey);
      if (!row || row.state !== "pending") return false;
      row.state = "submitted";
      return true;
    });
  }

  async finish(
    operationKey: string,
    outcome: "failed" | "unknown" | "manual_review",
    meta: Record<string, unknown>
  ): Promise<void> {
    await this.locked(() => {
      const row = this.backend.rows.get(operationKey);
      if (!row) throw new Error("provider transfer could not be finished");
      const allowed =
        (row.state === "pending" && outcome === "failed") ||
        (row.state === "submitted" && (outcome === "failed" || outcome === "unknown" || outcome === "manual_review")) ||
        (row.state === "unknown" && outcome === "manual_review");
      if (!allowed) throw new Error("illegal provider transfer transition");
      row.state = outcome;
      row.response = redactProviderMeta(meta);
    });
  }

  async confirm(operationKey: string): Promise<boolean> {
    return this.locked(() => {
      const row = this.backend.rows.get(operationKey);
      if (!row || row.state !== "manual_review") return false;
      row.state = "confirmed";
      return true;
    });
  }

  async reconcile(operationKey: string, decision: "confirmed" | "failed", note: string): Promise<boolean> {
    return this.locked(() => {
      const row = this.backend.rows.get(operationKey);
      if (!row || row.state === "confirmed" || row.state === "failed") return false;
      if (row.state === "pending" && decision !== "failed") {
        throw new Error("a pending transfer was not sent and cannot be confirmed");
      }
      row.state = decision;
      row.note = note.slice(0, 500);
      return true;
    });
  }

  async setPaused(provider: TransferProvider, paused: boolean): Promise<void> {
    await this.locked(() => {
      this.backend.pauses.set(provider, paused);
    });
  }

  async state(operationKey: string): Promise<TransferState | null> {
    return this.backend.rows.get(operationKey)?.state ?? null;
  }

  async counts(): Promise<TransferCounts> {
    const counts = { installed: true, pending: 0, submitted: 0, unknown: 0, manualReview: 0 };
    for (const row of this.backend.rows.values()) {
      if (row.state === "pending") counts.pending += 1;
      if (row.state === "submitted") counts.submitted += 1;
      if (row.state === "unknown") counts.unknown += 1;
      if (row.state === "manual_review") counts.manualReview += 1;
    }
    return counts;
  }

  private claimNow(input: ClaimInput): ClaimResult {
    if (!TRANSFER_PROVIDERS.includes(input.provider)) throw new Error("invalid provider");
    if (input.amount <= 0) throw new Error("amount must be positive");
    if (!input.requestId) throw new Error("wallet reservation is required");
    if (this.backend.pauses.get(input.provider) !== false) return { decision: "paused", state: "paused" };
    const reservation = this.backend.reservations.get(input.requestId);
    if (!reservation || !reservation.open || reservation.action !== input.action) return { decision: "hold", state: null };
    if (input.action === "recharge" && reservation.amount !== input.amount) {
      throw new Error("amount does not match the wallet reservation");
    }
    const existing = this.backend.rows.get(input.operationKey);
    if (existing) {
      if (existing.state === "confirmed" || existing.state === "failed") {
        return { decision: "already_recorded", state: existing.state };
      }
      return { decision: "hold", state: existing.state };
    }
    this.backend.rows.set(input.operationKey, {
      state: "pending",
      provider: input.provider,
      action: input.action,
      amount: input.amount,
      requestId: input.requestId,
      playerAccount: input.playerAccount,
      providerIdempotent: input.providerIdempotent,
      response: redactProviderMeta({}),
      note: "",
    });
    return { decision: "proceed", state: "pending" };
  }

  private async locked<T>(work: () => T): Promise<T> {
    const previous = this.backend.tail;
    let release: () => void = () => {};
    this.backend.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return work();
    } finally {
      release();
    }
  }
}

export function reserveForTest(backend: TransferBackend, requestId: string, reservation: Reservation) {
  backend.reservations.set(requestId, reservation);
}

export type DurableTransferStore = Pick<MemoryTransferStore, "claim" | "markSubmitted" | "finish" | "confirm">;
