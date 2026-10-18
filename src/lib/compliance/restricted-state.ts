/** Same signal the edge middleware uses: Vercel country and region headers. */

export function restrictedStateCodes(raw = process.env.RESTRICTED_STATES || "WA,ID,NV,MI") {
  return raw.split(",");
}

export function isRestrictedUsRegion(
  country: string | null | undefined,
  region: string | null | undefined,
  restrictedStates: readonly string[]
) {
  return (country || "") === "US" && restrictedStates.includes(region || "");
}

export function isRestrictedPaymentRequest(headers: { get(name: string): string | null }) {
  return isRestrictedUsRegion(
    headers.get("x-vercel-ip-country"),
    headers.get("x-vercel-ip-country-region"),
    restrictedStateCodes()
  );
}

export const REGION_MISSING = "We could not confirm your location. This money action was not started.";
export const REGION_BLOCKED = "This money action is unavailable in your state.";

/**
 * Money actions fail closed unless this process is the Vercel runtime and the
 * platform location headers are complete. A browser can send the same header
 * names. VERCEL is set by the platform, not by the request. The headers are
 * IP geolocation, not proof of legal residence.
 */
export function moneyRegionDenial(
  headers: { get(name: string): string | null },
  env: NodeJS.ProcessEnv = process.env
): string | null {
  if (env.VERCEL !== "1") return REGION_MISSING;
  const country = (headers.get("x-vercel-ip-country") || "").trim();
  const region = (headers.get("x-vercel-ip-country-region") || "").trim();
  if (!country || (country === "US" && !region)) return REGION_MISSING;
  if (isRestrictedUsRegion(country, region, restrictedStateCodes(env.RESTRICTED_STATES))) return REGION_BLOCKED;
  return null;
}
