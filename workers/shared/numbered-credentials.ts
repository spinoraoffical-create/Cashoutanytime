/** Shared Spinora bot naming: stem + 4 unique digits (e.g. anthony → anthony0421). */
export const MIN_ACCOUNT_USERNAME_LEN = 7;
export const DEFAULT_MAX_LEN = 13;
/** Four different digits at the end — avoids global "similar name" collisions (anthony2, anthony3). */
export const SUFFIX_DIGIT_LEN = 4;

/** Extra letter runs before the digit suffix when panels still reject a name. */
export const SIMILARITY_PAD_CHAR = "y";
/** Letter-padding tries per digit suffix before rolling a new 4-digit code. */
export const PAD_LEVELS_PER_NUM = 6;

export function cleanAccountStem(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9_]/g, "");
}

export function randomDigitSuffix(len: number): string {
  if (len <= 0) return "";
  let s = "";
  for (let i = 0; i < len; i++) s += String(Math.floor(Math.random() * 10));
  if (/^0+$/.test(s)) {
    s = `${Math.floor(Math.random() * 9) + 1}${s.slice(1)}`;
  }
  return s;
}

/** Pad short stems with random digits so panel min-length rules pass (amy → amy0097). */
export function ensureMinUsername(
  raw: string,
  minLen = MIN_ACCOUNT_USERNAME_LEN,
  maxLen = DEFAULT_MAX_LEN
): string {
  let u = cleanAccountStem(raw).slice(0, maxLen);
  if (!u) u = "player";
  if (u.length >= minLen) return u;
  const need = minLen - u.length;
  return `${u}${randomDigitSuffix(need)}`.slice(0, maxLen);
}

/** Four digits, all different (e.g. 0421, 9153) — seeded so retries get new codes. */
export function distinctFourDigitSuffix(seed: number): string {
  const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  let s = Math.abs(seed) || 1;
  for (let i = digits.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) >>> 0;
    const j = s % (i + 1);
    [digits[i], digits[j]] = [digits[j], digits[i]];
  }
  return digits.slice(0, SUFFIX_DIGIT_LEN).join("");
}

export function profileNameStem(
  profile: { full_name?: string | null; email?: string | null },
  maxLen = DEFAULT_MAX_LEN
): string {
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

  return cleanAccountStem(base).slice(0, maxLen);
}

export function parseNumberedUsername(username: string): { stem: string; num: number } {
  const clean = cleanAccountStem(username);
  const match = clean.match(/^(.+?)(\d+)$/);
  if (match) {
    return { stem: match[1], num: parseInt(match[2], 10) };
  }
  return { stem: clean || "player", num: 0 };
}

/** Seed for the next 4-digit suffix (not sequential anthony2 → anthony3). */
export function suffixSeedFromPrior(existingUsername: string | null | undefined): number {
  if (!existingUsername?.trim()) return Date.now() % 100_000;
  const clean = cleanAccountStem(existingUsername.trim());
  let h = 0;
  for (let i = 0; i < clean.length; i++) h = (h * 31 + clean.charCodeAt(i)) >>> 0;
  const { num } = parseNumberedUsername(existingUsername);
  return (h + num * 1009 + 1) % 100_000;
}

/** @deprecated Sequential numbers — use distinctFourDigitSuffix via usernameVariant. */
export function numberedUsername(
  stem: string,
  num: number,
  maxLen = DEFAULT_MAX_LEN,
  minLen = MIN_ACCOUNT_USERNAME_LEN
): string {
  const digitSuffix = distinctFourDigitSuffix(num * 997 + stem.length);
  return suffixUsername(stem, digitSuffix, 0, maxLen, minLen);
}

/** @deprecated Use suffixSeedFromPrior — kept for imports. */
export function nextNumberAfterExisting(existingUsername: string | null | undefined): number {
  return suffixSeedFromPrior(existingUsername);
}

function suffixUsername(
  stem: string,
  digitSuffix: string,
  letterPadLevel: number,
  maxLen: number,
  minLen: number
): string {
  const padding = letterPadLevel === 0 ? "" : SIMILARITY_PAD_CHAR.repeat(letterPadLevel * 2);
  const suffix = `${padding}${digitSuffix}`;
  const basePart = stem.slice(0, Math.max(1, maxLen - suffix.length)) || "player";
  return ensureMinUsername(`${basePart}${suffix}`, minLen, maxLen);
}

/**
 * Username variants: anthony0421 → anthonyyy9153 → anthonyyyy3840 …
 * Custom exact name: startNum 0 uses stem once, then 4-digit suffixes.
 */
export function usernameVariant(
  base: string,
  attempt: number,
  suffixSeed = 1,
  maxLen = DEFAULT_MAX_LEN,
  minLen = MIN_ACCOUNT_USERNAME_LEN
): string {
  const stem = cleanAccountStem(base).slice(0, maxLen) || "player";

  if (suffixSeed === 0 && attempt === 0) {
    return ensureMinUsername(stem, minLen, maxLen);
  }

  const effectiveAttempt = suffixSeed === 0 ? attempt - 1 : attempt;
  const padLevel = effectiveAttempt % PAD_LEVELS_PER_NUM;
  const round = Math.floor(effectiveAttempt / PAD_LEVELS_PER_NUM);
  const seed = (suffixSeed || 1) + round * 1009 + effectiveAttempt * 97;
  const fourDigits = distinctFourDigitSuffix(seed);

  return suffixUsername(stem, fourDigits, padLevel, maxLen, minLen);
}

export interface CreateAccountPlan {
  stem: string;
  /** Seed for 4-digit suffix generation (0 = try exact stem on first attempt). */
  startNum: number;
  preferredPassword?: string | null;
  /** When true, never reuse an existing panel login — always pick a new 4-digit suffix. */
  forceNewAccount: boolean;
}

export function planCreateAccount(job: {
  game_username?: string | null;
  game_password?: string | null;
  requester_name?: string | null;
  requester_email?: string | null;
  prior_game_username?: string | null;
  admin_notes?: string | null;
}): CreateAccountPlan {
  const customUser = job.game_username?.trim();
  const forceNewAccount = Boolean(
    job.prior_game_username?.trim() || job.admin_notes === "account_replace"
  );

  if (customUser) {
    const clean = cleanAccountStem(customUser).slice(0, DEFAULT_MAX_LEN) || "player";
    const { stem, num } = parseNumberedUsername(clean);
    const password = job.game_password?.trim() || null;
    if (num > 0 && !forceNewAccount) {
      return {
        stem: clean,
        startNum: 0,
        preferredPassword: password,
        forceNewAccount,
      };
    }
    if (num > 0) {
      return {
        stem,
        startNum: suffixSeedFromPrior(clean),
        preferredPassword: password,
        forceNewAccount,
      };
    }
    return {
      stem: clean,
      startNum: 0,
      preferredPassword: password,
      forceNewAccount,
    };
  }

  const stem = profileNameStem({
    full_name: job.requester_name,
    email: job.requester_email,
  });
  const startNum = suffixSeedFromPrior(job.prior_game_username);

  return { stem, startNum, preferredPassword: null, forceNewAccount };
}

export function variantFromPlan(plan: CreateAccountPlan, maxLen = DEFAULT_MAX_LEN) {
  return (base: string, attempt: number) =>
    usernameVariant(base, attempt, plan.startNum, maxLen, MIN_ACCOUNT_USERNAME_LEN);
}

export function buildCredentials(profile: {
  full_name?: string | null;
  email?: string | null;
}): { username: string; password: string } {
  const stem = profileNameStem(profile);
  const username = suffixUsername(
    stem,
    distinctFourDigitSuffix(Date.now() % 100_000),
    0,
    DEFAULT_MAX_LEN,
    MIN_ACCOUNT_USERNAME_LEN
  );
  return { username, password: username };
}
