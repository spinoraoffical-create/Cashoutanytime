import { HomeLandingShell } from "@/components/home/home-landing-shell";
import { getLinkedGameSlugs } from "@/lib/data/dashboard";
import { getGames } from "@/lib/data/marketing";
import { getActivePromotions } from "@/lib/data/promotions-public";
import { buildLobbyCatalog } from "@/lib/games-marketing";
import { DAILY_SPIN_ENABLED } from "@/lib/constants";
import { getAuthUser, getProfile } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getAuthUser();
  const profile = user ? await getProfile() : null;
  const [linkedGameSlugs, dbGames, promotions] = await Promise.all([
    user ? getLinkedGameSlugs(user.id) : Promise.resolve([] as string[]),
    getGames(),
    getActivePromotions().catch(() => [] as Awaited<ReturnType<typeof getActivePromotions>>),
  ]);

  const lobbyCatalog = buildLobbyCatalog(dbGames);
  const row = profile as typeof profile & { kyc_status?: string | null };
  const needsPhone = Boolean(row && !row.phone);
  const needsKyc = Boolean(row && row.kyc_status && row.kyc_status !== "verified");
  const verify =
    needsPhone || needsKyc
      ? {
          show: true,
          href: "/dashboard/kyc",
          title: needsPhone
            ? "Add your phone to keep cash-outs moving"
            : "Finish verification to keep cash-outs moving",
          body: "Email, phone, and ID when required.",
        }
      : null;

  return (
    <HomeLandingShell
      linkedGameSlugs={linkedGameSlugs}
      lobbyCatalog={lobbyCatalog}
      promotions={promotions}
      wallet={{
        balance: Number(profile?.wallet_balance ?? 0),
        cashout: Number(profile?.cashout_wallet ?? 0),
        freeplay: Number(profile?.bonus_wallet ?? 0),
      }}
      verify={verify}
      dailySpinEnabled={DAILY_SPIN_ENABLED}
      initialLoggedIn={Boolean(user)}
    />
  );
}
