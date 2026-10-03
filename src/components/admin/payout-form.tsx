"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { payoutCashout } from "@/lib/actions/admin/payouts";

export function PayoutForm({
  userId,
  maxAmount,
  playerName,
}: {
  userId: string;
  maxAmount: number;
  playerName: string;
}) {
  const [pending, start] = React.useTransition();
  const formRef = React.useRef<HTMLFormElement>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const amount = Number(data.get("amount"));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a payout amount greater than $0.");
      return;
    }
    if (amount > maxAmount + 0.001) {
      toast.error(`Max payout for ${playerName} is $${maxAmount.toFixed(2)}.`);
      return;
    }
    data.set("user_id", userId);
    start(async () => {
      const res = await payoutCashout(data);
      if (res.ok) {
        toast.success(res.message ?? "Payout recorded.");
        formRef.current?.reset();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          $
        </span>
        <Input
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          max={maxAmount}
          defaultValue={maxAmount.toFixed(2)}
          className="h-9 w-28 pl-5"
          aria-label={`Payout amount for ${playerName}`}
        />
      </div>
      <Input
        name="note"
        type="text"
        placeholder="Note (e.g. CashApp)"
        className="h-9 w-40"
        maxLength={120}
        aria-label="Payout note"
      />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : "Mark paid"}
      </Button>
    </form>
  );
}
