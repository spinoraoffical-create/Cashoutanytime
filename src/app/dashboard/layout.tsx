import { Suspense } from "react";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { LobbyAccountSidebar } from "@/components/home/lobby/lobby-account-sidebar";
import { CompleteProfilePrompt } from "@/components/auth/complete-profile-prompt";
import { WalletCardWithSync } from "@/components/wallet/wallet-card-with-sync";
import { DashboardProfileProvider } from "@/lib/dashboard/dashboard-profile-context";
import { DashboardRoutePrefetch } from "@/components/dashboard/dashboard-route-prefetch";
import { getAuthUser, getProfile } from "@/lib/supabase/session";
import { walletBalanceFromProfile } from "@/lib/wallet/map-profile-wallet";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const emailConfirmed = Boolean(user.email_confirmed_at ?? user.confirmed_at);
  if (!emailConfirmed) {
    redirect("/login?error=email_not_confirmed");
  }

  const profile = await getProfile();
  if (!profile || profile.is_suspended) redirect("/login");

  const needsPhone = !profile?.phone;
  const email = profile?.email || user.email || "";
  const initialWallet = walletBalanceFromProfile(profile);

  const sidebar = (
    <LobbyAccountSidebar walletSlot={<WalletCardWithSync initial={initialWallet} />} />
  );

  return (
    <DashboardProfileProvider userId={user.id} profile={profile}>
      <DashboardRoutePrefetch />
      <Suspense fallback={null}>
        <DashboardShell sidebar={sidebar}>
          {needsPhone && email && !email.endsWith("@phone.spinora.local") && (
            <CompleteProfilePrompt email={email} fullName={profile?.full_name} />
          )}
          {children}
        </DashboardShell>
      </Suspense>
    </DashboardProfileProvider>
  );
}
