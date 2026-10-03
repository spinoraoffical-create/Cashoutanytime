"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { celebrate } from "@/components/dashboard/celebration-popup";
import {
  claimPromotionAction,
  claimRewardAction,
} from "@/lib/actions/rewards";

export function ClaimButton({
  ruleKey,
  promoSlug,
  claimed,
  eligible = true,
  ineligibleHint,
  size = "default",
  className,
  children,
}: {
  ruleKey?: string;
  promoSlug?: string;
  claimed: boolean;
  eligible?: boolean;
  ineligibleHint?: string;
  size?: "default" | "sm" | "lg";
  className?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function claim() {
    startTransition(async () => {
      const result = ruleKey
        ? await claimRewardAction(ruleKey)
        : promoSlug
          ? await claimPromotionAction(promoSlug)
          : null;

      if (!result) return;

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      const coins = result.coins ?? 0;
      const xp = result.xp ?? 0;
      const multiplier = result.multiplier ?? 1;

      const parts: string[] = [];
      if (coins > 0) parts.push(`${coins.toLocaleString()} Rewards`);
      if (xp > 0) parts.push(`${xp.toLocaleString()} XP`);
      toast.success(
        `Claimed: ${parts.join(" + ")}${
          multiplier > 1 ? ` (${multiplier}× VIP boost applied)` : ""
        }`
      );
      if (parts.length > 0) {
        celebrate({
          type: "win",
          title: "Reward claimed!",
          detail: `${parts.join(" + ")}${multiplier > 1 ? ` · ${multiplier}× VIP boost` : ""}`,
        });
      }
      router.refresh();
    });
  }

  if (claimed) {
    return (
      <Button variant="outline" size={size} className={className} disabled>
        <Check className="size-4 text-ws-emerald" aria-hidden />
        Claimed
      </Button>
    );
  }

  return (
    <Button
      size={size}
      className={className}
      onClick={claim}
      disabled={pending || !eligible}
      title={!eligible ? ineligibleHint : undefined}
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending ? "Claiming…" : (children ?? "Claim")}
    </Button>
  );
}
