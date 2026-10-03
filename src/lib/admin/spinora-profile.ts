/** Map Spinora `profiles` rows to labels the WinSweeps admin UI expects. */

export type SpinoraProfileRow = {
  id?: string;
  email?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  xp?: number | null;
  level?: number | null;
  coins_balance?: number | null;
  wallet_balance?: number | null;
  cashout_wallet?: number | null;
  is_suspended?: boolean | null;
  created_at?: string;
  last_seen_at?: string | null;
  referral_code?: string | null;
  vip_points?: number | null;
  vip_tier?: string | null;
  current_streak?: number | null;
  role?: string | null;
};

/** Columns safe to select from Spinora profiles in admin queries. */
export const ADMIN_PROFILE_SELECT =
  "id, email, full_name, avatar_url, xp, level, coins_balance, wallet_balance, cashout_wallet, is_suspended, created_at, last_seen_at, referral_code, vip_points, vip_tier, current_streak, role";

export const ADMIN_PROFILE_EMBED = "email, full_name";

export function profileDisplayName(p: SpinoraProfileRow): string {
  const name = p.full_name?.trim();
  if (name) return name;
  const email = p.email?.trim();
  if (email) return email.split("@")[0] ?? email;
  return "Player";
}

export function profileHandle(p: SpinoraProfileRow): string {
  const email = p.email?.trim();
  if (email) return email;
  return p.id?.slice(0, 8) ?? "player";
}

export function profileInitials(p: SpinoraProfileRow): string {
  const name = profileDisplayName(p);
  return name.slice(0, 2).toUpperCase();
}

export function profileIsBanned(p: SpinoraProfileRow): boolean {
  return Boolean(p.is_suspended);
}

export function profileNum(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function profileFromEmbed(
  embed: { email?: string | null; full_name?: string | null } | null | undefined,
  id = ""
): SpinoraProfileRow {
  return {
    id,
    email: embed?.email ?? null,
    full_name: embed?.full_name ?? null,
  };
}
