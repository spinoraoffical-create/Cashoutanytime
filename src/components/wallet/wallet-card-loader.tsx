"use client";

import { useEffect } from "react";
import { WalletCard } from "@/components/wallet/wallet-card";
import type { WalletBalance } from "@/lib/actions/wallet";
import { cn } from "@/lib/utils";
import { useLiveWallet, WALLET_REFRESH_EVENT } from "@/lib/wallet/use-live-wallet";

export { WALLET_REFRESH_EVENT };

interface WalletCardLoaderProps {
  className?: string;
  refreshKey?: number;
  /** Preloaded from server layout — skips the first client fetch */
  initialWallet?: WalletBalance;
}

export function WalletCardLoader({
  className,
  refreshKey = 0,
  initialWallet,
}: WalletCardLoaderProps) {
  const { wallet, hidden, refresh } = useLiveWallet(initialWallet ?? null);

  useEffect(() => {
    if (refreshKey > 0) void refresh();
  }, [refreshKey, refresh]);

  if (hidden) return null;

  if (!wallet) {
    return (
      <div
        className={cn(
          "wallet-card animate-pulse h-[100px] rounded-b-2xl bg-purple-950/40 border border-purple-500/20",
          className
        )}
      />
    );
  }

  return (
    <WalletCard
      walletBalance={wallet.walletBalance}
      cashoutWallet={wallet.cashoutWallet}
      className={className}
    />
  );
}
