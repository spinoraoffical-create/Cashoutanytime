import { Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

interface WalletCardProps {
  walletBalance: number;
  cashoutWallet: number;
  className?: string;
}

function formatMoney(amount: number) {
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function WalletCard({
  walletBalance,
  cashoutWallet,
  className,
}: WalletCardProps) {
  const columns = [
    { label: "Total Deposit", value: walletBalance },
    { label: "Deposit Redeem", value: cashoutWallet },
  ] as const;

  return (
    <div className={cn("wallet-card relative pt-5", className)}>
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
      <div className="absolute -top-0 left-1/2 -translate-x-1/2 z-10">
        <div className="wallet-card-notch" />
        <div className="absolute left-1/2 top-3 -translate-x-1/2 w-9 h-9 rounded-full bg-[#1a1030] border-2 border-amber-500/80 flex items-center justify-center shadow-lg shadow-amber-500/20">
          <Wallet className="h-4 w-4 text-amber-400" />
        </div>
      </div>

      <div className="wallet-card-body grid grid-cols-2 gap-y-3 pt-6 pb-4 px-0.5">
        {columns.map((col, index) => (
          <div
            key={col.label}
            className={cn(
              "flex min-w-0 flex-col items-center text-center px-0.5 sm:px-1",
              index === 0 && "border-r border-white/10"
            )}
          >
            <div className="flex h-9 w-full items-center justify-center">
              <p className="text-[10px] sm:text-[11px] text-white/70 leading-snug text-balance">
                {col.label}
              </p>
            </div>
            <p className="text-base sm:text-lg font-bold text-amber-400 tabular-nums leading-none">
              {formatMoney(col.value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
