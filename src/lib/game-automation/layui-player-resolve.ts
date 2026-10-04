/**
 * Shared fast player-id resolution for Gameroom-family APIs
 * (Gameroom / Cash Machine / Mafia / MR All-in-One).
 *
 * Avoids scanning hundreds of player-list pages on every load/redeem.
 */

const playerIdCache = new Map<string, { id: string; at: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

export function cachePlayerId(agentKey: string, account: string, id: string | number) {
  const key = `${agentKey}:${account.trim().toLowerCase()}`;
  playerIdCache.set(key, { id: String(id), at: Date.now() });
}

export function getCachedPlayerId(agentKey: string, account: string): string | null {
  const key = `${agentKey}:${account.trim().toLowerCase()}`;
  const hit = playerIdCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    playerIdCache.delete(key);
    return null;
  }
  return hit.id;
}

export type PlayerListItem = { Account: string; id: number };

/**
 * Resolve numeric player id quickly:
 * 1) pure digits → use as-is
 * 2) memory cache
 * 3) one filtered list page (Account / username / search)
 * 4) one unfiltered page of 100 as last resort
 */
export async function resolveLayuiPlayerId(opts: {
  agentKey: string;
  accountOrId: string | number;
  fetchList: (params: Record<string, string>) => Promise<{ data?: PlayerListItem[]; count?: number }>;
}): Promise<string> {
  const strVal = String(opts.accountOrId).trim();
  if (!strVal) throw new Error("Player account missing");

  if (/^\d+$/.test(strVal)) return strVal;

  const cached = getCachedPlayerId(opts.agentKey, strVal);
  if (cached) return cached;

  const target = strVal.toLowerCase();

  const tryMatch = (rows?: PlayerListItem[]) =>
    rows?.find((p) => p.Account?.toLowerCase() === target || String(p.id) === target) ?? null;

  for (const params of [
    { limit: "20", page: "1", Account: strVal },
    { limit: "20", page: "1", username: strVal },
    { limit: "20", page: "1", search: strVal },
    { limit: "20", page: "1", account: strVal },
  ] as Record<string, string>[]) {
    try {
      const res = await opts.fetchList(params);
      const match = tryMatch(res.data);
      if (match) {
        cachePlayerId(opts.agentKey, strVal, match.id);
        return String(match.id);
      }
    } catch {
      // try next filter shape
    }
  }

  const fallback = await opts.fetchList({ limit: "100", page: "1" });
  const match = tryMatch(fallback.data);
  if (match) {
    cachePlayerId(opts.agentKey, strVal, match.id);
    return String(match.id);
  }

  throw new Error(`Player '${strVal}' not found on agent account.`);
}
