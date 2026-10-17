import { confirmedCheckBalance } from "./load-outcome";

/** Official Terminal API login field is `agentKey`. Some responses use `agentkey`. */
export function terminalAgentKey(json: { agentKey?: unknown; agentkey?: unknown }): string {
  const value = json.agentKey ?? json.agentkey;
  return typeof value === "string" ? value.trim() : "";
}

/** Official docs use `Balance` or `userbalance`. A missing value stays unknown. */
export function terminalReportedBalance(raw: unknown): number | null {
  if (typeof raw === "number") return confirmedCheckBalance(raw);
  if (typeof raw === "string") {
    const text = raw.trim();
    if (!text) return null;
    return confirmedCheckBalance(Number(text));
  }
  return null;
}

export function terminalAgentBalance(json: { Balance?: unknown; balance?: unknown }): number | null {
  return terminalReportedBalance(json.Balance ?? json.balance);
}

export function terminalUserBalance(json: { userBalance?: unknown; userbalance?: unknown }): number | null {
  return terminalReportedBalance(json.userBalance ?? json.userbalance);
}

/** A category for a provider reply. The original text is not returned. */
export function providerReplyClass(code: string, message: string): string {
  const flags = providerReplyFlags(message);
  if (flags.whitelist) return "whitelist";
  if (flags.signature) return "signature";
  if (flags.session || flags.timeout) return "session";
  if (flags.missingAccount) return "account";
  if (code === "200") return "ok";
  return "other";
}

export function providerReplyFlags(message: string) {
  return {
    signature: /signature/i.test(message),
    signWord: /\bsign\b/i.test(message),
    missingAccount: /not found|not exist|does not exist|no user|invalid user/i.test(message),
    session: /session/i.test(message),
    timeout: /timeout/i.test(message),
    whitelist: /white/i.test(message),
    balance: /balance/i.test(message),
    terminal: /terminal/i.test(message),
    enable: /enable/i.test(message),
  };
}
