import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/actions/admin/core";
import { fulfillTrackedRequest } from "@/lib/actions/game-loads";
import { assignPlayerToAgentByCode } from "@/lib/agents/assign";
import { bonusForPercent, depositKind } from "@/lib/payments/bonus-math";
import { isJuwaApiConfigured } from "@/lib/game-automation/juwa-api";
import { isVegasApiConfigured } from "@/lib/game-automation/vegas-api";
import { isCashMachineApiConfigured } from "@/lib/game-automation/cashmachine-service";
import { isCashFrenzyApiConfigured } from "@/lib/game-automation/cashfrenzy-service";
import { isGameroomApiConfigured } from "@/lib/game-automation/gameroom-service";
import { isMrAllInOneApiConfigured } from "@/lib/game-automation/mrallinone-api";
import { isGameVaultApiConfigured } from "@/lib/game-automation/gamevault-service";
import { isMafiaApiConfigured } from "@/lib/game-automation/mafia-api";
import { isOrionStarsApiConfigured } from "@/lib/game-automation/orionstars-api";
import { isMilkyWayApiConfigured } from "@/lib/game-automation/milkyway-api";
import { isFireKirinApiConfigured } from "@/lib/game-automation/firekirin-api";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

export type DepositQuote = {
  gameSlug: string | null;
  gameName: string | null;
  promoCode: string | null;
  baseAmount: number;
  bonusPercent: number;
  bonusAmount: number;
  finalCredit: number;
  kind: "first" | "reload";
};

export class PaymentIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentIdentityError";
  }
}

function missingTable(error: { message?: string } | null) {
  return /schema cache|does not exist|payment_intents|deposit_bonus_ledger|source_key/i.test(error?.message ?? "");
}

function migrationError(error: { message?: string }) {
  return new PaymentIdentityError(
    missingTable(error)
      ? "Apply supabase/migrations/20261008000130_auto_ops.sql before crediting deposits."
      : error.message || "Payment intent lookup failed"
  );
}

function apiReady(slug: string) {
  switch (slug) {
    case "juwa":
      return isJuwaApiConfigured();
    case "vegas-sweeps":
      return isVegasApiConfigured();
    case "cash-machine":
      return isCashMachineApiConfigured();
    case "cash-frenzy":
      return isCashFrenzyApiConfigured();
    case "gameroom":
      return isGameroomApiConfigured();
    case "mr-all-in-one":
      return isMrAllInOneApiConfigured();
    case "game-vault":
      return isGameVaultApiConfigured();
    case "mafia":
      return isMafiaApiConfigured();
    case "orion-stars":
      return isOrionStarsApiConfigured();
    case "milky-way":
      return isMilkyWayApiConfigured();
    case "fire-kirin":
      return isFireKirinApiConfigured();
    default:
      return false;
  }
}

export async function rememberPaymentIntent(
  admin: Admin,
  input: {
    provider: string;
    externalId: string;
    userId: string;
    gameSlug?: string | null;
    gameName?: string | null;
    promoCode?: string | null;
    baseAmount: number;
  }
) {
  const row: Record<string, string | number | null> = {
    provider: input.provider,
    external_id: input.externalId,
    user_id: input.userId,
    base_amount: input.baseAmount,
  };
  if (input.gameSlug) row.game_slug = input.gameSlug;
  if (input.gameName) row.game_name = input.gameName;
  if (input.promoCode) row.promo_code = input.promoCode;
  const { error } = await admin.from("payment_intents").upsert(row, { onConflict: "provider,external_id" });
  if (error) throw migrationError(error);
}

async function lockQuote(admin: Admin, provider: string, externalId: string, quote: DepositQuote) {
  const { data, error } = await admin
    .from("payment_intents")
    .update({
      game_slug: quote.gameSlug,
      game_name: quote.gameName,
      bonus_percent: quote.bonusPercent,
      bonus_amount: quote.bonusAmount,
      final_credit: quote.finalCredit,
      deposit_kind: quote.kind,
    })
    .eq("provider", provider)
    .eq("external_id", externalId)
    .is("final_credit", null)
    .select("bonus_percent, bonus_amount, final_credit, deposit_kind, game_slug, game_name, promo_code, base_amount")
    .maybeSingle();
  if (error) throw migrationError(error);
  if (data) return data as QuoteRow;
  const { data: existing, error: readError } = await admin
    .from("payment_intents")
    .select("bonus_percent, bonus_amount, final_credit, deposit_kind, game_slug, game_name, promo_code, base_amount")
    .eq("provider", provider)
    .eq("external_id", externalId)
    .maybeSingle();
  if (readError) throw migrationError(readError);
  return (existing as QuoteRow | null) ?? null;
}

type QuoteRow = {
  bonus_percent: number | null;
  bonus_amount: number | null;
  final_credit: number | null;
  deposit_kind: "first" | "reload" | null;
  game_slug: string | null;
  game_name: string | null;
  promo_code: string | null;
  base_amount: number | null;
};

export async function quotePaidDeposit(
  admin: Admin,
  input: {
    provider?: string;
    userId: string;
    depositId: string;
    baseAmount: number;
    gameSlug?: string | null;
    gameName?: string | null;
    promoCode?: string | null;
  }
): Promise<DepositQuote> {
  const provider = input.provider || "paydora";
  const baseAmount = Math.round(input.baseAmount * 100) / 100;

  const { data: intent, error: intentError } = await admin
    .from("payment_intents")
    .select("game_slug, game_name, promo_code, final_credit, bonus_percent, bonus_amount, deposit_kind, base_amount")
    .eq("provider", provider)
    .eq("external_id", input.depositId)
    .maybeSingle();
  if (intentError) throw migrationError(intentError);
  const row = intent as QuoteRow | null;
  if (!row?.game_slug) {
    throw new PaymentIdentityError("Payment intent or game is missing");
  }

  if (row.final_credit != null) {
    return {
      gameSlug: row.game_slug,
      gameName: row.game_name,
      promoCode: row.promo_code,
      baseAmount: Number(row.base_amount ?? baseAmount),
      bonusPercent: Number(row.bonus_percent ?? 0),
      bonusAmount: Number(row.bonus_amount ?? 0),
      finalCredit: Number(row.final_credit),
      kind: row.deposit_kind === "first" ? "first" : "reload",
    };
  }

  const gameSlug = row.game_slug;
  const { count, error: countError } = await admin
    .from("deposit_bonus_ledger")
    .select("id", { count: "exact", head: true })
    .eq("user_id", input.userId)
    .eq("game_slug", gameSlug)
    .eq("wallet_credited", true);
  if (countError) throw migrationError(countError);
  const { count: lockedFirst, error: lockedError } = await admin
    .from("payment_intents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", input.userId)
    .eq("game_slug", gameSlug)
    .eq("deposit_kind", "first")
    .not("final_credit", "is", null);
  if (lockedError) throw migrationError(lockedError);
  const kind = depositKind((count ?? 0) + (lockedFirst ?? 0));
  const { data: game, error: gameError } = await admin
    .from("games")
    .select("name, first_deposit_bonus_percent, reload_bonus_percent")
    .eq("slug", gameSlug)
    .maybeSingle();
  if (gameError) throw migrationError(gameError);
  if (!game) throw new PaymentIdentityError("Payment intent or game is missing");
  const stored = game as { name?: string; first_deposit_bonus_percent?: number; reload_bonus_percent?: number };
  const percent = Number(kind === "first" ? stored.first_deposit_bonus_percent : stored.reload_bonus_percent);
  if (!Number.isFinite(percent)) {
    throw new PaymentIdentityError("Apply supabase/migrations/20261008000130_auto_ops.sql before crediting deposits.");
  }
  const priced = bonusForPercent(baseAmount, percent);
  const quote: DepositQuote = {
    gameSlug,
    gameName: stored.name || row.game_name,
    promoCode: row.promo_code || input.promoCode || null,
    baseAmount: priced.base,
    bonusPercent: priced.percent,
    bonusAmount: priced.bonus,
    finalCredit: priced.finalCredit,
    kind,
  };
  const locked = await lockQuote(admin, provider, input.depositId, quote);
  if (locked?.final_credit == null || !locked.game_slug) {
    throw new PaymentIdentityError("Payment intent or game is missing");
  }
  return {
    gameSlug: locked.game_slug,
    gameName: locked.game_name,
    promoCode: locked.promo_code,
    baseAmount: Number(locked.base_amount ?? priced.base),
    bonusPercent: Number(locked.bonus_percent ?? 0),
    bonusAmount: Number(locked.bonus_amount ?? 0),
    finalCredit: Number(locked.final_credit),
    kind: locked.deposit_kind === "first" ? "first" : "reload",
  };
}

async function markWebhook(admin: Admin, depositId: string, status: "processed" | "failed", error?: string) {
  await admin.from("webhook_events").upsert(
    {
      provider: "paydora",
      event_key: depositId,
      event_name: "deposit.paid",
      status,
      error: error?.slice(0, 500) ?? null,
      processed_at: new Date().toISOString(),
    },
    { onConflict: "provider,event_key" }
  );
}

export async function settleDepositSideEffects(
  admin: Admin,
  input: {
    userId: string;
    depositId: string;
    quote: DepositQuote;
    walletCredited: boolean;
  }
) {
  const key = input.depositId;
  const { error: ledgerError } = await admin.from("deposit_bonus_ledger").upsert(
    {
      deposit_key: key,
      user_id: input.userId,
      game_slug: input.quote.gameSlug,
      base_amount: input.quote.baseAmount,
      bonus_percent: input.quote.bonusPercent,
      bonus_amount: input.quote.bonusAmount,
      final_credit: input.quote.finalCredit,
      deposit_kind: input.quote.kind,
      wallet_credited: input.walletCredited,
    },
    { onConflict: "deposit_key", ignoreDuplicates: true }
  );
  if (ledgerError) throw migrationError(ledgerError);

  if (input.quote.promoCode) {
    const { data: profile } = await admin.from("profiles").select("parent_agent_id").eq("id", input.userId).maybeSingle();
    if (!(profile as { parent_agent_id?: string | null } | null)?.parent_agent_id) {
      await assignPlayerToAgentByCode(input.userId, input.quote.promoCode);
    }
  }

  const { data: player } = await admin.from("profiles").select("parent_agent_id").eq("id", input.userId).maybeSingle();
  const agentId = (player as { parent_agent_id?: string | null } | null)?.parent_agent_id;
  if (agentId) {
    const { data: agent } = await admin
      .from("agent_accounts")
      .select("commission_bps, active")
      .eq("user_id", agentId)
      .maybeSingle();
    const bps = Number((agent as { commission_bps?: number; active?: boolean } | null)?.commission_bps ?? 0);
    const active = (agent as { active?: boolean } | null)?.active !== false;
    if (active && bps > 0) {
      const commission = Math.round(input.quote.baseAmount * bps) / 10000;
      await admin.from("agent_commissions").upsert(
        {
          deposit_key: key,
          agent_id: agentId,
          player_id: input.userId,
          base_amount: input.quote.baseAmount,
          commission_bps: bps,
          commission_amount: commission,
        },
        { onConflict: "deposit_key", ignoreDuplicates: true }
      );
    }
  }

  await loadGameOnce(admin, input);
  await notifyOnce(admin, input, agentId);
  await writeAudit({
    actorId: input.userId,
    action: "deposit.auto_settle",
    entityType: "deposit_request",
    entityId: key,
    after: {
      base: input.quote.baseAmount,
      bonusPercent: input.quote.bonusPercent,
      bonus: input.quote.bonusAmount,
      finalCredit: input.quote.finalCredit,
      kind: input.quote.kind,
      game: input.quote.gameSlug,
    },
  });
  await markWebhook(admin, key, "processed");
}

async function loadGameOnce(
  admin: Admin,
  input: { userId: string; depositId: string; quote: DepositQuote }
) {
  if (!input.quote.gameSlug) {
    await admin
      .from("deposit_bonus_ledger")
      .update({ game_load_status: "skipped", game_load_error: "No game was attached to this deposit." })
      .eq("deposit_key", input.depositId)
      .eq("game_load_status", "pending");
    return;
  }
  if (!apiReady(input.quote.gameSlug)) {
    const sourceKey = `auto:${input.depositId}`;
    const { error: insertError } = await admin.from("game_load_requests").insert({
      user_id: input.userId,
      game_slug: input.quote.gameSlug,
      game_name: input.quote.gameName || input.quote.gameSlug,
      amount: input.quote.finalCredit,
      wallet_type: "current",
      load_type: "reload",
      status: "failed",
      source_key: sourceKey,
      wallet_refunded: true,
      error_message: "Game API credentials are not configured.",
      admin_notes: "Automatic deposit load was not sent. The wallet credit stays until retry.",
    });
    if (insertError && !/duplicate|unique/i.test(insertError.message)) throw migrationError(insertError);
    await admin
      .from("deposit_bonus_ledger")
      .update({
        game_load_status: "failed",
        game_load_error: "Game API credentials are not configured.",
      })
      .eq("deposit_key", input.depositId)
      .in("game_load_status", ["pending", "failed"]);
    return;
  }

  const { data: game } = await admin.from("games").select("id, name").eq("slug", input.quote.gameSlug).maybeSingle();
  const gameId = (game as { id?: string; name?: string } | null)?.id;
  let username: string | null = null;
  if (gameId) {
    const { data: account } = await admin
      .from("game_accounts")
      .select("game_username")
      .eq("user_id", input.userId)
      .eq("game_id", gameId)
      .maybeSingle();
    username = (account as { game_username?: string } | null)?.game_username ?? null;
  }
  if (!username) {
    username = `${input.quote.gameSlug.replace(/[^a-z0-9]/gi, "").slice(0, 6)}_${input.userId.slice(0, 8)}`;
    const accountKey = `auto-account:${input.depositId}`;
    const { data: existingAccountJob } = await admin
      .from("game_load_requests")
      .select("id, status, game_username")
      .eq("source_key", accountKey)
      .maybeSingle();
    let accountRequestId = (existingAccountJob as { id?: string; game_username?: string | null; status?: string } | null)?.id;
    if (!accountRequestId) {
      const { data: inserted } = await admin
        .from("game_load_requests")
        .insert({
          user_id: input.userId,
          game_slug: input.quote.gameSlug,
          game_name: input.quote.gameName || input.quote.gameSlug,
          amount: 0,
          wallet_type: "current",
          load_type: "create_account",
          game_username: username,
          status: "pending",
          source_key: accountKey,
          admin_notes: "Automatic account create",
        })
        .select("id")
        .maybeSingle();
      accountRequestId = (inserted as { id?: string } | null)?.id;
    }
    if (accountRequestId) {
      const created = await fulfillTrackedRequest(accountRequestId);
      if (!created.success) {
        await admin
          .from("deposit_bonus_ledger")
          .update({ game_load_status: "failed", game_load_error: created.error || "Could not create the game account." })
          .eq("deposit_key", input.depositId);
        return;
      }
      const { data: done } = await admin.from("game_load_requests").select("game_username").eq("id", accountRequestId).maybeSingle();
      username = (done as { game_username?: string | null } | null)?.game_username || username;
    }
  }

  const sourceKey = `auto:${input.depositId}`;
  const { data: requestId, error } = await admin.rpc("request_auto_game_load", {
    p_user_id: input.userId,
    p_game_slug: input.quote.gameSlug,
    p_game_name: input.quote.gameName || input.quote.gameSlug,
    p_amount: input.quote.finalCredit,
    p_game_username: username,
    p_source_key: sourceKey,
  });
  if (error || !requestId) {
    await admin
      .from("deposit_bonus_ledger")
      .update({
        game_load_status: "failed",
        game_load_error: error?.message || "Could not reserve the game load.",
      })
      .eq("deposit_key", input.depositId);
    return;
  }
  const loaded = await fulfillTrackedRequest(String(requestId));
  await admin
    .from("deposit_bonus_ledger")
    .update({
      game_load_status: loaded.success ? "loaded" : "failed",
      game_load_request_id: String(requestId),
      game_load_error: loaded.success ? null : loaded.error || "Game load failed.",
    })
    .eq("deposit_key", input.depositId);
}

async function notifyOnce(
  admin: Admin,
  input: { userId: string; depositId: string; quote: DepositQuote },
  agentId: string | null | undefined
) {
  const { data: claimed } = await admin
    .from("deposit_bonus_ledger")
    .update({ notified_at: new Date().toISOString() })
    .eq("deposit_key", input.depositId)
    .is("notified_at", null)
    .select("id")
    .maybeSingle();
  if (!claimed) return;
  const message = input.quote.bonusAmount > 0
    ? `$${input.quote.baseAmount.toFixed(2)} deposit plus $${input.quote.bonusAmount.toFixed(2)} bonus (${input.quote.bonusPercent}%) is in your wallet.`
    : `$${input.quote.baseAmount.toFixed(2)} deposit is in your wallet.`;
  await admin.from("notifications").insert({
    user_id: input.userId,
    title: "Deposit confirmed",
    message,
    type: "success",
    is_read: false,
  });
  if (agentId) {
    await admin.from("notifications").insert({
      user_id: agentId,
      title: "Player deposit",
      message: `A player deposited $${input.quote.baseAmount.toFixed(2)}.`,
      type: "info",
      is_read: false,
    });
  }
}
