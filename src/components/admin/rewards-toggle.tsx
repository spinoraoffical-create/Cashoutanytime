"use client";

import * as React from "react";
import { Gift, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
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
    const question = next
      ? "Turn the rewards system on? This saves immediately."
      : "Turn the rewards system off? Players cannot claim rewards until you turn it back on.";
    if (!window.confirm(question)) return;
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
    <AdminSectionCard
      title="Rewards system"
      description="Master switch for daily, weekly, and streak claims, promotions, and the daily spin. The switch asks you to confirm, then saves immediately. Turning it off stops claims right away."
      action={
        <span className="flex items-center gap-2">
          {pending ? <Loader2 className="size-3.5 animate-spin text-[#9fb0d0]" aria-hidden /> : null}
          <Switch checked={enabled} onCheckedChange={toggle} disabled={pending} aria-label="Toggle rewards system" className="data-[state=checked]:bg-[#6d28d9]" />
        </span>
      }
    >
      <div className="flex gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#7c3aed]/20 text-[#c4b5fd]">
          <Gift className="size-5" aria-hidden />
        </span>
        <p className="text-sm text-[#9fb0d0]">
          Status:{" "}
          <span className={enabled ? "font-semibold text-emerald-200" : "font-semibold text-rose-200"}>
            {enabled ? "Enabled" : "Off"}
          </span>
          . Players see “Rewards are paused” while this is off and cannot claim anything.
        </p>
      </div>
    </AdminSectionCard>
  );
}
