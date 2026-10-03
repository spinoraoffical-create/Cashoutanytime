"use client";

import { WalletCard } from "@/components/wallet/wallet-card";
import type { WalletBalance } from "@/lib/actions/wallet";
import { useLiveWallet } from "@/lib/wallet/use-live-wallet";

interface WalletCardWithSyncProps {
  initial: WalletBalance;
  className?: string;
}

/** Renders wallet instantly from server data; syncs via realtime + manual refresh only. */
export function WalletCardWithSync({ initial, className }: WalletCardWithSyncProps) {
  const { wallet } = useLiveWallet(initial);

  return (
    <WalletCard
      walletBalance={(wallet ?? initial).walletBalance}
      cashoutWallet={(wallet ?? initial).cashoutWallet}
      className={className}
    />
  );
}
