"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useDashboardProfile } from "@/lib/dashboard/dashboard-profile-context";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Session from layout context or local storage — no extra network on dashboard navigation */
export function useDashboardSession() {
  const dashboardProfile = useDashboardProfile();
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(dashboardProfile?.userId ?? null);
  const [ready, setReady] = useState(Boolean(dashboardProfile));

  useEffect(() => {
    if (dashboardProfile) {
      setUserId(dashboardProfile.userId);
      setReady(true);
      return;
    }

    if (!supabase) {
      setReady(true);
      return;
    }

    let cancelled = false;

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled) {
        setUserId(user?.id ?? null);
        setReady(true);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setUserId(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase, dashboardProfile]);

  return { supabase: supabase as SupabaseClient | null, userId, ready };
}
