/** Game account login rules — short names are padded with digits (amy → amy0097). */
export const GAME_ACCOUNT_USERNAME_MIN = 7;
export const GAME_ACCOUNT_USERNAME_MAX = 13;
export const CASH_FRENZY_USERNAME_MAX = 20;

export const GAME_ACCOUNT_PASSWORD_MIN = 7;
export const GAME_ACCOUNT_PASSWORD_MAX = 13;

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
