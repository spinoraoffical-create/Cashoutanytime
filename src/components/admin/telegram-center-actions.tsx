"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createTelegramLinkAction, recoverTelegramUpdateAction, sendPlayersDeliveryCheckAction, sendTelegramAlertTestAction, sendTelegramOwnerTestAction } from "@/lib/actions/admin/telegram-center";
import { Button } from "@/components/ui/button";

export type PlayersDeliveryCheckView = {
  status: string;
  attemptCount: number;
  latency: string | null;
  error: string | null;
};

const ALERT_TESTS = [
  ["payments", "Test Payments Bot"],
  ["players", "Test Players Bot"],
  ["errors", "Test Errors Bot"],
] as const;

export function TelegramCenterActions({
  deliveryCheck,
  deliveryCheckUnavailable,
}: {
  deliveryCheck: PlayersDeliveryCheckView | null;
  deliveryCheckUnavailable: boolean;
}) {
  const router = useRouter();
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
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => {
            if (!window.confirm("Send one real-time Players delivery check to the owner private chat? A second click will not send again.")) return;
            setBusy(true);
            void sendPlayersDeliveryCheckAction().then((result) => {
              setBusy(false);
              router.refresh();
              if (!result.ok) toast.error(result.error ?? "The delivery check was not queued.");
              else if (result.repeated) toast.success("Already recorded. No second message was sent.");
              else toast.success("Check queued. Refresh the status after Telegram answers.");
            });
          }}
        >
          Test Real-Time Players Delivery
        </Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => router.refresh()}>
          Refresh status
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
      <div className="text-sm text-[#d7e3ff]">
        {deliveryCheckUnavailable ? (
          <p>Delivery check status unavailable.</p>
        ) : deliveryCheck ? (
          <p>
            Players delivery check: {deliveryCheck.status} · attempts {deliveryCheck.attemptCount}
            {deliveryCheck.latency ? ` · ${deliveryCheck.latency}` : ""}
            {deliveryCheck.error ? ` · ${deliveryCheck.error}` : ""}
          </p>
        ) : (
          <p>Players delivery check: not sent.</p>
        )}
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
