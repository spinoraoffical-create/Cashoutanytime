"use client";

import * as React from "react";
import { Gift, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { GlassCard } from "@/components/shared/glass-card";
import { Switch } from "@/components/ui/switch";
import { updateSettingAction } from "@/lib/actions/admin/settings";

/**
 * Master on/off switch for the rewards system (daily/weekly/streak claims,
 * promotions and the daily spin). When off, the server actions reject all claims
 * and spins — so players can't claim anything until it's re-enabled.
 */
export function RewardsToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = React.useState(initialEnabled);
  const [pending, startTransition] = React.useTransition();

  function toggle(next: boolean) {
    setEnabled(next);
    startTransition(async () => {
      const res = await updateSettingAction({ key: "rewards_enabled", value: next });
      if (!res.ok) {
        setEnabled(!next);
        toast.error(res.error);
      } else {
        toast.success(next ? "Rewards system enabled." : "Rewards system turned off.");
      }
    });
  }

  return (
    <GlassCard className="mb-6 flex items-start justify-between gap-4 p-6">
      <div className="flex gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-ws-gold/10 text-ws-gold-deep dark:text-ws-gold">
          <Gift className="size-5" aria-hidden />
        </span>
        <div>
          <h3 className="flex items-center gap-2 font-bold">
            Rewards system
            {pending && <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden />}
          </h3>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">
            Master switch for daily/weekly/streak claims, promotions and the daily
            spin. Turn off to stop all claims instantly — players see &ldquo;Rewards are
            paused&rdquo; and cannot claim anything.
          </p>
          <p className="mt-2 text-xs font-semibold">
            Status:{" "}
            <span className={enabled ? "text-ws-green-deep dark:text-ws-green" : "text-ws-danger"}>
              {enabled ? "Enabled" : "Off"}
            </span>
          </p>
        </div>
      </div>
      <Switch checked={enabled} onCheckedChange={toggle} disabled={pending} aria-label="Toggle rewards system" />
    </GlassCard>
  );
}
