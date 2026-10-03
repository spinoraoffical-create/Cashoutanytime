"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { recomputeLeaderboardsAction } from "@/lib/actions/admin/economy";

export function RecomputeButton() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function run() {
    startTransition(async () => {
      const result = await recomputeLeaderboardsAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Recomputed");
      router.refresh();
    });
  }

  return (
    <Button onClick={run} disabled={pending} variant="outline">
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <RefreshCw className="size-4" aria-hidden />
      )}
      Recompute now
    </Button>
  );
}
