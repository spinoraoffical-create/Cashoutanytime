type CookieOpts = { domain?: string };

/** Share the login cookie between sweeptakehub.com and www.sweeptakehub.com. */
export function withAuthCookieDomain<T extends CookieOpts>(options: T, host?: string | null): T {
  const name = (host || "").split(":")[0].trim().toLowerCase().replace(/^www\./, "");
  if (name === "sweeptakehub.com") {
    return { ...options, domain: ".sweeptakehub.com" };
  }
  return options;
}
