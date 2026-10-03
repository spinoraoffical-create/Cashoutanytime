import type { WalletBalance } from "@/lib/actions/wallet";
import type { Profile } from "@/types/database";

export function walletBalanceFromProfile(
  profile: Pick<
    Profile,
    "wallet_balance" | "bonus_wallet" | "cashout_wallet" | "bonus_redeem_wallet"
  >
): WalletBalance {
  return {
    walletBalance: Number(profile.wallet_balance ?? 0),
    bonusWallet: Number(profile.bonus_wallet ?? 0),
    cashoutWallet: Number(profile.cashout_wallet ?? 0),
    bonusRedeemWallet: Number(profile.bonus_redeem_wallet ?? 0),
  };
}
