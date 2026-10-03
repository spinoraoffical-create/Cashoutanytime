"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ConfirmActionButton } from "@/components/admin/confirm-action-button";
import { sendTelegramPromoNowAction, updateSettingAction } from "@/lib/actions/admin/settings";
import type { Json } from "@/lib/database.types";

type Settings = Record<string, Json>;

export function SettingsEditor({ initial }: { initial: Settings }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const maintenance = (initial.maintenance_mode ?? {}) as {
    enabled?: boolean;
    message?: string;
  };
  const registration = (initial.registration_open ?? {}) as { enabled?: boolean };
  const welcome = (initial.welcome_bonus ?? {}) as {
    coins?: number;
    xp?: number;
    title?: string;
  };
  const social = (initial.social_links ?? {}) as Record<string, string>;
  const telegramPromo = (initial.telegram_promo ?? {}) as { enabled?: boolean };

  const [maintEnabled, setMaintEnabled] = React.useState(!!maintenance.enabled);
  const [maintMsg, setMaintMsg] = React.useState(maintenance.message ?? "");
  const [regOpen, setRegOpen] = React.useState(registration.enabled !== false);
  const [promoEnabled, setPromoEnabled] = React.useState(!!telegramPromo.enabled);
  const [coins, setCoins] = React.useState(String(welcome.coins ?? 0));
  const [xp, setXp] = React.useState(String(welcome.xp ?? 0));
  const [welcomeTitle, setWelcomeTitle] = React.useState(welcome.title ?? "");
  const [links, setLinks] = React.useState<Record<string, string>>({
    discord: social.discord ?? "",
    x: social.x ?? "",
    instagram: social.instagram ?? "",
    telegram: social.telegram ?? "",
  });

  function save(key: string, value: Json) {
    startTransition(async () => {
      const result = await updateSettingAction({ key, value });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Saved");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* maintenance */}
      <GlassCard className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-bold">Maintenance mode</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Show a site-wide maintenance banner to all visitors.
            </p>
          </div>
          <Switch
            checked={maintEnabled}
            onCheckedChange={setMaintEnabled}
            aria-label="Maintenance mode"
          />
        </div>
        <div className="mt-4 space-y-2">
          <Label htmlFor="maint-msg">Banner message</Label>
          <Input
            id="maint-msg"
            value={maintMsg}
            onChange={(e) => setMaintMsg(e.target.value)}
            placeholder="We'll be back shortly…"
          />
        </div>
        <Button
          size="sm"
          className="mt-4"
          disabled={pending}
          onClick={() =>
            save("maintenance_mode", { enabled: maintEnabled, message: maintMsg })
          }
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Save
        </Button>
      </GlassCard>

      {/* registration */}
      <GlassCard className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-bold">Registration</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Allow new members to sign up.
            </p>
          </div>
          <Switch
            checked={regOpen}
            onCheckedChange={setRegOpen}
            aria-label="Registration open"
          />
        </div>
        <Button
          size="sm"
          className="mt-4"
          disabled={pending}
          onClick={() => save("registration_open", { enabled: regOpen })}
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Save
        </Button>
      </GlassCard>

      {/* telegram promo broadcast */}
      <GlassCard className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-bold">Telegram promo broadcast</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Toggle saves automatically. The pool below must have active messages —
              the cron rotates through them, posting the longest-unsent one each run.
            </p>
          </div>
          <Switch
            checked={promoEnabled}
            onCheckedChange={(checked) => {
              setPromoEnabled(checked);
              save("telegram_promo", { enabled: checked });
            }}
            aria-label="Telegram promo broadcast enabled"
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            disabled={pending}
            onClick={() => save("telegram_promo", { enabled: promoEnabled })}
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Save
          </Button>
          <ConfirmActionButton
            action={sendTelegramPromoNowAction}
            title="Send promo to Telegram now?"
            description="Posts the next message in the rotation pool to your promo channel immediately (same as the hourly cron)."
            confirmLabel="Send now"
            triggerLabel="Send test now"
            variant="outline"
          />
        </div>
      </GlassCard>

      {/* welcome bonus */}
      <GlassCard className="p-6">
        <h2 className="font-bold">Welcome bonus</h2>
        <p className="mt-1 mb-4 text-xs text-muted-foreground">
          Granted once when a member completes their profile.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="wb-coins">Coins</Label>
            <Input
              id="wb-coins"
              type="number"
              min={0}
              value={coins}
              onChange={(e) => setCoins(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wb-xp">XP</Label>
            <Input
              id="wb-xp"
              type="number"
              min={0}
              value={xp}
              onChange={(e) => setXp(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wb-title">Title</Label>
            <Input
              id="wb-title"
              value={welcomeTitle}
              onChange={(e) => setWelcomeTitle(e.target.value)}
            />
          </div>
        </div>
        <Button
          size="sm"
          className="mt-4"
          disabled={pending}
          onClick={() =>
            save("welcome_bonus", {
              coins: Number(coins),
              xp: Number(xp),
              title: welcomeTitle,
            })
          }
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Save
        </Button>
      </GlassCard>

      {/* social links */}
      <GlassCard className="p-6">
        <h2 className="font-bold">Social links</h2>
        <p className="mt-1 mb-4 text-xs text-muted-foreground">
          Shown in the public site footer.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {(["discord", "x", "instagram", "telegram"] as const).map((key) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={`social-${key}`} className="capitalize">
                {key}
              </Label>
              <Input
                id={`social-${key}`}
                value={links[key]}
                onChange={(e) =>
                  setLinks((prev) => ({ ...prev, [key]: e.target.value }))
                }
                placeholder="https://…"
              />
            </div>
          ))}
        </div>
        <Button
          size="sm"
          className="mt-4"
          disabled={pending}
          onClick={() => save("social_links", links)}
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Save
        </Button>
      </GlassCard>
    </div>
  );
}
