"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getChatAttachmentSignedUrl } from "@/lib/chat/attachments";
import type { Message } from "@/types/database";

interface ChatMessageContentProps {
  message: Message;
}

function ChatAttachmentPreview({
  path,
  type,
  name,
}: {
  path: string;
  type: "image" | "file";
  name: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !path) return;
    let cancelled = false;

    getChatAttachmentSignedUrl(supabase, path).then((signedUrl) => {
      if (!cancelled && signedUrl) setUrl(signedUrl);
    });

    return () => {
      cancelled = true;
    };
  }, [supabase, path]);

  if (!url) {
    return <div className="mt-1 h-24 w-full max-w-[200px] rounded-lg bg-white/10 animate-pulse" />;
  }

  if (type === "image") {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block mt-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={name}
          className="rounded-lg max-w-full max-h-48 object-cover border border-white/10"
        />
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download={name}
      className="mt-1 flex items-center gap-2 rounded-lg bg-black/20 px-2 py-1.5 text-xs hover:bg-black/30 transition-colors"
    >
      <FileText className="h-4 w-4 shrink-0" />
      <span className="truncate">{name}</span>
    </a>
  );
}

export function ChatMessageContent({ message }: ChatMessageContentProps) {
  const hasText = Boolean(message.content?.trim());
  const hasAttachment = Boolean(message.attachment_url && message.attachment_type);

  return (
    <>
      {hasAttachment && message.attachment_url && message.attachment_type && (
        <ChatAttachmentPreview
          path={message.attachment_url}
          type={message.attachment_type}
          name={message.attachment_name ?? "Attachment"}
        />
      )}
      {hasText && <p className={hasAttachment ? "mt-2" : undefined}>{message.content}</p>}
    </>
  );
}
