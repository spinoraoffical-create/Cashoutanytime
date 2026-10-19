"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { resolveCashoutHoldAction } from "@/lib/actions/auto-ops";
import { Button } from "@/components/ui/button";

export function CashoutHoldActions({ holdId }: { holdId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  function run(decision: "released" | "rejected") {
    const label = decision === "released" ? "approve" : "reject";
    if (!window.confirm(`Are you sure you want to ${label} this held cash out?`)) return;
    setBusy(true);
    void resolveCashoutHoldAction(holdId, decision).then((result) => {
      setBusy(false);
      if (!result.ok) toast.error(result.error ?? "Could not update that hold.");
      else {
        toast.success(result.message ?? "Saved.");
        router.refresh();
      }
    });
  }

  return (
    <div className="mt-2 flex justify-end gap-2">
      <Button type="button" size="sm" disabled={busy} onClick={() => run("released")}>
        Approve
      </Button>
      <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => run("rejected")}>
        Reject
      </Button>
    </div>
  );
}
