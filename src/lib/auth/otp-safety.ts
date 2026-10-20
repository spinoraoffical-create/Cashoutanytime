export type AuthContactUpdate = {
  phone?: string;
  user_metadata: Record<string, unknown>;
};

/**
 * The admin user update clears every outstanding email code when `phone` is set.
 * Keep the signup code valid until the player confirms that email.
 */
export function authUserUpdateForContact(input: {
  emailConfirmed: boolean;
  phone: string;
  metadata: Record<string, unknown>;
}): AuthContactUpdate {
  const user_metadata = { ...input.metadata, phone: input.phone };
  if (!input.emailConfirmed) return { user_metadata };
  return { phone: input.phone, user_metadata };
}

/** Tell a wrong code apart from a dead connection or a rate limit. */
export function otpFailureMessage(error: {
  message?: string;
  code?: string;
  status?: number;
  name?: string;
} | null | undefined): string {
  const code = (error?.code ?? "").toLowerCase();
  const message = (error?.message ?? "").toLowerCase();
  const status = error?.status;
  if (status === 429 || code.includes("rate") || message.includes("rate limit") || message.includes("too many")) {
    return "Too many attempts. Please wait a few minutes.";
  }
  if (
    status === 504 ||
    (typeof status === "number" && status >= 500) ||
    error?.name === "AuthRetryableFetchError" ||
    message.includes("network") ||
    message.includes("fetch failed") ||
    message.includes("failed to fetch")
  ) {
    return "We could not check that code. Check your connection and try the same code again.";
  }
  if (code === "otp_expired" || message.includes("expired")) {
    return "That code has expired. Request a new one.";
  }
  return "That code is incorrect or expired. Request a new one.";
}

/** Drop the flag that asks Supabase to return JSON instead of sending the browser to Google. */
export function browserOAuthUrl(authorizeUrl: string): string {
  try {
    const url = new URL(authorizeUrl);
    url.searchParams.delete("skip_http_redirect");
    return url.toString();
  } catch {
    return authorizeUrl;
  }
}
