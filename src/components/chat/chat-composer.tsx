"use client";

import { useRef, useState } from "react";
import { Paperclip, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getAttachmentType, resolveFileMimeType } from "@/lib/chat/attachments";
import { unlockMessageNotificationSound } from "@/lib/chat/message-notification-sound";

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (file: File | null) => Promise<boolean>;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  showSendLabel?: boolean;
}

export function ChatComposer({
  value,
  onChange,
  onSend,
  loading = false,
  disabled = false,
  placeholder = "Type a message...",
  className,
  showSendLabel = false,
}: ChatComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  function clearFile() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!getAttachmentType(file)) {
      toast.error("Unsupported file type. Use JPG, PNG, GIF, WebP, or PDF.");
      e.target.value = "";
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingFile(file);
    setPreviewUrl(
      resolveFileMimeType(file).startsWith("image/")
        ? URL.createObjectURL(file)
        : null
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled || loading || (!value.trim() && !pendingFile)) return;

    const fileToSend = pendingFile;
    const ok = await onSend(fileToSend);
    if (ok) clearFile();
  }

  const canSend = !disabled && !loading && (Boolean(value.trim()) || Boolean(pendingFile));

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "border-t border-border shrink-0 bg-inherit pb-[max(0.5rem,env(safe-area-inset-bottom))]",
        className
      )}
    >
      {pendingFile && (
        <div className="px-3 pt-3 flex items-start gap-2">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Preview" className="h-14 w-14 rounded-lg object-cover border border-border" />
          ) : (
            <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center text-[10px] text-muted-foreground px-1 text-center">
              PDF
            </div>
          )}
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-xs font-medium truncate">{pendingFile.name}</p>
            <p className="text-[10px] text-muted-foreground">
              {(pendingFile.size / 1024).toFixed(0)} KB
            </p>
          </div>
          <button
            type="button"
            onClick={clearFile}
            className="p-1 rounded-md hover:bg-muted text-muted-foreground"
            aria-label="Remove attachment"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="p-2 sm:p-3 grid grid-cols-[44px_minmax(0,1fr)_44px] sm:grid-cols-[44px_minmax(0,1fr)_auto] gap-2 items-center max-w-full">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
          className="hidden"
          onChange={handleFileSelect}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled || loading}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach file"
          className="h-11 w-11 shrink-0"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => void unlockMessageNotificationSound()}
          placeholder={placeholder}
          disabled={disabled || loading}
          className="min-w-0 w-full h-11 text-base sm:text-sm"
        />
        <Button
          type="submit"
          disabled={!canSend}
          size="icon"
          aria-label="Send message"
          className={cn(
            "h-11 w-11 shrink-0",
            showSendLabel && "sm:w-auto sm:min-w-[44px] sm:px-4"
          )}
        >
          <Send className="h-5 w-5 shrink-0" />
          {showSendLabel && <span className="hidden sm:inline ml-1">Send</span>}
        </Button>
      </div>
    </form>
  );
}
