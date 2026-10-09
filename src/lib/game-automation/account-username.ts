/** Game account login rules — short names are padded with digits (amy → amy0097). */
export const GAME_ACCOUNT_USERNAME_MIN = 7;
export const GAME_ACCOUNT_USERNAME_MAX = 13;
export const CASH_FRENZY_USERNAME_MAX = 20;

export const GAME_ACCOUNT_PASSWORD_MIN = 7;
export const GAME_ACCOUNT_PASSWORD_MAX = 13;

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function generateGamePassword(length = 12): string {
  const n = Math.min(GAME_ACCOUNT_PASSWORD_MAX, Math.max(GAME_ACCOUNT_PASSWORD_MIN, length));
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length]).join("");
}

function cleanAccountStem(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9_]/g, "");
}

function randomDigitSuffix(len: number): string {
  if (len <= 0) return "";
  let s = "";
  for (let i = 0; i < len; i++) s += String(Math.floor(Math.random() * 10));
  if (/^0+$/.test(s)) {
    s = `${Math.floor(Math.random() * 9) + 1}${s.slice(1)}`;
  }
  return s;
}

export function maxUsernameLenForGame(gameSlug: string): number {
  return gameSlug === "cash-frenzy" ? CASH_FRENZY_USERNAME_MAX : GAME_ACCOUNT_USERNAME_MAX;
}

/** Pad short stems with random digits so panel min-length rules pass (amy → amy0097). */
export function ensureGameAccountUsername(
  raw: string,
  gameSlug: string,
  minLen = GAME_ACCOUNT_USERNAME_MIN
): string {
  const maxLen = maxUsernameLenForGame(gameSlug);
  let u = cleanAccountStem(raw).slice(0, maxLen);
  if (!u) u = "player";
  if (u.length >= minLen) return u;
  const need = minLen - u.length;
  return `${u}${randomDigitSuffix(need)}`.slice(0, maxLen);
}

export function isLayuiPanelGame(slug: string): boolean {
  return (
    slug === "gameroom" ||
    slug === "cash-machine" ||
    slug === "mafia" ||
    slug === "mr-all-in-one"
  );
}

const CUSTOM_ACCOUNT_ALNUM = /^[a-zA-Z0-9]+$/;

/** Validate user-chosen username/password for "Create own login". */
export function validateCustomGameAccountCredentials(
  username: string,
  password: string,
  gameSlug: string
): { ok: true; username: string; password: string } | { ok: false; error: string } {
  const u = username.trim();
  const p = password.trim();

  if (u.length < GAME_ACCOUNT_USERNAME_MIN || u.length > GAME_ACCOUNT_USERNAME_MAX) {
    return {
      ok: false,
      error: `Username must be ${GAME_ACCOUNT_USERNAME_MIN}–${GAME_ACCOUNT_USERNAME_MAX} characters.`,
    };
  }
  if (!CUSTOM_ACCOUNT_ALNUM.test(u)) {
    return {
      ok: false,
      error: "Username must be letters and numbers only (no symbols or spaces).",
    };
  }
  if (p.length < GAME_ACCOUNT_PASSWORD_MIN || p.length > GAME_ACCOUNT_PASSWORD_MAX) {
    return {
      ok: false,
      error: `Password must be ${GAME_ACCOUNT_PASSWORD_MIN}–${GAME_ACCOUNT_PASSWORD_MAX} characters.`,
    };
  }
  if (!CUSTOM_ACCOUNT_ALNUM.test(p)) {
    return {
      ok: false,
      error: "Password must be letters and numbers only (no symbols or spaces).",
    };
  }
  if (isLayuiPanelGame(gameSlug) && (!/[a-zA-Z]/.test(p) || !/[0-9]/.test(p))) {
    return {
      ok: false,
      error: "Password must include both letters and numbers (e.g. player1).",
    };
  }

  const normalizedUsername = ensureGameAccountUsername(u, gameSlug);
  const normalizedPassword = isLayuiPanelGame(gameSlug) ? p.toLowerCase() : p;

  return { ok: true, username: normalizedUsername, password: normalizedPassword };
}

/** A new 7–13 character login so Replace does not reuse a name the game already has. */
export function freshAccountName(current: string, gameSlug = ""): string {
  const max = maxUsernameLenForGame(gameSlug);
  const alnum = current.toLowerCase().replace(/[^a-z0-9]/g, "");
  const headLen = Math.max(3, Math.min(alnum.length || 6, max - 4));
  const head = (alnum || "player").slice(0, headLen);
  const need = Math.min(4, max - head.length);
  return `${head}${randomDigitSuffix(need)}`.slice(0, max);
}

export function isAccountTakenError(message: string): boolean {
  return /already exists|already exist|already taken|code 20\b|已存在|duplicate account|name is exist|account exist/i.test(message);
}

export async function createUntilAccepted<T>(
  username: string,
  gameSlug: string,
  create: (name: string) => Promise<T>
): Promise<{ value: T; username: string }> {
  let name = username.trim();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const value = await create(name);
      return { value, username: name };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!isAccountTakenError(message) || attempt === 3) throw error;
      name = freshAccountName(name, gameSlug);
    }
  }
  throw new Error("That username is already taken. Try again.");
}
