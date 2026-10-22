import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/** Coins for a confirmed deposit. A missing function or an off switch pays nothing and does not change the deposit. */
export async function tryGrantDepositCoins(
  admin: Admin,
  userId: string,
  depositKey: string,
  dollars: number,
): Promise<void> {
  try {
    if (!userId || !depositKey || !(dollars > 0)) return;
    await admin.rpc("grant_deposit_loyalty_coins", {
      p_user: userId,
      p_deposit_key: depositKey,
      p_dollars: dollars,
    });
  } catch {
    /* The deposit credit has already been recorded. */
  }
}

/** Claw back Coins after a confirmed refund. Never changes the dollar reversal. */
export async function tryReverseDepositCoins(
  admin: Admin,
  depositKey: string,
  reversalKey: string,
  dollars: number,
): Promise<void> {
  try {
    if (!depositKey || !reversalKey || !(dollars > 0)) return;
    await admin.rpc("reverse_deposit_loyalty_coins", {
      p_deposit_key: depositKey,
      p_reversal_key: reversalKey,
      p_dollars: dollars,
    });
  } catch {
    /* The dollar refund has already been recorded. */
  }
}
