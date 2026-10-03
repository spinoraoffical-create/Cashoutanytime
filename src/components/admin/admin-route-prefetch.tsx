"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const ADMIN_ROUTES = [
  "/admin",
  "/admin/chat",
  "/admin/users",
  "/admin/fraud",
  "/admin/transactions",
  "/admin/game-loads",
  "/admin/deposits",
  "/admin/reviews",
  "/admin/analytics",
];

export function AdminRoutePrefetch() {
  const router = useRouter();

  useEffect(() => {
    for (const href of ADMIN_ROUTES) {
      router.prefetch(href);
    }
  }, [router]);

  return null;
}
