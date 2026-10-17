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

function hasPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** True for a public canonical path. `/games` is the directory redirect. `/games/juwa` is a game page. */
export function isPublicIndexablePath(pathname: string): boolean {
  if (!pathname.startsWith("/") || pathname.includes("?") || pathname.includes("#")) return false;
  if (pathname.length > 1 && pathname.endsWith("/")) return false;

  if (pathname.startsWith("/games/")) {
    const slug = pathname.slice("/games/".length);
    return slug.length > 0 && !slug.includes("/");
  }

  if (BLOCKED_EXACT.has(pathname)) return false;
  return !BLOCKED_PREFIXES.some((prefix) => hasPrefix(pathname, prefix));
}
