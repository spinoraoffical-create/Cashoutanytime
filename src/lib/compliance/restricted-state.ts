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
