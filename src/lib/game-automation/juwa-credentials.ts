import { ensureGameAccountUsername } from "./account-username";

function profileNameStem(profile: {
  full_name?: string | null;
  email?: string | null;
}): string {
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

  return base.replace(/[^a-z0-9_]/g, "").slice(0, 13);
}

/** Juwa: ≤13 chars, letters/underscore/numbers. Password matches account. */
export function buildJuwaCredentials(profile: {
  full_name?: string | null;
  email?: string | null;
}): { username: string; password: string } {
  const username = ensureGameAccountUsername(profileNameStem(profile), "juwa");
  return { username, password: username };
}

export function previewJuwaUsername(fullName?: string | null, email?: string | null): string {
  return ensureGameAccountUsername(profileNameStem({ full_name: fullName, email }), "juwa");
}
