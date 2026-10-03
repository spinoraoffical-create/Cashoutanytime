"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useDashboardProfile } from "@/lib/dashboard/dashboard-profile-context";

/** Refreshes My Games when accounts or bot jobs change. */
export function MyGamesLiveRefresh() {
  const router = useRouter();
  const profile = useDashboardProfile();

  useEffect(() => {
    const userId = profile?.userId;
    if (!userId) return;

    const supabase = createClient();
    if (!supabase) return;

    const channel = supabase
      .channel(`my-games-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_accounts", filter: `user_id=eq.${userId}` },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_load_requests", filter: `user_id=eq.${userId}` },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile?.userId, router]);

  return null;
}
