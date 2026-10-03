import type { Message } from "@/types/database";

export function messagePreview(
  msg: Pick<Message, "content" | "attachment_type">
): string {
  const text = (msg.content ?? "").trim();
  if (text) return text;
  if (msg.attachment_type === "image") return "Sent an image";
  if (msg.attachment_type === "file") return "Sent a file";
  return "Sent you a message";
}
