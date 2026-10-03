/** Production email links always use SITE_URL so Supabase redirect allow-list matches. */
export function getEmailAuthOrigin(requestOrigin: string): string {
  try {
    const host = new URL(requestOrigin).hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return requestOrigin.replace(/\/$/, "");
    }
  } catch {
    // fall through to SITE_URL
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://spinoracasinos.com";
  return siteUrl.replace(/\/$/, "");
}

/** Build the OAuth / email-verification callback URL for the current environment */
export function getAuthCallbackUrl(redirect = "/"): string {
  const origin =
    typeof window !== "undefined"
      ? getEmailAuthOrigin(window.location.origin)
      : process.env.NEXT_PUBLIC_SITE_URL || "https://spinoracasinos.com";

  const url = new URL("/auth/callback", origin);
  url.searchParams.set("redirect", redirect);
  return url.toString();
}

export function getAuthCallbackUrlWithRef(redirect = "/", referralCode?: string | null): string {
  const url = new URL(getAuthCallbackUrl(redirect));
  if (referralCode?.trim()) {
    url.searchParams.set("ref", referralCode.trim());
  }
  return url.toString();
}

/** Server-side callback URL (pass request origin from the client in dev) */
export function buildAuthCallbackUrl(
  origin: string,
  redirect = "/",
  referralCode?: string | null
): string {
  const base = getEmailAuthOrigin(origin);
  const url = new URL("/auth/callback", base);
  url.searchParams.set("redirect", redirect.startsWith("/") ? redirect : "/");
  if (referralCode?.trim()) {
    url.searchParams.set("ref", referralCode.trim());
  }
  return url.toString();
}
