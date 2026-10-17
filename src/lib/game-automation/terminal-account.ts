import { providerReplyFlags } from "./terminal-response";

/** Stays off until a supervised test is explicitly armed in this file. */
export const TERMINAL_ACCOUNT_CREATION_ARMED = false;

export type TerminalProvider = "fire-kirin" | "milky-way" | "orion-stars";

export type ProbeKind = "ok" | "signature" | "session" | "missing" | "rejected" | "unclear";

export type NameState = "available" | "taken" | "unknown";

export type ProviderProbe = {
  code: string;
  message?: string;
  balance?: number | null;
  nameState?: NameState;
};

export type AccountCreateStatus =
  | "blocked"
  | "ask-provider"
  | "already-exists"
  | "confirmed"
  | "rejected"
  | "unconfirmed";

const heldNames = new Set<string>();

export function probeFromError(error: unknown): ProviderProbe {
  const message = error instanceof Error ? error.message : "";
  const code = /\[code ([^\]]+)\]/.exec(message)?.[1] || "";
  return { code, message, balance: null };
}

export function classifyProbe(code: string, message: string): ProbeKind {
  if (code === "200") return "ok";
  const flags = providerReplyFlags(message);
  if (flags.signature) return "signature";
  if (flags.session || flags.timeout) return "session";
  if (flags.missingAccount) return "missing";
  if (code === "201") return "rejected";
  return "unclear";
}

export function terminalGameCount(data: unknown): number | null {
  if (Array.isArray(data)) return data.length;
  if (typeof data === "string" && data.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(data) as unknown;
      return Array.isArray(parsed) ? parsed.length : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function decideAccountCreation(input: {
  armed: boolean;
  capability: ProbeKind;
  lookup: ProbeKind;
  nameState: NameState;
}): { decision: "ask-provider" | "already-exists" | "create-once" | "blocked"; reason: string } {
  if (!input.armed) {
    return { decision: "blocked", reason: "Account creation is prepared and is not armed. No player account was created." };
  }
  if (input.capability === "signature") {
    return { decision: "ask-provider", reason: "Signed calls are rejected. No player account was created." };
  }
  if (input.capability !== "ok") {
    return { decision: "blocked", reason: "Signed calls were not confirmed. No player account was created." };
  }
  if (input.nameState === "taken") {
    return { decision: "already-exists", reason: "That player name is already taken." };
  }
  if (input.nameState === "available") {
    return { decision: "create-once", reason: "The player name is available." };
  }
  if (input.lookup === "ok") {
    return { decision: "already-exists", reason: "Player lookup already finds that account." };
  }
  if (input.lookup === "missing") {
    return { decision: "create-once", reason: "Player lookup says that account does not exist." };
  }
  return { decision: "blocked", reason: "Player lookup did not clearly say the account is absent. No player account was created." };
}

/** A 200 from registerUser is not enough. Lookup must return 200 and a numeric balance, including zero. */
export function confirmAccountCreation(input: {
  registerCode: string;
  verifyCode: string;
  balance: number | null;
}): "confirmed" | "rejected" | "unconfirmed" {
  if (input.registerCode !== "200") return input.registerCode === "201" ? "rejected" : "unconfirmed";
  if (input.verifyCode !== "200" || input.balance === null) return "unconfirmed";
  return "confirmed";
}

function nameKey(provider: string, account: string): string {
  return `${provider}:${account.trim().toLowerCase()}`;
}

export function holdPlayerName(provider: string, account: string): boolean {
  const key = nameKey(provider, account);
  if (heldNames.has(key)) return false;
  heldNames.add(key);
  return true;
}

export function releasePlayerName(provider: string, account: string): void {
  heldNames.delete(nameKey(provider, account));
}

export function playerNameHeld(provider: string, account: string): boolean {
  return heldNames.has(nameKey(provider, account));
}

/**
 * Creates one player only when armed, the signed call works, and the name is clearly free.
 * An unclear provider reply stays unconfirmed and is not retried in this process.
 */
export async function openTerminalPlayerAccount(input: {
  provider: TerminalProvider;
  account: string;
  armed: boolean;
  capability: () => Promise<ProviderProbe>;
  lookup: () => Promise<ProviderProbe>;
  register: () => Promise<ProviderProbe>;
  verify: () => Promise<ProviderProbe>;
  /** Required for a live create. proceed is the only result that may call registerUser. */
  claim?: () => Promise<"proceed" | "hold" | "not-installed">;
  finish?: (outcome: "submitted" | "confirmed" | "failed" | "unknown" | "manual_review") => Promise<void>;
}): Promise<{ status: AccountCreateStatus; reason: string }> {
  const account = input.account.trim();
  const maxLength = input.provider === "orion-stars" ? 25 : 32;
  if (!/^[A-Za-z0-9]+$/.test(account) || account.length < 6 || account.length > maxLength) {
    return { status: "blocked", reason: `Player account must be 6 to ${maxLength} letters or numbers.` };
  }
  if (!input.armed) {
    return {
      status: "blocked",
      reason: "Account creation is prepared and is not armed. No player account was created.",
    };
  }

  let capability: ProviderProbe;
  let lookup: ProviderProbe;
  try {
    capability = await input.capability();
    lookup = await input.lookup();
  } catch {
    return { status: "blocked", reason: "The provider check did not complete. No player account was created." };
  }

  const decision = decideAccountCreation({
    armed: true,
    capability: classifyProbe(String(capability.code), capability.message || ""),
    lookup: classifyProbe(String(lookup.code), lookup.message || ""),
    nameState: lookup.nameState || capability.nameState || "unknown",
  });
  if (decision.decision !== "create-once") {
    return { status: decision.decision, reason: decision.reason };
  }
  if (input.claim) {
    let claimed: "proceed" | "hold" | "not-installed" = "not-installed";
    try {
      claimed = await input.claim();
    } catch {
      claimed = "hold";
    }
    if (claimed !== "proceed") {
      return {
        status: "blocked",
        reason: "The once-only account record did not allow this create. No player account was created.",
      };
    }
    if (input.finish) {
      try {
        await input.finish("submitted");
      } catch {
        return {
          status: "blocked",
          reason: "The once-only account record could not be marked. No player account was created.",
        };
      }
    }
  }
  if (!holdPlayerName(input.provider, account)) {
    return { status: "already-exists", reason: "That player name is already being created." };
  }

  let registered: ProviderProbe;
  try {
    registered = await input.register();
  } catch {
    await input.finish?.("unknown").catch(() => undefined);
    return {
      status: "unconfirmed",
      reason: "The provider did not return a clear account result. It will not be retried.",
    };
  }

  const registerKind = classifyProbe(String(registered.code), registered.message || "");
  if (String(registered.code) !== "200") {
    if (registerKind === "signature" || registerKind === "rejected" || registerKind === "missing") {
      await input.finish?.("failed").catch(() => undefined);
      releasePlayerName(input.provider, account);
      return {
        status: registerKind === "signature" ? "ask-provider" : "rejected",
        reason: "The provider refused the account. No confirmed account was stored.",
      };
    }
    await input.finish?.("unknown").catch(() => undefined);
    return { status: "unconfirmed", reason: "The provider reply was unclear. It will not be retried." };
  }

  let verified: ProviderProbe;
  try {
    verified = await input.verify();
  } catch {
    await input.finish?.("manual_review").catch(() => undefined);
    return {
      status: "unconfirmed",
      reason: "Account creation was not confirmed by player lookup. It will not be retried.",
    };
  }
  const confirmed = confirmAccountCreation({
    registerCode: "200",
    verifyCode: String(verified.code),
    balance: verified.balance === undefined ? null : verified.balance,
  });
  if (confirmed !== "confirmed") {
    await input.finish?.("manual_review").catch(() => undefined);
    return {
      status: confirmed,
      reason: "Account creation was not confirmed by player lookup. It will not be retried.",
    };
  }
  await input.finish?.("confirmed").catch(() => undefined);
  return { status: "confirmed", reason: "Player lookup confirmed the new account." };
}
