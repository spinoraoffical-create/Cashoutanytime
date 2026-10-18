const USER_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** The transactions page only selects a player from a real user id. */
export function parseAdminTransactionUserId(
  value: string | string[] | null | undefined
): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  const trimmed = raw.trim();
  return USER_ID.test(trimmed) ? trimmed : null;
}
