import type { Message } from "@/types/database";

export function mergeMessagesById(existing: Message[], incoming: Message[]): Message[] {
  const map = new Map<string, Message>();
  for (const message of existing) map.set(message.id, message);
  for (const message of incoming) map.set(message.id, message);
  return Array.from(map.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

export function appendMessage(existing: Message[], message: Message): Message[] {
  if (existing.some((m) => m.id === message.id)) return existing;
  return mergeMessagesById(existing, [message]);
}
