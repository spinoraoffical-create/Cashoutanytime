import { GAMES } from "@/lib/games";

const OWN_HOSTS = new Set(["sweeptakehub.com", "www.sweeptakehub.com", "spinoracasinos.com"]);

export type InternalLink = { href: string; label: string };

function mentions(haystack: string, phrase: string) {
  const escaped = phrase.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(haystack);
}

export function gamesInText(text: string): InternalLink[] {
  const haystack = text.toLowerCase();
  return GAMES.filter((game) => !game.upcoming)
    .filter((game) => mentions(haystack, game.name) || mentions(haystack, game.slug.replace(/-/g, " ")))
    .sort((a, b) => b.name.length - a.name.length)
    .slice(0, 3)
    .map((game) => ({ href: `/games/${game.slug}`, label: game.name }));
}

export function toInternalPath(href: string): string | null {
  const value = href.trim();
  if (!value || value.startsWith("#") || /^javascript:/i.test(value) || /^mailto:/i.test(value)) return null;
  if (value.startsWith("/") && !value.startsWith("//")) {
    if (value.startsWith("/admin") || value.startsWith("/api") || value.startsWith("/auth")) return null;
    return value;
  }
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    if (OWN_HOSTS.has(host) || host.endsWith(".vercel.app")) {
      const path = `${url.pathname}${url.search}` || "/";
      if (path.startsWith("/admin") || path.startsWith("/api")) return null;
      return path;
    }
  } catch {
    return null;
  }
  return null;
}

/** Drop off-site links. Keep the words, and keep links that stay on this site. */
export function keepInternalHtml(html: string) {
  const withoutScripts = html.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  return withoutScripts.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_full, attrs: string, inner: string) => {
    const hrefMatch = String(attrs).match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const href = hrefMatch?.[1] || hrefMatch?.[2] || hrefMatch?.[3] || "";
    const path = toInternalPath(href);
    if (!path) return inner;
    return `<a href="${path}">${inner}</a>`;
  });
}

export function articleCtas(text: string): InternalLink[] {
  const games = gamesInText(text);
  const links: InternalLink[] = [
    ...games.map((game) => ({ href: game.href, label: `Open ${game.label}` })),
    { href: "/play", label: "Browse Game Rooms" },
    { href: "/register", label: "Create an account" },
    { href: "/promotions", label: "See promotions" },
    { href: "/faq", label: "Read the FAQ" },
    { href: "/help", label: "Wallet help" },
  ];
  const seen = new Set<string>();
  return links.filter((link) => {
    if (seen.has(link.href)) return false;
    seen.add(link.href);
    return true;
  });
}
