"use client";

import dynamic from "next/dynamic";

const CookieConsent = dynamic(
  () => import("@/components/ui/cookie-consent").then((m) => ({ default: m.CookieConsent })),
  { ssr: false }
);

export function DeferredCookieConsent() {
  return <CookieConsent />;
}
