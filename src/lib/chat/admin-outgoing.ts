const IDS_KEY = "hub-admin-sent-message-ids";
const PENDING_KEY = "hub-admin-pending-message";

export function markAdminOutgoingSoon(conversationId: string, content: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    PENDING_KEY,
    JSON.stringify({ conversationId, content, at: Date.now() })
  );
}

export function markAdminOutgoing(id: string) {
  if (typeof window === "undefined") return;
  const ids = readIds();
  ids.push(id);
  window.sessionStorage.setItem(IDS_KEY, JSON.stringify(ids.slice(-40)));
  window.sessionStorage.removeItem(PENDING_KEY);
}

export function isAdminOutgoingMessage(message: {
  id: string;
  conversation_id: string;
  content: string;
}) {
  if (typeof window === "undefined") return false;
  if (readIds().includes(message.id)) return true;
  try {
    const raw = window.sessionStorage.getItem(PENDING_KEY);
    if (!raw) return false;
    const pending = JSON.parse(raw) as { conversationId?: string; content?: string; at?: number };
    const recent = typeof pending.at === "number" && Date.now() - pending.at < 20_000;
    return (
      recent &&
      pending.conversationId === message.conversation_id &&
      pending.content === message.content
    );
  } catch {
    return false;
  }
}

function readIds(): string[] {
  try {
    const raw = window.sessionStorage.getItem(IDS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}
