/** Anonymous funnel names. Never attach a message, code, email, phone, or token. */
export const PUBLIC_EVENT_NAMES = [
  "signup_started",
  "signup_code_requested",
  "signup_completed",
  "google_signin_started",
  "google_signin_failed",
  "onboarding_opened",
] as const;

export type PublicEventName = (typeof PUBLIC_EVENT_NAMES)[number];

const GOOGLE_FAIL_REASONS = new Set([
  "google_failed",
  "google_cancelled",
  "google_email_exists",
  "auth_callback_failed",
  "email_not_confirmed",
]);

const CONSENT_KEY = "spinora-cookies";

export function analyticsConsentGranted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}

export function notifyAnalyticsConsent(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("sth-analytics-consent"));
}

/** Sends one allow-listed name after the visitor accepts the cookie notice. */
export function trackPublicEvent(name: PublicEventName, reason?: string): void {
  if (!PUBLIC_EVENT_NAMES.includes(name) || !analyticsConsentGranted()) return;
  const safeReason = reason && GOOGLE_FAIL_REASONS.has(reason) ? reason : undefined;
  void import("@vercel/analytics")
    .then(({ track }) => {
      if (safeReason) track(name, { reason: safeReason });
      else track(name);
    })
    .catch(() => {
      /* Measurement is optional. A missing script must not block the page. */
    });
}
