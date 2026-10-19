export const PLAYER_INBOX_PATH = "/dashboard/inbox";
export const PLAYER_CHAT_PATH = "/dashboard/messages";

const BLOCKED_STATUS = new Set(["pending", "processing", "requested", "unknown", "created", "hold"]);

export function safeNotificationPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const path = value.trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") || path.includes("://")) return null;
  if (path.toLowerCase().includes("javascript:")) return null;
  return path;
}

export function notificationCategory(type: string | null | undefined): string {
  const key = (type ?? "").toLowerCase();
  if (key === "announcement" || key === "promo" || key === "promotion") return "Promotion";
  if (key === "support") return "Support";
  if (key === "reward" || key === "vip") return "Account";
  if (key === "warning" || key === "system" || key === "success" || key === "info") return "Account";
  return "Notice";
}

export function canNotifyConfirmedStatus(status: string, confirmed: boolean): boolean {
  if (!confirmed) return false;
  return !BLOCKED_STATUS.has(status.trim().toLowerCase());
}

export function lockScreenText(body: string): string {
  return body
    .replace(/\$\s?\d[\d,]*(?:\.\d+)?/g, "an update")
    .replace(/\b\d{6,}\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

export type PushPermissionState = "granted" | "denied" | "default" | "unsupported";

export function pushEnableHelp(state: PushPermissionState): string {
  if (state === "unsupported") return "This browser cannot show phone notifications.";
  if (state === "denied") return "Notifications are blocked in the browser. Allow them in the browser settings, then try again.";
  if (state === "granted") return "This device can receive phone notifications.";
  return "Phone notifications stay off until you press Enable Phone Notifications.";
}

export type PushCandidate = {
  subscriptionId: string;
  userId: string;
  marketingOptIn: boolean;
  expired: boolean;
  alreadyAccepted: boolean;
};

export function planPromotionalPush(candidates: PushCandidate[]) {
  const send: string[] = [];
  let optedOut = 0;
  let expired = 0;
  let alreadyAccepted = 0;
  for (const person of candidates) {
    if (!person.marketingOptIn) {
      optedOut += 1;
      continue;
    }
    if (person.expired) {
      expired += 1;
      continue;
    }
    if (person.alreadyAccepted) {
      alreadyAccepted += 1;
      continue;
    }
    send.push(person.subscriptionId);
  }
  return { send, optedOut, expired, alreadyAccepted };
}

export function pushResultLabel(statusCode: number): "accepted" | "expired" | "failed" {
  if (statusCode === 201 || statusCode === 200) return "accepted";
  if (statusCode === 404 || statusCode === 410) return "expired";
  return "failed";
}

export function sameOwnerSubscription(ownerId: string, sessionUserId: string): boolean {
  return ownerId === sessionUserId;
}
