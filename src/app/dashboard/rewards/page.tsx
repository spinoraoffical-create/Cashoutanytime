import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { RewardsClaimList } from "@/components/dashboard/rewards-claim-list";
import { WelcomeCoins } from "@/components/dashboard/welcome-coins";
import { getDashboardCore, getRewardsOverview } from "@/lib/data/dashboard";
import { loadLoyaltyPlayerView } from "@/lib/data/loyalty-status";

export default async function DashboardRewardsPage() {
  const { profile, tier } = await getDashboardCore();
  const { streams } = await getRewardsOverview(
    profile,
    Number(tier?.reward_multiplier ?? 1)
  );
  const loyalty = await loadLoyaltyPlayerView(profile.id);

  return (
    <div>
      <DashboardPageHeader
        title="Rewards"
        description="Daily, weekly, and monthly claims pay $1 freeplay and 50 VIP points while that check-in is on. Coins are separate and are not cash."
      />
      {loyalty.legacyFreeplay ? (
        <RewardsClaimList streams={streams} />
      ) : (
        <p className="mb-4 text-sm text-muted-foreground">The $1 freeplay check-in is turned off.</p>
      )}
      <WelcomeCoins
        balance={Number(profile.coins_balance ?? 0)}
        vipName={tier?.name ?? "Member"}
        installed={loyalty.installed}
        earning={loyalty.earning}
        budgetOpen={loyalty.budgetOpen}
        phoneReady={process.env.PHONE_OTP_SENDING_ENABLED === "true" && Boolean(process.env.TWILIO_ACCOUNT_SID?.trim() && process.env.TWILIO_AUTH_TOKEN?.trim() && process.env.TWILIO_FROM_NUMBER?.trim() && process.env.PHONE_OTP_PEPPER?.trim())}
        telegramReady={Boolean(process.env.TELEGRAM_MEMBERSHIP_BOT_TOKEN?.trim() && process.env.TELEGRAM_COMMUNITY_CHAT_ID?.trim())}
        tasks={loyalty.tasks}
        history={loyalty.history}
      />
    </div>
  );
}
