import type { SupabaseClient } from "@supabase/supabase-js";

export const CHAT_ATTACHMENT_BUCKET = "chat-attachments";
export const CHAT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
};

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
]);

export type ChatAttachmentType = "image" | "file";

export interface ChatAttachmentPayload {
  url: string;
  type: ChatAttachmentType;
  name: string;
}

function createUploadId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** WhatsApp / Windows exports often have an empty or generic file.type */
export function resolveFileMimeType(file: File): string {
  const fromBrowser = file.type?.trim();
  if (fromBrowser && fromBrowser !== "application/octet-stream") {
    return fromBrowser === "image/jpg" ? "image/jpeg" : fromBrowser;
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_MIME[ext] ?? fromBrowser ?? "";
}

export function getAttachmentType(file: File): ChatAttachmentType | null {
  const mime = resolveFileMimeType(file);
  if (!ALLOWED_TYPES.has(mime)) return null;
  return mime.startsWith("image/") ? "image" : "file";
}

export async function uploadChatAttachment(
  supabase: SupabaseClient,
  conversationId: string,
  file: File
): Promise<{ data: ChatAttachmentPayload } | { error: string }> {
  const mimeType = resolveFileMimeType(file);
  const attachmentType = getAttachmentType(file);

  if (!attachmentType) {
    return { error: "Unsupported file type. Use JPG, PNG, GIF, WebP, or PDF." };
  }

  if (file.size > CHAT_MAX_FILE_SIZE) {
    return { error: "File is too large. Maximum size is 10 MB." };
  }

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const path = `${conversationId}/${createUploadId()}.${ext}`;

  const { error } = await supabase.storage
    .from(CHAT_ATTACHMENT_BUCKET)
    .upload(path, file, { contentType: mimeType, upsert: false });

  if (error) {
    const hint =
      error.message.includes("Bucket not found") || error.message.includes("not found")
        ? " Run supabase/chat-attachments.sql in Supabase first."
        : "";
    return { error: `${error.message}${hint}` };
  }

  return {
    data: {
      url: path,
      type: attachmentType,
      name: file.name,
    },
  };
}

export async function getChatAttachmentSignedUrl(
  supabase: SupabaseClient,
  path: string,
  expiresIn = 3600
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(CHAT_ATTACHMENT_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
