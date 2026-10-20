/** Short-lived return path. Not a session cookie. */
export const OAUTH_NEXT_COOKIE = "sth_auth_next";

export function safeInternalPath(value: string | null | undefined, fallback = "/"): string {
  const raw = (value || "").trim();
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("://") || raw.includes("\\")) {
    return fallback;
  }
  return raw;
}

export function safeAuthCode(value: string | null | undefined): string {
  const raw = (value || "").trim();
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(raw)) return "";
  return raw;
}

export function bareAuthCallbackUrl(origin: string): string {
  const url = new URL("/auth/callback", origin);
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function encodeOAuthNext(input: {
  redirect?: string | null;
  ref?: string | null;
  agent?: string | null;
}): string {
  return JSON.stringify({
    redirect: safeInternalPath(input.redirect, "/"),
    ref: safeAuthCode(input.ref),
    agent: safeAuthCode(input.agent),
  });
}

export function decodeOAuthNext(value: string | null | undefined): {
  redirect: string;
  ref: string;
  agent: string;
} {
  const empty = { redirect: "", ref: "", agent: "" };
  if (!value) return empty;
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as {
      redirect?: string;
      ref?: string;
      agent?: string;
    };
    return {
      redirect: safeInternalPath(parsed.redirect, ""),
      ref: safeAuthCode(parsed.ref),
      agent: safeAuthCode(parsed.agent),
    };
  } catch {
    return empty;
  }
}

/** Cookie the browser sends back on the top-level return from Google. */
export function oauthNextCookie(input: {
  redirect?: string | null;
  ref?: string | null;
  agent?: string | null;
  hostname: string;
  secure: boolean;
}): string {
  const value = encodeURIComponent(encodeOAuthNext(input));
  const domain = input.hostname.endsWith("sweeptakehub.com") ? "; Domain=.sweeptakehub.com" : "";
  const secure = input.secure ? "; Secure" : "";
  return `${OAUTH_NEXT_COOKIE}=${value}; Path=/; Max-Age=600; SameSite=Lax${domain}${secure}`;
}

/** Map provider errors to our own codes. Never echo the provider description. */
export function oauthLoginError(errorCode: string | null | undefined, error: string | null | undefined): string {
  const code = `${errorCode || ""} ${error || ""}`.toLowerCase();
  if (code.includes("access_denied")) return "google_cancelled";
  if (code.includes("email_exists") || code.includes("identity_already")) return "google_email_exists";
  if (code.includes("provider_email_needs_verification") || code.includes("email_not_confirmed")) {
    return "email_not_confirmed";
  }
  return "auth_callback_failed";
}

/**
 * Supabase falls back to the Site URL when the callback URL is not allow-listed.
 * A code or provider error can therefore land on `/` instead of `/auth/callback`.
 * Returns the URL to send the browser to, or null when this request should continue.
 */
export function oauthRecoveryTarget(current: URL): URL | null {
  const path = current.pathname;
  if (path === "/auth/callback" || path.startsWith("/auth/callback/")) return null;

  const params = current.searchParams;
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  if ((code && code.length > 0 && code.length <= 2048) || (tokenHash && tokenHash.length > 0 && tokenHash.length <= 2048)) {
    const next = new URL(current);
    next.pathname = "/auth/callback";
    next.search = "";
    if (code) next.searchParams.set("code", code);
    if (tokenHash) next.searchParams.set("token_hash", tokenHash);
    const type = params.get("type");
    if (type && /^[a-z_]{1,32}$/.test(type)) next.searchParams.set("type", type);
    const redirect = safeInternalPath(params.get("redirect"), "");
    if (redirect) next.searchParams.set("redirect", redirect);
    return next;
  }

  const errorCode = params.get("error_code");
  const oauthError = params.get("error");
  const providerError =
    Boolean(errorCode) || oauthError === "access_denied" || oauthError === "server_error";
  if (!providerError || path === "/login") return null;

  const next = new URL(current);
  next.pathname = "/login";
  next.search = "";
  next.searchParams.set("error", oauthLoginError(errorCode, oauthError));
  return next;
}
