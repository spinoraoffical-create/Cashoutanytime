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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.sweeptakehub.com";
  return siteUrl.replace(/\/$/, "");
}

/**
 * Exact callback URL. Extra query parameters are stored separately because
 * Supabase replaces an unlisted callback URL with the Site URL.
 */
export function getAuthCallbackUrl(_redirect = "/"): string {
  const origin =
    typeof window !== "undefined"
      ? getEmailAuthOrigin(window.location.origin)
      : process.env.NEXT_PUBLIC_SITE_URL || "https://www.sweeptakehub.com";

  const url = new URL("/auth/callback", origin);
  url.search = "";
  return url.toString();
}

export function getAuthCallbackUrlWithRef(redirect = "/", _referralCode?: string | null): string {
  return getAuthCallbackUrl(redirect);
}

/** Server-side callback URL (pass request origin from the client in dev) */
export function buildAuthCallbackUrl(
  origin: string,
  _redirect = "/",
  _referralCode?: string | null,
  _agentCode?: string | null
): string {
  const base = getEmailAuthOrigin(origin);
  const url = new URL("/auth/callback", base);
  url.search = "";
  return url.toString();
}
