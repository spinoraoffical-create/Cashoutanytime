export type WalletType = "current" | "bonus" | "cashout" | "bonus_redeem";

export function walletTypeLabel(walletType: WalletType): string {
  switch (walletType) {
    case "bonus":
      return "Bonus Wallet";
    case "cashout":
      return "Deposit Redeem";
    case "bonus_redeem":
      return "Bonus Redeem";
    default:
      return "Total Deposit";
  }
}
