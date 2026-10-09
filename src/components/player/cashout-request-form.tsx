"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CashoutRequestForm({
  balance,
  methods,
}: {
  balance: number;
  methods: { value: string; name: string }[];
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(methods[0]?.value || "");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!method) {
      toast.error("Cash out is temporarily unavailable.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/payments/paydora/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          amount: Number(amount),
          address,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string; status?: string; held?: boolean } | null;
      if (data?.held) {
        toast.message(data.error || "This cash out is waiting for a Super Admin.");
        return;
      }
      if (!res.ok) {
        toast.error(data?.error || "Could not submit that cash out.");
        return;
      }
      if (data?.status === "already_submitted") toast.message("already submitted");
      else if (data?.status === "pending" || data?.error === "pending") toast.message("pending");
      else toast.success("Cash out submitted.");
      setAmount("");
      setAddress("");
    } catch {
      toast.error("Could not submit that cash out.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form id="cashout" onSubmit={(event) => void submit(event)} className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        Cash-out balance ${balance.toFixed(2)}. This spends cash-out winnings, not the deposit wallet.
      </p>
      <label className="grid gap-1 text-sm">
        Amount
        <input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          required
          className="rounded-xl border border-border bg-background px-3 py-2"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Method
        <select
          value={method}
          onChange={(event) => setMethod(event.target.value)}
          className="rounded-xl border border-border bg-background px-3 py-2"
          required
        >
          {methods.map((item) => (
            <option key={item.value} value={item.value}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Account
        <input
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          required
          className="rounded-xl border border-border bg-background px-3 py-2"
        />
      </label>
      <Button type="submit" disabled={busy || methods.length === 0} className="w-fit">
        {busy ? "Sending" : "Cash Out"}
      </Button>
    </form>
  );
}
