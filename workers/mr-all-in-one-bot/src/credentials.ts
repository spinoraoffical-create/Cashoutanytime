/**
 * MR All In One panel rules:
 * - Username: letters, numbers, underscore, 7–13 chars
 * - Password: letters and numbers ONLY (no underscore/symbols), 7–13 chars
 */
import {
  ensureMinUsername,
  MIN_ACCOUNT_USERNAME_LEN,
  DEFAULT_MAX_LEN,
} from "../../shared/numbered-credentials.js";

const MIN_LEN = MIN_ACCOUNT_USERNAME_LEN;
const MAX_LEN = DEFAULT_MAX_LEN;

function cleanPassword(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Panel rejects letter-only or digit-only passwords — must include both. */
function finalizePassword(raw: string): string {
  let p = cleanPassword(raw);
  if (p.length < MIN_LEN) p = `${p}123456789`.slice(0, MAX_LEN);
  if (p.length < MIN_LEN) p = "player1";
  if (!/[0-9]/.test(p)) p = `${p}1`.slice(0, MAX_LEN);
  if (!/[a-z]/.test(p)) p = `a${p}`.slice(0, MAX_LEN);
  if (p.length < MIN_LEN) p = "player1";
  return p.slice(0, MAX_LEN);
}

export function normalizeUsername(raw: string): string {
  return ensureMinUsername(raw, MIN_LEN, MAX_LEN);
}

/** Password for a given login name — 7–13 alphanumeric chars with letters AND digits. */
export function passwordForAccount(username: string, preferred?: string): string {
  const fallback = finalizePassword(`${cleanPassword(username) || "player"}1`);
  if (!preferred?.trim()) return fallback;

  const p = cleanPassword(preferred);
  if (p.length >= MIN_LEN) return finalizePassword(p);
  return fallback;
}

export function buildCredentials(profile: {
  full_name?: string | null;
  email?: string | null;
}): { username: string; password: string } {
  const username = normalizeUsername(profile.full_name?.trim() || profile.email || "player");
  return { username, password: passwordForAccount(username) };
}

/** Random suffix from an unambiguous alphabet (no 0/o/1/l/i). */
function randomSuffix(len: number): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function usernameVariant(base: string, attempt: number): string {
  const clean = normalizeUsername(base);
  if (attempt <= 0) return clean;

  let suffix: string;
  if (attempt <= 2) suffix = String(attempt);
  else suffix = randomSuffix(attempt <= 5 ? 2 : 3);

  const room = MAX_LEN - suffix.length;
  const variant = `${clean.slice(0, Math.max(1, room))}${suffix}`;
  return normalizeUsername(variant);
}
