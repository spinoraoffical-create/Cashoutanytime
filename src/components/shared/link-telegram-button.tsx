"use client";

import * as React from "react";
import { Send, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { generateTelegramLinkCode } from "@/lib/actions/telegram";
import type { TelegramBotPurpose } from "@/lib/database.types";

/** Generates a one-time Telegram deep link and lets the user open it to link their account. */
export function LinkTelegramButton({ purpose }: { purpose: TelegramBotPurpose }) {
  const [pending, startTransition] = React.useTransition();
  const [link, setLink] = React.useState<{ deepLink: string; expiresInMinutes: number } | null>(null);

  function generate() {
    startTransition(async () => {
      const res = await generateTelegramLinkCode(purpose);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setLink(res);
    });
  }

  if (link) {
    return (
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <Button asChild size="sm">
          <a href={link.deepLink} target="_blank" rel="noopener noreferrer">
            Open in Telegram
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </Button>
        <p className="text-xs text-muted-foreground">
          Link expires in {link.expiresInMinutes} minutes — one use only.
        </p>
      </div>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={generate} disabled={pending}>
      {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Send className="size-3.5" aria-hidden />}
      Link Telegram
    </Button>
  );
}
