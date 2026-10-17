import { parseGameRecords, parseStoreBalance, sameMoney } from "./parse";
import { KeyLock } from "./locks";
import type {
  AuditEvent,
  StoreAdapter,
  StoreAdapterResponse,
  StoreCommand,
  StoreJobResult,
  StoreOperation,
  StoreSlug,
} from "./types";
import { operationMovesCredit } from "./types";

interface AccountLink {
  provider: StoreSlug;
  websiteUserId: string;
  gameUsername: string;
}

interface StoredJob {
  websiteUserId: string;
  result: StoreJobResult;
}

export interface StoreEngine {
  submit(adapter: StoreAdapter, command: StoreCommand): Promise<StoreJobResult>;
  expireSession(provider: StoreSlug): void;
  sessionState(provider: StoreSlug): "closed" | "open" | "expired";
  reconcile(requestId: string, receipt: { providerReference?: string | null; balance?: unknown }): "matched" | "manual_review";
  audit(): readonly AuditEvent[];
}

function accountKey(provider: StoreSlug, gameUsername: string): string {
  return `${provider}:${gameUsername.trim().toLowerCase()}`;
}

function playerKey(provider: StoreSlug, websiteUserId: string): string {
  return `${provider}:${websiteUserId}`;
}

function resultOf(command: StoreCommand, provider: StoreSlug, patch: Partial<StoreJobResult> & Pick<StoreJobResult, "state" | "message">): StoreJobResult {
  return {
    requestId: command.requestId,
    provider,
    operation: command.operation,
    retryAllowed: false,
    balance: null,
    providerReference: null,
    gameUsername: command.gameUsername?.trim() || null,
    records: null,
    ...patch,
  };
}

export function createStoreEngine(now: () => string = () => new Date().toISOString()): StoreEngine {
  const jobs = new Map<string, StoredJob>();
  const inflight = new Map<string, Promise<StoreJobResult>>();
  const accounts = new Map<string, AccountLink>();
  const sessions = new Map<StoreSlug, "closed" | "open" | "expired">();
  const events: AuditEvent[] = [];
  const providerLock = new KeyLock();
  const playerLock = new KeyLock();

  function record(job: StoreJobResult) {
    events.push({
      at: now(),
      requestId: job.requestId,
      provider: job.provider,
      operation: job.operation,
      state: job.state,
      message: job.message,
    });
  }

  function remember(command: StoreCommand, job: StoreJobResult): StoreJobResult {
    jobs.set(command.requestId, { websiteUserId: command.websiteUserId, result: job });
    record(job);
    return job;
  }

  function unresolvedCredit(provider: StoreSlug, websiteUserId: string, gameUsername: string | null): StoreJobResult | null {
    for (const job of jobs.values()) {
      if (job.websiteUserId !== websiteUserId || job.result.provider !== provider) continue;
      if (job.result.state !== "manual_review" || !operationMovesCredit(job.result.operation)) continue;
      if (gameUsername && job.result.gameUsername && job.result.gameUsername.toLowerCase() !== gameUsername.toLowerCase()) continue;
      return job.result;
    }
    return null;
  }

  async function finish(adapter: StoreAdapter, command: StoreCommand): Promise<StoreJobResult> {
    const provider = adapter.slug;
    const capability = adapter.capability();
    const username = command.gameUsername?.trim() || "";
    const needsAccount = command.operation !== "create_account";

    if (command.operation === "create_account" && capability.accountRole !== "store") {
      return remember(
        command,
        resultOf(command, provider, {
          state: "confirmed_failure",
          message: "Store role is not verified. A sub-distributor account cannot create players.",
        })
      );
    }

    if (command.operation === "create_account" && username) {
      const existing = accounts.get(accountKey(provider, username));
      if (existing?.websiteUserId === command.websiteUserId) {
        return remember(
          command,
          resultOf(command, provider, {
            state: "confirmed_success",
            gameUsername: existing.gameUsername,
            message: "Player account already belongs to this website user.",
          })
        );
      }
      if (existing) {
        return remember(
          command,
          resultOf(command, provider, {
            state: "confirmed_failure",
            message: "That player name already belongs to another website account.",
          })
        );
      }
    }

    if (needsAccount) {
      const link = username ? accounts.get(accountKey(provider, username)) : undefined;
      if (!link || link.websiteUserId !== command.websiteUserId) {
        return remember(
          command,
          resultOf(command, provider, {
            state: "confirmed_failure",
            message: "This game account is not owned by the signed-in player.",
          })
        );
      }
    }

    if (operationMovesCredit(command.operation)) {
      const amount = parseStoreBalance(command.amount);
      if (amount === null || amount <= 0) {
        return remember(
          command,
          resultOf(command, provider, {
            state: "confirmed_failure",
            message: "Enter a credit amount greater than zero.",
          })
        );
      }
      const pending = unresolvedCredit(provider, command.websiteUserId, username || null);
      if (pending) {
        return remember(
          command,
          resultOf(command, provider, {
            state: "manual_review",
            message: `Request ${pending.requestId} has an unknown credit result. It was not sent again.`,
          })
        );
      }
      if (sessions.get(provider) === "expired") {
        return remember(
          command,
          resultOf(command, provider, {
            state: "confirmed_failure",
            message: "Store session expired before the transfer was sent.",
          })
        );
      }
    }

    let response: StoreAdapterResponse;
    try {
      response = await adapter.execute(command);
    } catch (error) {
      sessions.set(provider, "expired");
      const message = error instanceof Error ? error.message : "Store worker stopped before the provider answered.";
      return remember(
        command,
        resultOf(command, provider, {
          state: "manual_review",
          message: operationMovesCredit(command.operation)
            ? `Credit result is unknown. ${message}`
            : message,
        })
      );
    }

    if (response.sessionExpired || response.outcome === "unknown") {
      sessions.set(provider, "expired");
      return remember(
        command,
        resultOf(command, provider, {
          state: "manual_review",
          message: response.message || "Provider outcome is unknown. The request is held for review.",
          providerReference: response.providerReference ?? null,
          balance: parseStoreBalance(response.balance),
        })
      );
    }

    if (response.outcome === "confirmed_failure") {
      return remember(
        command,
        resultOf(command, provider, {
          state: "confirmed_failure",
          message: response.message || "The store refused the request.",
        })
      );
    }

    return remember(command, acceptSuccess(command, provider, response));
  }

  function acceptSuccess(command: StoreCommand, provider: StoreSlug, response: StoreAdapterResponse): StoreJobResult {
    if (command.operation === "create_account") {
      const gameUsername = response.gameUsername?.trim() || "";
      if (!gameUsername) {
        return resultOf(command, provider, {
          state: "manual_review",
          message: "The store did not return the new player name.",
        });
      }
      const existing = accounts.get(accountKey(provider, gameUsername));
      if (existing && existing.websiteUserId !== command.websiteUserId) {
        return resultOf(command, provider, {
          state: "confirmed_failure",
          message: "That player name already belongs to another website account.",
        });
      }
      accounts.set(accountKey(provider, gameUsername), {
        provider,
        websiteUserId: command.websiteUserId,
        gameUsername,
      });
      sessions.set(provider, "open");
      return resultOf(command, provider, {
        state: "confirmed_success",
        gameUsername,
        message: response.message || "Player account created.",
      });
    }

    if (command.operation === "check_balance") {
      const balance = parseStoreBalance(response.balance);
      if (balance === null) {
        return resultOf(command, provider, {
          state: "manual_review",
          message: "The store did not return a balance. It was not saved as zero.",
        });
      }
      sessions.set(provider, "open");
      return resultOf(command, provider, {
        state: "confirmed_success",
        balance,
        message: response.message || "Balance confirmed.",
      });
    }

    if (command.operation === "game_records") {
      const records = parseGameRecords(response.records);
      if (!records) {
        return resultOf(command, provider, {
          state: "manual_review",
          message: "Game records could not be verified.",
        });
      }
      sessions.set(provider, "open");
      return resultOf(command, provider, {
        state: "confirmed_success",
        records,
        message: response.message || "Game records verified.",
      });
    }

    const providerReference = response.providerReference?.trim() || "";
    const balance = parseStoreBalance(response.balance);
    if (!providerReference || balance === null) {
      sessions.set(provider, "expired");
      return resultOf(command, provider, {
        state: "manual_review",
        balance,
        providerReference: providerReference || null,
        message: "The store did not return a receipt and a balance. The credit result is unknown.",
      });
    }
    sessions.set(provider, "open");
    return resultOf(command, provider, {
      state: "confirmed_success",
      balance,
      providerReference,
      message: response.message || "Credit transfer confirmed.",
    });
  }

  return {
    submit(adapter, command) {
      const requestId = command.requestId.trim();
      if (!requestId) {
        return Promise.resolve(
          resultOf(command, adapter.slug, {
            state: "confirmed_failure",
            message: "A request id is required.",
          })
        );
      }
      const stored = jobs.get(requestId);
      if (stored) return Promise.resolve(stored.result);
      const running = inflight.get(requestId);
      if (running) return running;

      const operation: StoreOperation = command.operation;
      const task = providerLock.run(adapter.slug, () =>
        playerLock.run(playerKey(adapter.slug, command.websiteUserId), () => {
          const again = jobs.get(requestId);
          if (again) return Promise.resolve(again.result);
          return finish(adapter, { ...command, requestId, operation });
        })
      );
      inflight.set(requestId, task);
      return task.finally(() => {
        inflight.delete(requestId);
      });
    },
    expireSession(provider) {
      sessions.set(provider, "expired");
    },
    sessionState(provider) {
      return sessions.get(provider) ?? "closed";
    },
    reconcile(requestId, receipt) {
      const job = jobs.get(requestId)?.result;
      if (!job || job.state !== "confirmed_success" || !operationMovesCredit(job.operation)) return "manual_review";
      const balance = parseStoreBalance(receipt.balance);
      const reference = receipt.providerReference?.trim() || "";
      if (!reference || reference !== job.providerReference || !sameMoney(balance, job.balance)) return "manual_review";
      return "matched";
    },
    audit() {
      return events;
    },
  };
}
