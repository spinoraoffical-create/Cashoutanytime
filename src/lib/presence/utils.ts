/** Users active on the site within this window count as online. */
export const SITE_ONLINE_WINDOW_MS = 90_000;

export function isUserOnline(lastSeenAt: string | null | undefined): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < SITE_ONLINE_WINDOW_MS;
}
