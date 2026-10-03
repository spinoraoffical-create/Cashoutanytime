import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { RewardsClaimList } from "@/components/dashboard/rewards-claim-list";
import { getDashboardCore, getRewardsOverview } from "@/lib/data/dashboard";

export default async function DashboardRewardsPage() {
  const { profile, tier } = await getDashboardCore();
  const { streams } = await getRewardsOverview(
    profile,
    Number(tier?.reward_multiplier ?? 1)
  );

  return (
    <div>
      <DashboardPageHeader
        title="Rewards"
        description="Claim daily, weekly, and milestone bonuses. VIP tier boosts your payouts."
      />
      <RewardsClaimList
        streams={streams}
        multiplier={Number(tier?.reward_multiplier ?? 1)}
      />
    </div>
  );
}
