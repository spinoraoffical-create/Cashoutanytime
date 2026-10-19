const WINDOW_MS = 20 * 60 * 1000;

export type RegistrationCaller = {
  sessionUserId: string | null;
  sessionEmail: string | null;
  claimedUserId: string;
  claimedEmail: string;
  authEmail: string | null;
  createdAtMs: number | null;
  emailConfirmed: boolean;
  profilePhone: string | null;
  profileDob: string | null;
  now: number;
};

/**
 * A signup may write contact details only for the account that just registered.
 * A signed-in caller must match that account. A confirmation signup has no
 * session yet, so it is limited to a brand-new, still-empty, unconfirmed user.
 */
export function registrationWriteDenial(input: RegistrationCaller): string | null {
  const claimedEmail = input.claimedEmail.trim().toLowerCase();
  const claimedUserId = input.claimedUserId.trim();
  if (!claimedUserId || !claimedEmail) return "Sign in to finish creating this account.";

  if (input.sessionUserId) {
    const sessionEmail = (input.sessionEmail || "").trim().toLowerCase();
    if (input.sessionUserId !== claimedUserId || sessionEmail !== claimedEmail) {
      return "This signup does not match the signed-in account.";
    }
    return null;
  }

  const authEmail = (input.authEmail || "").trim().toLowerCase();
  if (!authEmail || authEmail !== claimedEmail) return "This signup does not match the account email.";
  if (input.emailConfirmed) return "Sign in to finish this account.";
  if (input.createdAtMs == null || input.now - input.createdAtMs > WINDOW_MS || input.createdAtMs > input.now + 60_000) {
    return "This signup has expired. Sign in and update your profile.";
  }
  if (input.profilePhone?.trim() || input.profileDob) {
    return "This account is already set up. Sign in to change it.";
  }
  return null;
}
