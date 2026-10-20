"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Analytics } from "@vercel/analytics/react";
import { analyticsConsentGranted, trackPublicEvent } from "@/lib/analytics/public-events";

const GOOGLE_FAIL_REASONS = new Set([
  "google_failed",
  "google_cancelled",
  "google_email_exists",
  "auth_callback_failed",
  "email_not_confirmed",
]);

/** Page views load only after the existing cookie notice is accepted. */
export function ConsentAnalytics() {
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const sync = () => setEnabled(analyticsConsentGranted());
    sync();
    window.addEventListener("sth-analytics-consent", sync);
    return () => window.removeEventListener("sth-analytics-consent", sync);
  }, []);

  useEffect(() => {
    if (!enabled || pathname !== "/login") return;
    const reason = new URLSearchParams(window.location.search).get("error") || "";
    if (!GOOGLE_FAIL_REASONS.has(reason)) return;
    trackPublicEvent("google_signin_failed", reason);
  }, [enabled, pathname]);

  if (!enabled) return null;
  return <Analytics />;
}
