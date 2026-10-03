/** 
 * 24/7 Session Keeper with Singleton Browser Guard & Automatic Auto-Re-login
 * - Prevents duplicate Chrome tabs/windows from opening
 * - Auto-re-logs in seamlessly when session expires without manual login
 * - Keeps session warm for instant < 1.5s recharges & redeems
 */

function env(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

const activeBotInstances = new Set<string>();

export function isSessionKeeperEnabled(): boolean {
  const raw = (env("SESSION_KEEPER") ?? "true").toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "off";
}

export function sessionCheckIntervalMs(): number {
  const n = Number(env("SESSION_CHECK_MS") ?? 120_000);
  return Number.isFinite(n) && n >= 60_000 ? Math.floor(n) : 120_000;
}

export async function startPanelSessionKeeper(
  botLabel: string,
  ensureLoggedIn: () => Promise<void>
): Promise<void> {
  if (!isSessionKeeperEnabled()) {
    console.log(`[${botLabel}] Session keeper disabled (SESSION_KEEPER=false)`);
    return;
  }

  // Prevent duplicate browser tabs / worker loops (Singleton Guard)
  if (activeBotInstances.has(botLabel)) {
    console.log(`[${botLabel}] 🟢 Singleton Guard: Active session instance already running. Skipping duplicate browser launch.`);
    return;
  }
  activeBotInstances.add(botLabel);

  const intervalMs = sessionCheckIntervalMs();

  const check = async (reason: "startup" | "interval" | "relogin") => {
    try {
      console.log(`[${botLabel}] 🟢 24/7 Auto-Keep-Alive & Session Health Check (${reason})...`);
      await ensureLoggedIn();
      console.log(`[${botLabel}] ✨ Session active, validated & warm! (0 manual logins required)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[${botLabel}] ⚠️ Session expired or invalid: ${msg} — Executing Auto-Relogin...`);
      try {
        await ensureLoggedIn();
        console.log(`[${botLabel}] 🟢 Auto-Relogin successful! Restored active panel session.`);
      } catch (reloginErr) {
        console.error(`[${botLabel}] ❌ Auto-Relogin retry note:`, reloginErr);
      }
    }
  };

  await check("startup");

  const jitterMs = Math.abs(botLabel.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % 30_000;
  setTimeout(() => {
    setInterval(() => {
      void check("interval");
    }, intervalMs);
  }, jitterMs);

  console.log(
    `[${botLabel}] 🟢 24/7 AUTO-SESSION KEEPER ACTIVE — checks every ${Math.round(intervalMs / 1000)}s (staggered)`
  );
}
