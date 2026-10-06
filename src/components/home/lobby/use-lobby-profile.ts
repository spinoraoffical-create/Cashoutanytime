"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLiveWallet } from "@/lib/wallet/use-live-wallet";
import { useBalanceMask } from "@/lib/wallet/balance-mask";
import { PROFILE_UPDATED_EVENT, type ProfileUpdatedDetail } from "@/lib/profile/events";

export interface LobbyProfile {
  name: string;
  avatarUrl: string | null;
  level: number;
  xp: number;
  vipTier: string;
  kycStatus: string | null;
  email: string | null;
}

export function useLobbyProfile() {
  const { wallet, hidden: walletHidden } = useLiveWallet();
  const { masked, toggle: toggleBalances } = useBalanceMask();
  const [profile, setProfile] = useState<LobbyProfile | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setReady(true);
      return;
    }

    let cancelled = false;

    async function load() {
      if (!supabase) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;

      const loggedIn = !!user;
      setIsLoggedIn(loggedIn);

      if (!user) {
        setReady(true);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, vip_tier, vip_points, level, xp, kyc_status, email")
        .eq("id", user.id)
        .single();

      if (cancelled) return;

      const row = data as Record<string, unknown> | null;
      const emailName = user.email?.split("@")[0] ?? "Player";
      const meta = user.user_metadata ?? {};
      setProfile({
        name: (meta.full_name as string) || (meta.display_name as string) || (row?.full_name as string) || emailName,
        avatarUrl: (meta.avatar_url as string) || (row?.avatar_url as string) || null,
        level: Number(row?.level ?? 1),
        xp: Number(row?.xp ?? row?.vip_points ?? 0),
        vipTier: String(row?.vip_tier ?? "bronze"),
        kycStatus: (row?.kyc_status as string) || null,
        email: (row?.email as string) || user.email || null,
      });
      setReady(true);
    }

    void load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setIsLoggedIn(false);
        setProfile(null);
      } else if (event === "SIGNED_IN") {
        void load();
      }
    });

    function onProfileUpdated(event: Event) {
      const detail = (event as CustomEvent<ProfileUpdatedDetail>).detail;
      if (!detail?.name) return;
      setProfile((prev) =>
        prev
          ? { ...prev, name: detail.name, avatarUrl: detail.avatarUrl || prev.avatarUrl }
          : prev
      );
    }
    window.addEventListener(PROFILE_UPDATED_EVENT, onProfileUpdated);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.removeEventListener(PROFILE_UPDATED_EVENT, onProfileUpdated);
    };
  }, []);

  const levelProgress = profile
    ? Math.min(100, ((profile.xp % 1000) / 1000) * 100)
    : 0;

  return {
    isLoggedIn,
    ready,
    profile,
    wallet,
    walletHidden,
    balancesHidden: walletHidden || masked,
    toggleBalances,
    levelProgress,
    displayName: profile?.name ?? "Sweepstakes Hub VIP",
    balance: wallet?.walletBalance ?? 0,
    fpBalance: wallet?.bonusWallet ?? profile?.xp ?? 0,
  };
}
