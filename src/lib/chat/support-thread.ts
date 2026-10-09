import { asksForPerson, CHAT_PERSON_REPLY } from "@/lib/ai/escalate";
import type { Message } from "@/types/database";

export function supportReferenceCode(id: string, stored?: string | null) {
  const raw = (stored || id || "").replace(/-/g, "");
  return raw.slice(0, 8);
}

export function threadRequestedHuman(
  messages: Message[],
  userId: string | null,
  humanRequestedAt?: string | null
) {
  if (humanRequestedAt) return true;
  return messages.some(
    (message) =>
      message.content.includes(CHAT_PERSON_REPLY) ||
      (userId != null && message.sender_id === userId && asksForPerson(message.content))
  );
}

export function messageMentionsWallet(content: string) {
  return /\b(wallet|deposits?|cash\s?-?outs?|balances?)\b/i.test(content);
}

export function supportDayLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
