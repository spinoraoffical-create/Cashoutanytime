/** Paths that must not appear in the public sitemap. */
const BLOCKED_EXACT = new Set([
  "/games",
  "/login",
  "/register",
  "/reset-password",
  "/restricted",
  "/whats-new",
  "/get-app",
]);

const BLOCKED_PREFIXES = [
  "/dashboard",
  "/admin",
  "/api",
  "/auth",
  "/unsubscribe",
  "/reset-password",
  "/r",
];

/** Public routes that may be indexed. Unknown one-segment URLs are not in this set. */
const ALLOWED_EXACT = new Set([
  "/",
  "/play",
  "/faq",
  "/help",
  "/blog",
  "/promotions",
  "/leaderboard",
  "/vip",
  "/about",
  "/support",
  "/contact",
  "/terms",
  "/privacy",
  "/spin",
]);

/**
 * Location pages stay on the site but are not indexable.
 * Kept here so the sitemap check does not need a database.
 */
export const NON_INDEXABLE_STATE_SLUGS = [
  "arizona",
  "california",
  "florida",
  "georgia",
  "illinois",
  "michigan",
  "nevada",
  "new-york",
  "north-carolina",
  "ohio",
  "pennsylvania",
  "texas",
] as const;

const GEO_STATES = new Set<string>(NON_INDEXABLE_STATE_SLUGS);

function hasPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isKnownGeoPath(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 1 || parts.length === 2) return GEO_STATES.has(parts[0]);
  return false;
}

/** True for a public canonical path. `/games` is the directory redirect. `/games/juwa` is a game page. */
export function isPublicIndexablePath(pathname: string): boolean {
  if (!pathname.startsWith("/") || pathname.includes("?") || pathname.includes("#")) return false;
  if (pathname.length > 1 && pathname.endsWith("/")) return false;

  if (isKnownGeoPath(pathname)) return false;

  if (pathname.startsWith("/games/")) {
    const slug = pathname.slice("/games/".length);
    return slug.length > 0 && !slug.includes("/");
  }

  if (pathname.startsWith("/blog/")) {
    const slug = pathname.slice("/blog/".length);
    return slug.length > 0 && !slug.includes("/");
  }

  if (BLOCKED_EXACT.has(pathname)) return false;
  if (BLOCKED_PREFIXES.some((prefix) => hasPrefix(pathname, prefix))) return false;
  return ALLOWED_EXACT.has(pathname);
}
