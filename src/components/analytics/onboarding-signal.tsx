"use client";

import { useEffect } from "react";
import { trackPublicEvent } from "@/lib/analytics/public-events";

/** Records that a signed-in player opened the welcome screen. No account id is sent. */
export function OnboardingSignal() {
  useEffect(() => {
    trackPublicEvent("onboarding_opened");
  }, []);
  return null;
}
