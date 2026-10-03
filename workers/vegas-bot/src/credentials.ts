/**
 * Vegas Sweeps account names: letters/numbers/underscore, 13 chars or fewer.
 * Password defaults to the username unless the user picked one.
 * Username variants use shared numbered-credentials (padded + numbered).
 */
export function buildVegasCredentials(profile: {
  full_name?: string | null;
  email?: string | null;
}): { username: string; password: string } {
  let base = "";

  if (profile.full_name?.trim()) {
    const parts = profile.full_name.trim().split(/\s+/);
    base = parts[0].toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (base.length < 3 && parts.length > 1) {
      base = parts
        .join("_")
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "")
        .replace(/_+/g, "_");
    }
  }

  if (!base && profile.email) {
    const local = profile.email.split("@")[0] ?? "";
    if (!local.endsWith("@phone.spinora.local")) {
      base = local.toLowerCase().replace(/[^a-z0-9_]/g, "");
    }
  }

  if (!base) base = "player";

  const username = base.replace(/[^a-z0-9_]/g, "").slice(0, 13);
  return { username, password: username };
}

/** Login password — defaults to username when the user did not pick one. */
export function passwordForAccount(username: string, preferred?: string | null): string {
  return preferred?.trim() || username;
}
