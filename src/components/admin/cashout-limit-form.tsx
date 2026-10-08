"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { setCashoutLimitAction } from "@/lib/actions/auto-ops";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CashoutLimitForm({ limit }: { limit: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-2xl border border-border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const amount = Number(new FormData(event.currentTarget).get("limit"));
        if (!window.confirm(`Set the automatic cash-out limit to $${amount.toFixed(2)}?`)) return;
        setBusy(true);
        void setCashoutLimitAction(amount).then((result) => {
          setBusy(false);
          if (!result.ok) toast.error(result.error ?? "Could not save.");
          else {
            toast.success(result.message ?? "Saved.");
            router.refresh();
          }
        });
      }}
    >
      <label className="text-sm">
        Automatic limit ($)
        <Input name="limit" type="number" min={0} step="0.01" defaultValue={limit} className="mt-1 w-40" />
      </label>
      <Button type="submit" disabled={busy}>Save rule</Button>
    </form>
  );
}
