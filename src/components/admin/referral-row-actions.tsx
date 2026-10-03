"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { setReferralStatusAction } from "@/lib/actions/admin/economy";

export function ReferralRowActions({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function act(status: "qualified" | "rejected") {
    startTransition(async () => {
      const result = await setReferralStatusAction({
        id,
        status,
        reason: status === "rejected" ? "Rejected on manual review" : undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Updated");
      router.refresh();
    });
  }

  return (
    <div className="flex justify-end gap-1.5">
      <Button
        variant="outline"
        size="sm"
        onClick={() => act("qualified")}
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Check className="size-4 text-ws-emerald" aria-hidden />
        )}
        Approve
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => act("rejected")}
        disabled={pending}
        className="hover:text-ws-danger"
      >
        <X className="size-4" aria-hidden />
        Reject
      </Button>
    </div>
  );
}
