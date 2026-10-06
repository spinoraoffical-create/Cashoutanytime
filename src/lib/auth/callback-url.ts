/** Email and Google links return to the site the player is actually using. */
export function getEmailAuthOrigin(requestOrigin: string): string {
  try {
    const url = new URL(requestOrigin);
    if (url.protocol === "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return url.origin;
    }
  } catch {
    // fall through to SITE_URL
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://cashoutanytime.vercel.app";
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
