"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** High-traffic routes first; stagger idle prefetch to avoid blocking main thread. */
const DASHBOARD_ROUTES = [
  "/dashboard",
  "/dashboard/wallet",
  "/dashboard/games",
  "/dashboard/messages",
  "/dashboard/deposit",
  "/dashboard/rewards",
  "/dashboard/activity",
  "/spin",
  "/dashboard/vip",
  "/dashboard/referrals",
  "/dashboard/reviews",
  "/dashboard/deposits",
];

/** Warm route bundles during idle time so clicks still feel instant. */
export function usePrefetchDashboardRoutes() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let index = 0;

    const prefetchNext = () => {
      if (cancelled || index >= DASHBOARD_ROUTES.length) return;
      router.prefetch(DASHBOARD_ROUTES[index]);
      index += 1;
      if (index < DASHBOARD_ROUTES.length) {
        if ("requestIdleCallback" in window) {
          window.requestIdleCallback(prefetchNext, { timeout: 3000 });
        } else {
          setTimeout(prefetchNext, 400);
        }
      }
    };

    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(prefetchNext, { timeout: 5000 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(id);
      };
    }

    const startId = setTimeout(prefetchNext, 2000);
    return () => {
      cancelled = true;
      clearTimeout(startId);
    };
  }, [router]);
}
