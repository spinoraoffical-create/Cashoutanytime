"use client";

import { useState } from "react";
import { toast } from "sonner";

import { createTelegramLinkAction, sendTelegramOwnerTestAction } from "@/lib/actions/admin/telegram-center";
import { Button } from "@/components/ui/button";

export function TelegramCenterActions() {
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void createTelegramLinkAction("owner").then((result) => {
              setBusy(false);
              if (!result.ok) toast.error(result.error);
              else {
                setLink(result.deepLink);
                toast.success("Owner link ready. It expires in 10 minutes.");
              }
            });
          }}
        >
          Create owner link
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => {
            if (!window.confirm("Send a test to the saved owner chat?")) return;
            setBusy(true);
            void sendTelegramOwnerTestAction().then((result) => {
              setBusy(false);
              if (!result.ok) toast.error(result.error ?? "Test was not sent.");
              else toast.success("Test queued. Accepted by Telegram is not the same as read.");
            });
          }}
        >
          Send owner test
        </Button>
      </div>
      {link ? <p className="break-all text-sm text-[#d7e3ff]">{link}</p> : null}
    </div>
  );
}
