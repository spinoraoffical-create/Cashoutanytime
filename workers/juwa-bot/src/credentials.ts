/** Juwa: ≤13 chars, letters/underscore/numbers. Password matches account. */
export function buildJuwaCredentials(profile: {
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

/**
 * Juwa rejects duplicate account names. Produce the Nth username variant for a
 * base name, keeping it within the 13-char limit:
 *   attempt 0 -> base
 *   attempt 1..25 -> base + letter (a..z)
 *   attempt 26+  -> base + number
 */
export function usernameVariant(base: string, attempt: number): string {
  const clean = base.replace(/[^a-z0-9_]/g, "").slice(0, 13) || "player";
  if (attempt <= 0) return clean;

  const suffix = attempt <= 25 ? String.fromCharCode(96 + attempt) : String(attempt - 25);
  const room = 13 - suffix.length;
  return `${clean.slice(0, Math.max(1, room))}${suffix}`;
}
