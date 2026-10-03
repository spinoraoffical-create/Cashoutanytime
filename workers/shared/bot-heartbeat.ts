import { createClient } from "@supabase/supabase-js";

export type BotHeartbeatStatus = "online" | "busy" | "idle" | "offline";

export interface BotHeartbeatHandle {
  setStatus: (status: BotHeartbeatStatus) => void;
  recordJobComplete: () => void;
  stop: () => void;
}

export function startBotHeartbeat(
  botSlug: string,
  intervalMs = 30_000
): BotHeartbeatHandle {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.warn(`[bot-heartbeat] Missing Supabase keys for ${botSlug}`);
    return {
      setStatus: () => {},
      recordJobComplete: () => {},
      stop: () => {},
    };
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  let currentStatus: BotHeartbeatStatus = "online";
  let jobsProcessed = 0;
  let stopped = false;

  const sendPing = async (status?: BotHeartbeatStatus) => {
    if (stopped) return;
    const s = status ?? currentStatus;
    try {
      await supabase.from("system_health_logs").insert({
        health_score: s === "offline" ? 0 : 100,
        seo_metrics: {},
        cron_metrics: {
          bot: botSlug,
          status: s,
          jobsProcessed,
          ping: new Date().toISOString(),
        },
        database_metrics: { botSlug, jobsProcessed },
        recommendations: [],
      });
    } catch {
      /* ignore heartbeat errors — must not break bot loop */
    }
  };

  void sendPing("online");
  const timer = setInterval(() => void sendPing(), intervalMs);

  return {
    setStatus: (status) => {
      currentStatus = status;
      void sendPing(status);
    },
    recordJobComplete: () => {
      jobsProcessed += 1;
    },
    stop: () => {
      stopped = true;
      clearInterval(timer);
      void sendPing("offline");
    },
  };
}
