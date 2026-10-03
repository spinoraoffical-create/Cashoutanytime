/**
 * Registry of all 8 game bot workers — used by admin dashboard + smoke tests.
 */
export const GAME_BOT_REGISTRY = [
  {
    id: "juwa",
    name: "Juwa 777 Bot",
    slug: "juwa",
    botLabel: "juwa-bot",
    panelUrl: "ht.juwa777.com",
    cdpPort: 9222,
  },
  {
    id: "vegas",
    name: "Vegas Sweeps Bot",
    slug: "vegas-sweeps",
    botLabel: "vegas-bot",
    panelUrl: "agent.lasvegassweeps.com",
    cdpPort: 9222,
  },
  {
    id: "gamevault",
    name: "Game Vault Bot",
    slug: "game-vault",
    botLabel: "gamevault-bot",
    panelUrl: "agent.gamevault999.com",
    cdpPort: 9222,
  },
  {
    id: "gameroom",
    name: "Gameroom Bot",
    slug: "gameroom",
    botLabel: "gameroom-bot",
    panelUrl: "agentserver1.gameroom777.com",
    cdpPort: 9222,
  },
  {
    id: "cashmachine",
    name: "Cash Machine Bot",
    slug: "cash-machine",
    botLabel: "cashmachine-bot",
    panelUrl: "agentserver.cashmachine777.com",
    cdpPort: 9222,
  },
  {
    id: "mrallinone",
    name: "MR All-In-One Bot",
    slug: "mr-all-in-one",
    botLabel: "mr-all-in-one-bot",
    panelUrl: "agentserver.mrallinone777.com",
    cdpPort: 9222,
  },
  {
    id: "mafia",
    name: "Mafia Bot",
    slug: "mafia",
    botLabel: "mafia-bot",
    panelUrl: "agentserver.mafia77777.com",
    cdpPort: 9222,
  },
  {
    id: "cashfrenzy",
    name: "Cash Frenzy Bot",
    slug: "cash-frenzy",
    botLabel: "cash-frenzy-bot",
    panelUrl: "agentserver.cashfrenzy777.com",
    cdpPort: 9222,
  },
] as const;

export type GameBotSlug = (typeof GAME_BOT_REGISTRY)[number]["slug"];

export interface BotLiveStatus {
  id: string;
  name: string;
  slug: string;
  panelUrl: string;
  status: "online" | "busy" | "idle" | "offline" | "unknown";
  lastPing: string | null;
  jobsProcessed: number;
  secondsSincePing: number | null;
}

const ONLINE_THRESHOLD_SEC = 90;

export async function fetchBotLiveStatuses(): Promise<BotLiveStatus[]> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const db = createAdminClient();
  if (!db) {
    return GAME_BOT_REGISTRY.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      panelUrl: b.panelUrl,
      status: "unknown" as const,
      lastPing: null,
      jobsProcessed: 0,
      secondsSincePing: null,
    }));
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: rows } = await db
    .from("system_health_logs")
    .select("cron_metrics, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500);

  const latestBySlug = new Map<string, { status: string; jobsProcessed: number; ping: string }>();

  for (const row of rows ?? []) {
    const metrics = row.cron_metrics as {
      bot?: string;
      status?: string;
      jobsProcessed?: number;
      ping?: string;
    } | null;
    const slug = metrics?.bot?.trim();
    if (!slug || latestBySlug.has(slug)) continue;
    latestBySlug.set(slug, {
      status: metrics?.status ?? "online",
      jobsProcessed: Number(metrics?.jobsProcessed ?? 0),
      ping: metrics?.ping ?? row.created_at,
    });
  }

  const now = Date.now();

  return GAME_BOT_REGISTRY.map((b) => {
    const latest = latestBySlug.get(b.slug);
    if (!latest) {
      return {
        id: b.id,
        name: b.name,
        slug: b.slug,
        panelUrl: b.panelUrl,
        status: "offline" as const,
        lastPing: null,
        jobsProcessed: 0,
        secondsSincePing: null,
      };
    }

    const pingMs = new Date(latest.ping).getTime();
    const secondsSincePing = Math.floor((now - pingMs) / 1000);
    const isRecent = secondsSincePing <= ONLINE_THRESHOLD_SEC;
    const rawStatus = latest.status as BotLiveStatus["status"];

    let status: BotLiveStatus["status"];
    if (!isRecent || rawStatus === "offline") {
      status = "offline";
    } else if (rawStatus === "busy") {
      status = "busy";
    } else if (rawStatus === "idle") {
      status = "idle";
    } else {
      status = "online";
    }

    return {
      id: b.id,
      name: b.name,
      slug: b.slug,
      panelUrl: b.panelUrl,
      status,
      lastPing: latest.ping,
      jobsProcessed: latest.jobsProcessed,
      secondsSincePing,
    };
  });
}
