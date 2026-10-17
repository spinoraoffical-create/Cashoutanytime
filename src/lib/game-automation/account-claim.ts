import { openSync, closeSync } from "node:fs";
import { createAdminClient } from "../supabase/admin";
import { getSupabaseServiceRoleKey } from "../supabase/env";

export type AccountClaimResult = "proceed" | "hold" | "not-installed";

export function accountOperationKey(provider: string, account: string): string {
  return `${provider}:register:${account.trim().toLowerCase()}`;
}

/** Exclusive create. A second process on the same machine gets hold. This is not the hosted record. */
export function claimExclusiveFile(operationKey: string, directory: string): AccountClaimResult {
  const safe = operationKey.replace(/[^a-z0-9:-]/gi, "");
  if (safe.length < 8) return "hold";
  try {
    const handle = openSync(`${directory}/${safe}`, "wx");
    closeSync(handle);
    return "proceed";
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EEXIST") return "hold";
    return "hold";
  }
}

/**
 * Hosted once-only claim. A missing table or a missing service key does not send registerUser.
 * A second caller for the same key is held, including after a restart.
 */
export async function claimProviderAccount(provider: string, account: string): Promise<AccountClaimResult> {
  if (!getSupabaseServiceRoleKey()) return "not-installed";
  const db = createAdminClient();
  if (!db) return "not-installed";
  const { data, error } = await db.rpc("claim_provider_account", {
    p_operation_key: accountOperationKey(provider, account),
    p_provider: provider,
    p_player_account: account.trim(),
  });
  if (error) {
    const message = error.message || "";
    if (/does not exist|schema cache|Could not find the function|relation .* does not exist/i.test(message)) {
      return "not-installed";
    }
    return "hold";
  }
  return data === "proceed" ? "proceed" : "hold";
}

export async function finishProviderAccount(
  provider: string,
  account: string,
  outcome: "submitted" | "confirmed" | "failed" | "unknown" | "manual_review"
): Promise<void> {
  if (!getSupabaseServiceRoleKey()) {
    throw new Error("Account record is not installed. The provider call was not sent.");
  }
  const db = createAdminClient();
  if (!db) throw new Error("Account record is not installed. The provider call was not sent.");
  const { error } = await db.rpc("finish_provider_account", {
    p_operation_key: accountOperationKey(provider, account),
    p_outcome: outcome,
  });
  if (error) throw new Error("Account record could not be updated. The provider call was not sent again.");
}
