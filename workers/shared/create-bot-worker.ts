import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { startBotHeartbeat, type BotHeartbeatHandle } from "./bot-heartbeat.js";
import { enrichGameLoadJob } from "./enrich-game-load-job.js";
import {
  countActiveGameLoads,
  healStaleGameLoadsForSlug,
} from "./heal-stale-game-loads.js";
import { startPanelSessionKeeper } from "./panel-session-keeper.js";
import type { BotJobResult, GameLoadJob } from "./game-load-job.js";
import { sanitizeBotErrorForUser } from "./user-facing-error.js";

export interface BotWorkerConfig {
  botLabel: string;
  gameSlug: string;
  pollMs: number;
  envPathHint: string;
  ensurePanelLoggedIn: () => Promise<void>;
  runJob: (job: GameLoadJob, supabase: SupabaseClient) => Promise<BotJobResult>;
}

function createAdminSupabase(envPathHint: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(`Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in ${envPathHint}`);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function claimNext(
  supabase: SupabaseClient,
  gameSlug: string,
  botLabel: string
): Promise<GameLoadJob | null> {
  const healed = await healStaleGameLoadsForSlug(supabase, gameSlug, {
    staleMinutes: 20,
    requeueMinutes: 2,
  });
  if (healed.failed > 0 || healed.requeued > 0) {
    console.log(
      `[${botLabel}] Queue heal: ${healed.requeued} re-queued, ${healed.failed} timed out`
    );
  }

  const { data, error } = await supabase.rpc("claim_next_game_load", { p_game_slug: gameSlug });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as GameLoadJob | undefined) ?? null;
}

async function completeJob(
  supabase: SupabaseClient,
  jobId: string,
  success: boolean,
  result: { username?: string; password?: string; error?: string; redeemedAmount?: number },
  loadType?: string
) {
  const { error } = await supabase.rpc("complete_game_load", {
    p_request_id: jobId,
    p_success: success,
    p_game_username: result.username ?? null,
    p_game_password: result.password ?? null,
    p_error_message: result.error ?? null,
    p_redeemed_amount: result.redeemedAmount ?? null,
  });

  if (error && success && loadType === "redeem" && result.redeemedAmount) {
    console.warn(`[complete_game_load] ${jobId} failed, trying credit_redeem_completion:`, error.message);
    const { error: fallbackErr } = await supabase.rpc("credit_redeem_completion", {
      p_request_id: jobId,
      p_redeemed_amount: result.redeemedAmount,
      p_game_username: result.username ?? null,
    });
    if (fallbackErr) {
      console.error(`[credit_redeem_completion] ${jobId}:`, fallbackErr.message);
      throw fallbackErr;
    }
    return;
  }

  if (error) {
    console.error(`[complete_game_load] ${jobId}:`, error.message);
    throw error;
  }
}

async function sendSuccessNotification(
  supabase: SupabaseClient,
  botLabel: string,
  job: GameLoadJob,
  enrichedJob: GameLoadJob,
  result: BotJobResult
) {
  const credMsg = result.password
    ? `Username: ${result.username} | Password: ${result.password}`
    : `Account: ${result.username}`;
  const isCreate =
    enrichedJob.load_type === "create_account" || enrichedJob.load_type === "new_account";
  const isRedeem = enrichedJob.load_type === "redeem";
  const isCheck = enrichedJob.load_type === "check_balance";
  const redeemDest = enrichedJob.wallet_type === "bonus" ? "Bonus Redeem" : "Deposit Redeem";
  const redeemLabel = enrichedJob.redeem_all
    ? `$${Number(result.redeemedAmount ?? job.amount).toFixed(2)} (full balance)`
    : `$${Number(result.redeemedAmount ?? job.amount).toFixed(2)}`;

  const { error: notifyError } = await supabase.from("notifications").insert({
    user_id: job.user_id,
    title: isCreate
      ? `${enrichedJob.game_name} account ready`
      : isRedeem
        ? `${enrichedJob.game_name} redeem complete`
        : isCheck
          ? `${enrichedJob.game_name} balance`
          : `${enrichedJob.game_name} load complete`,
    message: isCreate
      ? `Your account was created. ${credMsg}`
      : isRedeem
        ? `${redeemLabel} redeemed to your ${redeemDest} wallet. ${credMsg}`
        : isCheck
          ? `Your ${enrichedJob.game_name} balance is $${Number(result.balance ?? 0).toFixed(2)}.`
          : `$${Number(job.amount).toFixed(2)} loaded. ${credMsg}`,
    type: "success",
  });
  if (notifyError) console.warn(`[${botLabel}] Notification failed:`, notifyError.message);
}

async function processOne(
  supabase: SupabaseClient,
  config: BotWorkerConfig,
  heartbeat: BotHeartbeatHandle
): Promise<boolean> {
  const job = await claimNext(supabase, config.gameSlug, config.botLabel);
  if (!job) return false;

  console.log(
    `[${config.botLabel}] Processing job ${job.id} — $${job.amount} (${job.load_type})`
  );

  const enrichedJob = await enrichGameLoadJob(supabase, job);
  heartbeat.setStatus("busy");

  try {
    const result = await config.runJob(enrichedJob, supabase);
    await completeJob(supabase, job.id, true, {
      ...result,
      redeemedAmount: result.redeemedAmount ?? result.balance,
    }, enrichedJob.load_type);
    await sendSuccessNotification(supabase, config.botLabel, job, enrichedJob, result);
    heartbeat.recordJobComplete();
    console.log(`[${config.botLabel}] Completed ${job.id} → user ${result.username}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${config.botLabel}] Failed ${job.id}:`, message);
    try {
      await completeJob(supabase, job.id, false, {
        error: sanitizeBotErrorForUser(message, enrichedJob.load_type),
      }, enrichedJob.load_type);
    } catch (completeErr) {
      console.error(`[${config.botLabel}] Could not mark job failed:`, completeErr);
    }
  } finally {
    heartbeat.setStatus("idle");
  }

  return true;
}

/** Standard poll loop used by all 8 game bots. */
export async function runBotWorker(config: BotWorkerConfig): Promise<void> {
  const once = process.argv.includes("--once");
  const supabase = createAdminSupabase(config.envPathHint);
  const heartbeat = startBotHeartbeat(config.gameSlug);

  console.log(`[${config.botLabel}] Started — polling for ${config.gameSlug} wallet load jobs`);

  await startPanelSessionKeeper(config.botLabel, config.ensurePanelLoggedIn);

  do {
    try {
      const handled = await processOne(supabase, config, heartbeat);
      if (once) break;
      if (!handled) {
        const counts = await countActiveGameLoads(supabase, config.gameSlug);
        if (counts.processing > 0 && counts.pending === 0) {
          console.log(
            `[${config.botLabel}] Waiting — ${counts.processing} job(s) processing, 0 pending`
          );
        }
        await new Promise((r) => setTimeout(r, config.pollMs));
      }
    } catch (err) {
      console.error(`[${config.botLabel}] Poll error (continuing):`, err);
      if (once) break;
      await new Promise((r) => setTimeout(r, config.pollMs));
    }
  } while (!once);

  heartbeat.stop();
  console.log(`[${config.botLabel}] Done`);
}
