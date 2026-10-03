"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Gift, Loader2 } from "lucide-react";

import { claimRewardAction } from "@/lib/actions/rewards";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { StreamState } from "@/lib/data/dashboard";

export function RewardsClaimList({
  streams,
  multiplier,
}: {
  streams: StreamState[];
  multiplier: number;
}) {
  const [pending, startTransition] = useTransition();

  function claim(key: string) {
    startTransition(async () => {
      const result = await claimRewardAction(key);
      if (result.ok) {
        toast.success("Reward claimed!");
      } else {
        toast.error(result.error ?? "Could not claim reward.");
      }
    });
  }

  if (streams.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          No reward streams configured yet. Check back soon.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {streams.map(({ rule, claimed, progress, reached }) => {
        const canClaim =
          !claimed && (rule.reward_type !== "streak_milestone" || reached !== false);
        const pct =
          progress && progress.required > 0
            ? Math.round((progress.current / progress.required) * 100)
            : 0;

        return (
          <Card key={rule.key}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{rule.name}</CardTitle>
                <Gift className="h-5 w-5 text-orange-400 shrink-0" />
              </div>
              <p className="text-sm text-muted-foreground">{rule.description}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">
                <span className="text-orange-400 font-semibold">
                  +{Math.round(rule.coins * multiplier).toLocaleString()} coins
                </span>
                {rule.xp > 0 && (
                  <span className="text-muted-foreground"> · +{rule.xp} XP</span>
                )}
              </p>
              {progress && progress.required > 0 && (
                <div className="space-y-1">
                  <Progress value={pct} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {progress.current}/{progress.required} daily claims this period
                  </p>
                </div>
              )}
              <Button
                size="sm"
                disabled={!canClaim || pending}
                onClick={() => claim(rule.key)}
                className="w-full"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : claimed ? (
                  "Already claimed"
                ) : (
                  "Claim"
                )}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
