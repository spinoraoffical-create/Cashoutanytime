"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLiveWallet } from "@/lib/wallet/use-live-wallet";

export interface LobbyProfile {
  name: string;
  avatarUrl: string | null;
  level: number;
  xp: number;
  vipTier: string;
}

export function useLobbyProfile() {
  const { wallet, hidden: walletHidden } = useLiveWallet();
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
        .select("full_name, avatar_url, vip_tier, vip_points, level, xp")
        .eq("id", user.id)
        .single();

      if (cancelled) return;

      const row = data as Record<string, unknown> | null;
      const emailName = user.email?.split("@")[0] ?? "Player";
      setProfile({
        name: (row?.full_name as string) || emailName,
        avatarUrl: (row?.avatar_url as string) || null,
        level: Number(row?.level ?? 1),
        xp: Number(row?.xp ?? row?.vip_points ?? 0),
        vipTier: String(row?.vip_tier ?? "bronze"),
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

    return () => {
      cancelled = true;
      subscription.unsubscribe();
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
    levelProgress,
    displayName: profile?.name ?? "Spinora VIP",
    balance: wallet?.walletBalance ?? 0,
    fpBalance: wallet?.bonusWallet ?? profile?.xp ?? 0,
  };
}
