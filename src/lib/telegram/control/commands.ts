import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  CUSTOMER_COMMANDS,
  OWNER_COMMANDS,
  REPORT_TIMEZONE,
  customerCommandAllowed,
  customerWalletText,
  ownerCommandAllowed,
  reportWindow,
  summarizeMoney,
  type CommandActor,
  type MoneyRow,
} from "@/lib/telegram/control/rules";

const HELP_OWNER = [
  "Owner commands are read-only.",
  "/today /yesterday /deposits /payouts /pending",
  "/failedloads /reconcile /players /signups /tickets /health /report",
  `Times use ${REPORT_TIMEZONE}.`,
  "A missing number is shown as unavailable.",
].join("\n");

const HELP_CUSTOMER = [
  "/link code — connect this chat with a code from the website",
  "/wallet — your cash-out balance",
  "/status — whether this chat is linked",
  "/ticket note — open a support note",
  "/unlink — disconnect this chat",
  "This bot cannot move money.",
].join("\n");

export async function actorForTelegram(telegramUserId: number, bot: "owner" | "support"): Promise<CommandActor> {
  const empty: CommandActor = { linked: false, purpose: null, isSuperAdmin: false, userId: null };
  const admin = createAdminClient();
  if (!admin) return empty;
  const purpose = bot === "owner" ? "owner" : "customer";
  const { data, error } = await admin
    .from("telegram_account_links")
    .select("user_id, purpose, revoked_at")
    .eq("telegram_user_id", telegramUserId)
    .eq("purpose", purpose)
    .is("revoked_at", null)
    .maybeSingle();
  if (error || !data) return empty;
  const row = data as { user_id: string; purpose: "owner" | "customer" };
  let isSuperAdmin = false;
  if (purpose === "owner") {
    const { data: roles } = await admin
      .from("user_roles")
      .select("roles(key)")
      .eq("user_id", row.user_id);
    isSuperAdmin = ((roles ?? []) as unknown as Array<{ roles?: { key?: string } | null }>).some(
      (item) => item.roles?.key === "super_admin"
    );
  }
  return { linked: true, purpose: row.purpose, isSuperAdmin, userId: row.user_id };
}

export async function replyToCommand(input: {
  bot: "owner" | "support";
  telegramUserId: number;
  name: string;
  arg: string;
}): Promise<string> {
  const actor = await actorForTelegram(input.telegramUserId, input.bot);
  if (input.bot === "owner") return ownerReply(actor, input.name);
  return customerReply(actor, input.name, input.arg, input.telegramUserId);
}

async function ownerReply(actor: CommandActor, name: string): Promise<string> {
  if (!ownerCommandAllowed(actor)) {
    return "This command is only for a linked owner account.";
  }
  if (name === "start" || name === "help") return HELP_OWNER;
  if (!(OWNER_COMMANDS as readonly string[]).includes(name)) return "Unknown command. Use /help.";
  if (name === "health") return healthText();
  if (name === "today" || name === "yesterday" || name === "report") {
    const which = name === "yesterday" ? "yesterday" : "today";
    return reportText(which);
  }
  if (name === "deposits") return reportText("today", "deposits");
  if (name === "payouts") return reportText("today", "payouts");
  if (name === "pending") return countText("game_load_requests", "pending");
  if (name === "failedloads") return countText("game_load_requests", "failed");
  if (name === "reconcile") return "Open /admin/reconciliation. This chat does not change those rows.";
  if (name === "players" || name === "signups") return signupText(name === "signups" ? "today" : "all");
  if (name === "tickets") return countText("support_tickets", "open");
  return HELP_OWNER;
}

async function customerReply(actor: CommandActor, name: string, arg: string, telegramUserId: number): Promise<string> {
  if (name === "start" || name === "help") return HELP_CUSTOMER;
  if (!(CUSTOMER_COMMANDS as readonly string[]).includes(name)) return "Unknown command. Use /help.";
  if (name === "link") return "Open the website while signed in. Use the link button there. Do not send the code in a group.";
  if (!customerCommandAllowed(actor, actor.userId)) return "Link this chat from the website first.";
  if (name === "status") return "This chat is linked to your account.";
  if (name === "unlink") return unlink(telegramUserId);
  if (name === "wallet") return wallet(actor.userId);
  if (name === "ticket") return openTicket(actor.userId, arg);
  return HELP_CUSTOMER;
}

async function wallet(userId: string | null): Promise<string> {
  if (!userId) return customerWalletText({ linked: false, balance: null });
  const admin = createAdminClient();
  if (!admin) return customerWalletText({ linked: true, balance: null });
  const { data, error } = await admin.from("profiles").select("cashout_wallet").eq("id", userId).maybeSingle();
  if (error) return customerWalletText({ linked: true, balance: null });
  const balance = Number((data as { cashout_wallet?: number } | null)?.cashout_wallet);
  return customerWalletText({ linked: true, balance: Number.isFinite(balance) ? balance : null });
}

async function unlink(telegramUserId: number): Promise<string> {
  const admin = createAdminClient();
  if (!admin) return "Unlink is unavailable.";
  const { error } = await admin
    .from("telegram_account_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("telegram_user_id", telegramUserId)
    .eq("purpose", "customer")
    .is("revoked_at", null);
  if (error) return "Unlink is unavailable.";
  return "This chat is disconnected. Money was not changed.";
}

async function openTicket(userId: string | null, note: string): Promise<string> {
  if (!userId) return "Link this chat first.";
  const text = note.trim();
  if (text.length < 3) return "Add a short note, then also open the ticket on the website support page. This chat cannot move money.";
  return `Note received (${text.slice(0, 80)}). Open the website support page to file the ticket. This chat cannot move money.`;
}

function healthText(): string {
  const names = ["TELEGRAM_PAYMENTS_BOT_TOKEN", "TELEGRAM_PLAYERS_BOT_TOKEN", "TELEGRAM_ERRORS_BOT_TOKEN", "TELEGRAM_OWNER_BOT_TOKEN", "TELEGRAM_SUPPORT_BOT_TOKEN"];
  const ready = names.filter((name) => Boolean(process.env[name]?.trim())).length;
  return `Bots with a token set: ${ready} of ${names.length}. Time zone: ${REPORT_TIMEZONE}.`;
}

async function reportText(which: "today" | "yesterday", focus?: "deposits" | "payouts"): Promise<string> {
  const window = reportWindow(Date.now(), which);
  const deposits = await moneyRows("deposit_bonus_ledger", "wallet_credited", "final_credit", "created_at");
  const payouts = await moneyRows("paydora_payout_requests", "status", "amount", "created_at");
  const depositSummary = summarizeMoney(deposits, window.startIso, window.endIso);
  const payoutSummary = summarizeMoney(payouts, window.startIso, window.endIso);
  const lines = [`${window.label} (${window.timeZone})`];
  if (!focus || focus === "deposits") lines.push(moneyLine("Deposits", depositSummary));
  if (!focus || focus === "payouts") lines.push(moneyLine("Cash-outs", payoutSummary));
  lines.push("Accepted by Telegram is not the same as paid or read.");
  return lines.join("\n");
}

function moneyLine(
  label: string,
  summary: ReturnType<typeof summarizeMoney>
): string {
  if (summary.state === "unavailable") return `${label}: unavailable`;
  return `${label}: confirmed $${summary.confirmed.toFixed(2)} (${summary.confirmedCount}), pending $${summary.pending.toFixed(2)} (${summary.pendingCount}), failed $${summary.failed.toFixed(2)} (${summary.failedCount})`;
}

async function moneyRows(table: string, statusColumn: string, amountColumn: string, atColumn: string): Promise<MoneyRow[] | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.from(table).select(`${statusColumn}, ${amountColumn}, ${atColumn}`).limit(500);
  if (error) return null;
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
    status: statusColumn === "wallet_credited" ? (row[statusColumn] ? "credited" : "pending") : String(row[statusColumn] ?? "pending"),
    amount: Number(row[amountColumn]),
    at: String(row[atColumn] ?? ""),
  }));
}

async function countText(table: string, status: string): Promise<string> {
  const admin = createAdminClient();
  if (!admin) return "Unavailable";
  const { count, error } = await admin.from(table).select("id", { count: "exact", head: true }).eq("status", status);
  if (error) return "Unavailable";
  return `${status}: ${count ?? 0}. This is a count, not a player list.`;
}

async function signupText(scope: "today" | "all"): Promise<string> {
  const admin = createAdminClient();
  if (!admin) return "Signups: unavailable";
  const window = reportWindow(Date.now(), "today");
  let query = admin.from("profiles").select("id", { count: "exact", head: true });
  if (scope === "today") query = query.gte("created_at", window.startIso).lt("created_at", window.endIso);
  const { count, error } = await query;
  if (error) return "Signups: unavailable";
  return scope === "today"
    ? `Signups today (${REPORT_TIMEZONE}): ${count ?? 0}`
    : `Player profiles: ${count ?? 0}`;
}
