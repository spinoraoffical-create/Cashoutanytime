import { permanentRedirect } from "next/navigation";

/** Fallback when the permanent `/games` → `/play` redirect is not applied first. */
export default async function GamesCatalogRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.append(key, value);
    else if (Array.isArray(value)) {
      for (const item of value) query.append(key, item);
    }
  }
  const suffix = query.toString();
  permanentRedirect(suffix ? `/play?${suffix}` : "/play");
}
