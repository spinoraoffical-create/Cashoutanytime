"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

const WalletCardLoader = dynamic(
  () =>
    import("@/components/wallet/wallet-card-loader").then((m) => ({
      default: m.WalletCardLoader,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        className="wallet-card animate-pulse h-[100px] rounded-b-2xl bg-purple-950/40 border border-purple-500/20"
        aria-hidden
      />
    ),
  }
);

interface DeferredWalletCardLoaderProps {
  className?: string;
  refreshKey?: number;
}

export function DeferredWalletCardLoader(props: DeferredWalletCardLoaderProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const start = () => setShow(true);
    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(start, { timeout: 400 });
      return () => cancelIdleCallback(id);
    }
    const timer = setTimeout(start, 150);
    return () => clearTimeout(timer);
  }, []);

  if (!show) {
    return (
      <div
        className={cn(
          "wallet-card animate-pulse h-[100px] rounded-b-2xl bg-purple-950/40 border border-purple-500/20",
          props.className
        )}
        aria-hidden
      />
    );
  }

  return <WalletCardLoader {...props} />;
}
