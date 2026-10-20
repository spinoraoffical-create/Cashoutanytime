"use client";

import { useState } from "react";
import { toast } from "sonner";

import { createTelegramLinkAction, recoverTelegramUpdateAction, sendTelegramAlertTestAction, sendTelegramOwnerTestAction } from "@/lib/actions/admin/telegram-center";
import { Button } from "@/components/ui/button";

const ALERT_TESTS = [
  ["payments", "Test Payments Bot"],
  ["players", "Test Players Bot"],
  ["errors", "Test Errors Bot"],
] as const;

export function TelegramCenterActions() {
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [tests, setTests] = useState<Record<string, string>>({});

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
        {ALERT_TESTS.map(([bot, label]) => (
          <Button
            key={bot}
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => {
              if (!window.confirm(`Send one test through the ${bot} bot?`)) return;
              setBusy(true);
              void sendTelegramAlertTestAction(bot).then((result) => {
                setBusy(false);
                const status = result.status ?? "not sent";
                const detail = result.error ? `${status}. ${result.error}` : status;
                const prefix = result.repeated ? "Already recorded" : "Result";
                setTests((current) => ({ ...current, [bot]: `${prefix}: ${detail}` }));
                if (!result.ok) toast.error(result.error ?? "The test was not sent.");
                else toast.success(`${label}: ${status}.`);
              });
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      {link ? <p className="break-all text-sm text-[#d7e3ff]">{link}</p> : null}
      {ALERT_TESTS.map(([bot, label]) =>
        tests[bot] ? (
          <p key={bot} className="text-sm text-[#d7e3ff]">
            {label}: {tests[bot]}
          </p>
        ) : null
      )}
    </div>
  );
}

export function TelegramUpdateRecovery({ bot, updateId }: { bot: string; updateId: number }) {
  const [busy, setBusy] = useState(false);
  function run(action: "reopen" | "dismiss") {
    const warning =
      action === "reopen"
        ? "Reopen this update so Telegram can deliver the same update id again? This does not run the command."
        : "Dismiss this exhausted update? This does not run the command.";
    if (!window.confirm(warning)) return;
    setBusy(true);
    void recoverTelegramUpdateAction(bot, updateId, action).then((result) => {
      setBusy(false);
      if (!result.ok) toast.error(result.error ?? "The update was not changed.");
      else toast.success(action === "reopen" ? "Update reopened. The command was not run." : "Update dismissed. The command was not run.");
    });
  }
  return (
    <div className="flex gap-2">
      <Button type="button" disabled={busy} onClick={() => run("reopen")}>Reopen</Button>
      <Button type="button" variant="secondary" disabled={busy} onClick={() => run("dismiss")}>Dismiss</Button>
    </div>
  );
}
