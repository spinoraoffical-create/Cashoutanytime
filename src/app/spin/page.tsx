import { VipPageLayout } from "@/components/layout/vip-page-layout";
import { SpinPageClient } from "@/components/spin/spin-page-client";
import { SpinComingSoon } from "@/components/spin/spin-coming-soon";
import { createMetadata } from "@/lib/seo/metadata";
import { createClient } from "@/lib/supabase/server";
import { getSpinStatus, getSpinHistory } from "@/lib/actions/spin";
import { DAILY_SPINS_BY_TIER } from "@/lib/spin/prizes";
import { DAILY_SPIN_ENABLED } from "@/lib/constants";

export const metadata = createMetadata({
  title: "Spin the Wheel",
  description:
    "Spin the Spinora prize wheel and win cash bonuses, VIP points, and exclusive rewards. Free daily spins for all members.",
  keywords: ["spin wheel", "casino rewards", "free spins", "Spinora prizes", "VIP bonuses"],
  path: "/spin",
});

export default async function SpinPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let dailyLimit = 1;
  let remaining = 0;
  let nextFreeSpinMs: number | null = null;
  let history: Awaited<ReturnType<typeof getSpinHistory>> = [];

  if (user) {
    const [status, historyResult] = await Promise.all([getSpinStatus(), getSpinHistory()]);
    if (!("error" in status)) {
      dailyLimit = status.dailyLimit;
      remaining = status.remaining;
      nextFreeSpinMs = status.nextFreeSpinMs;
    }
    history = historyResult;
  } else {
    dailyLimit = DAILY_SPINS_BY_TIER.bronze;
    remaining = 0;
  }

  return (
    <VipPageLayout contentClassName="vip-page-content mx-auto max-w-4xl py-4 px-2">
      {DAILY_SPIN_ENABLED ? (
        <SpinPageClient
          isLoggedIn={!!user}
          dailyLimit={dailyLimit}
          remainingSpins={remaining}
          nextFreeSpinMs={nextFreeSpinMs}
          history={history}
        />
      ) : (
        <SpinComingSoon />
      )}
    </VipPageLayout>
  );
}
