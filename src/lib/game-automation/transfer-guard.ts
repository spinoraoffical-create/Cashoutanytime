import {
  isProviderTransferUnknown,
  redactProviderMeta,
  transferBlockedError,
  type ClaimInput,
  type MemoryTransferStore,
} from "./transfer-ledger";

type Store = Pick<MemoryTransferStore, "claim" | "markSubmitted" | "finish">;

/**
 * Claims a durable operation, then sends once.
 * A provider acceptance stays in manual review until the caller confirms the balance.
 * A timeout after submission is unknown and is not sent again.
 */
export async function executeGuardedTransfer<T extends Record<string, unknown>>(options: {
  store: Store;
  claim: ClaimInput;
  prepare: () => Promise<void>;
  send: () => Promise<{ code: string | number; msg?: string; value: T }>;
}): Promise<T & { operationKey: string }> {
  const claim = await options.store.claim(options.claim);
  if (claim.decision !== "proceed") throw transferBlockedError(claim.decision);

  const key = options.claim.operationKey;
  let submitted = false;
  try {
    await options.prepare();
    submitted = await options.store.markSubmitted(key);
    if (!submitted) throw new Error("Provider outcome unknown. This transfer was not sent again.");

    const result = await options.send();
    const code = String(result.code);
    const meta = redactProviderMeta({ code, msg: result.msg || "" });
    if (code !== "200") {
      await options.store.finish(key, "failed", meta);
      throw new Error(result.msg || "The store refused the transfer.");
    }
    try {
      await options.store.finish(key, "manual_review", meta);
    } catch {
      throw new Error("Provider outcome unknown. The provider answered and the balance was not confirmed.");
    }
    return { ...result.value, operationKey: key };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!/was not sent again|balance was not confirmed|store refused|The store refused/i.test(message)) {
      const outcome = submitted && isProviderTransferUnknown(message) ? "unknown" : "failed";
      try {
        await options.store.finish(key, outcome, redactProviderMeta({ msg: (submitted ? message : "This transfer was not sent.").slice(0, 300) }));
      } catch {
        // Leave the recorded state. Do not send the provider request again.
      }
    }
    throw error;
  }
}
