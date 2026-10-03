"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminGrantWallet,
  adminDeductWallet,
  adminResetWallet,
} from "@/lib/actions/wallet";
import { walletTypeLabel, type WalletType } from "@/lib/wallet/types";
import { toast } from "sonner";

interface AdminWalletGrantProps {
  userId: string;
}

export function AdminWalletGrant({ userId }: AdminWalletGrantProps) {
  const [amount, setAmount] = useState("5");
  const [walletType, setWalletType] = useState<WalletType>("current");
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();

  const label = walletTypeLabel(walletType);
  const parsedAmount = parseFloat(amount);

  async function handleGrant() {
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setLoading("grant");
    const result = await adminGrantWallet(userId, parsedAmount, walletType);
    if (result.error) toast.error(result.error);
    else toast.success(`Added $${parsedAmount} to ${label}`);
    router.refresh();
    setLoading(null);
  }

  async function handleResetByAmount() {
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error("Enter how much to reset from the wallet");
      return;
    }
    setLoading("reset");
    const result = await adminDeductWallet(
      userId,
      parsedAmount,
      walletType,
      `Admin reset $${parsedAmount} from ${walletType} wallet`
    );
    if (result.error) toast.error(result.error);
    else toast.success(`Reset $${parsedAmount} from ${label}`);
    router.refresh();
    setLoading(null);
  }

  async function handleClearAll() {
    const ok = window.confirm(`Clear entire ${label} to $0? This removes the full balance.`);
    if (!ok) return;

    setLoading("clear");
    const result = await adminResetWallet(userId, walletType);
    if (result.error) toast.error(result.error);
    else toast.success(`${label} cleared to $0`);
    router.refresh();
    setLoading(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Amount</label>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-24 h-8 text-sm"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Wallet</label>
          <select
            value={walletType}
            onChange={(e) => setWalletType(e.target.value as WalletType)}
            className="h-8 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="current">Total Deposit</option>
            <option value="cashout">Deposit Redeem</option>
          </select>
        </div>
        <Button size="sm" variant="outline" onClick={handleGrant} disabled={!!loading}>
          {loading === "grant" ? "..." : "Grant $"}
        </Button>
        <Button size="sm" variant="destructive" onClick={handleResetByAmount} disabled={!!loading}>
          {loading === "reset" ? "..." : parsedAmount > 0 ? `Reset $${parsedAmount}` : "Reset $"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleClearAll}
          disabled={!!loading}
          className="border-destructive/50 text-destructive hover:bg-destructive/10"
        >
          {loading === "clear" ? "..." : "Clear all ($0)"}
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Reset $ removes the entered amount from the wallet. Clear all ($0) wipes the full balance.
      </p>
    </div>
  );
}
