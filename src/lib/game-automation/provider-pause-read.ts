import "server-only";

import { canonicalGameSlug } from "@/lib/games";
import { createAdminClient } from "@/lib/supabase/admin";
import { PROVIDER_PAUSED, providerFulfillmentBlocked } from "@/lib/game-automation/provider-pause";

export async function providerFulfillmentDenial(gameSlug: string): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return PROVIDER_PAUSED;
  const { data, error } = await admin
    .from("provider_automation_controls")
    .select("paused")
    .eq("provider", canonicalGameSlug(gameSlug))
    .maybeSingle();
  return providerFulfillmentBlocked(data as { paused?: boolean | null } | null, Boolean(error))
    ? PROVIDER_PAUSED
    : null;
}

/** Fail closed. A read error pauses every listed provider so the page does not call them. */
export async function pausedProviderSlugs(slugs: string[]): Promise<Set<string>> {
  const names = slugs.map((slug) => canonicalGameSlug(slug));
  const admin = createAdminClient();
  if (!admin) return new Set(names);
  const { data, error } = await admin
    .from("provider_automation_controls")
    .select("provider, paused")
    .in("provider", names);
  if (error) return new Set(names);
  const paused = new Set(names);
  for (const row of data ?? []) {
    const provider = String((row as { provider?: string }).provider ?? "");
    if (provider && !providerFulfillmentBlocked(row as { paused?: boolean | null }, false)) {
      paused.delete(provider);
    }
  }
  return paused;
}
