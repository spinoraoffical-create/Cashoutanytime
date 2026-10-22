import { adminDb } from "@/lib/actions/admin/core";
import { LoyaltyControlsForm, LoyaltyPauseButton, LoyaltyTaskForm } from "@/components/admin/loyalty-controls-form";

type TaskRow = { key: string; coins: number; enabled: boolean };
type SettingRow = { key: string; value: unknown };
type Summary = {
  issued_grants?: number;
  issued_checkins?: number;
  issued_deposits?: number;
  reversed?: number;
  unrecovered?: number;
  cap_used?: number;
  cap?: number;
  wallet_coins?: number;
  players?: number;
  welcome_grants?: number;
  checkins_today?: number;
  checkins_week?: number;
  checkins_month?: number;
  blocked_attempts?: number;
};

const TASKS: Array<{ key: string; label: string; help: string }> = [
  { key: "signup", label: "Signup", help: "Pays once when a new account is created. Existing players are not backfilled." },
  { key: "email_verified", label: "Email verified", help: "Pays once after the email is confirmed." },
  { key: "phone_otp", label: "Phone verified", help: "Pays once after a completed phone code. Texts stay off until Twilio is configured." },
  { key: "kyc_approved", label: "KYC approved", help: "Pays once when staff approve identity. An upload does not pay." },
  { key: "telegram_member", label: "Telegram verified", help: "Pays once after the server confirms membership. Opening the link does not pay." },
  { key: "welcome_survey", label: "Survey completed", help: "Pays once after the three survey answers are saved. A disabled survey does not use up the one chance." },
  { key: "daily_checkin", label: "Daily check-in", help: "Once per UTC day. Pays only when Coin check-in is on, freeplay is off, and Coins earning is on." },
  { key: "weekly_checkin", label: "Weekly check-in", help: "After five daily Coin check-ins in the same UTC week." },
  { key: "monthly_checkin", label: "Monthly check-in", help: "After twenty daily Coin check-ins in the same UTC month." },
];

function settingOn(settings: SettingRow[], key: string, missingMeansOn = false) {
  const row = settings.find((item) => item.key === key);
  if (!row) return missingMeansOn;
  return row.value === true || row.value === "true";
}

function settingNumber(settings: SettingRow[], key: string, fallback: number) {
  const value = settings.find((row) => row.key === key)?.value;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function money(coins: number) {
  return `$${(coins / 1000).toFixed(2)}`;
}

export async function LoyaltyCoinsAdmin() {
  const db = adminDb();
  const [tasksRes, grantsRes, checkinsRes, depositsRes, settingsRes, attemptsRes, summaryRes] = await Promise.all([
    db.from("loyalty_tasks" as "reward_rules").select("key, coins, enabled"),
    db.from("loyalty_grants" as "reward_claims").select("task_key, coins"),
    db.from("loyalty_checkins" as "reward_claims").select("kind, coins"),
    db.from("loyalty_deposit_grants" as "reward_claims").select("coins, reversed_coins, unrecovered_coins"),
    db.from("site_settings").select("key, value").in("key", [
      "coins_earning_enabled",
      "legacy_freeplay_claims_enabled",
      "coins_checkin_enabled",
      "deposit_coins_enabled",
      "deposit_coins_per_dollar",
      "deposit_coins_min_dollars",
      "deposit_coins_max_per_tx",
      "deposit_coins_max_per_player_month",
      "coins_player_month_cap",
      "coins_global_budget",
      "coins_redemption_enabled",
    ]),
    db.from("loyalty_reward_attempts" as "reward_claims").select("kind, detail, created_at").order("created_at" as "id", { ascending: false }).limit(8),
    db.rpc("loyalty_admin_summary" as never),
  ]);

  if (tasksRes.error) {
    return (
      <section className="mt-8 rounded-2xl border border-[#7c3aed]/25 bg-[#0d1428] p-4 text-sm text-[#d5def2]">
        <h2 className="text-lg font-black text-white">Coins</h2>
        <p className="mt-2">The Coins ledger is not installed on this database yet. No Coins have been issued from it. The $1 freeplay check-in is unchanged.</p>
      </section>
    );
  }

  const tasks = (tasksRes.data ?? []) as unknown as TaskRow[];
  const grants = (grantsRes.data ?? []) as unknown as { task_key: string; coins: number }[];
  const checkins = (checkinsRes.error ? [] : (checkinsRes.data ?? [])) as unknown as { kind: string; coins: number }[];
  const deposits = (depositsRes.error ? [] : (depositsRes.data ?? [])) as unknown as { coins: number; reversed_coins?: number; unrecovered_coins?: number }[];
  const settings = (settingsRes.data ?? []) as SettingRow[];
  const attempts = (attemptsRes.error ? [] : (attemptsRes.data ?? [])) as unknown as { kind: string; detail: string; created_at: string }[];
  const summary = (summaryRes.error ? null : summaryRes.data) as Summary | null;
  const issuedGrants = summary?.issued_grants ?? grants.reduce((sum, row) => sum + Number(row.coins || 0), 0);
  const issuedCheckins = summary?.issued_checkins ?? checkins.reduce((sum, row) => sum + Number(row.coins || 0), 0);
  const issuedDeposits = summary?.issued_deposits ?? deposits.reduce((sum, row) => sum + Number(row.coins || 0), 0);
  const reversed = summary?.reversed ?? deposits.reduce((sum, row) => sum + Number(row.reversed_coins || 0), 0);
  const unrecovered = summary?.unrecovered ?? deposits.reduce((sum, row) => sum + Number(row.unrecovered_coins || 0), 0);
  const cap = summary?.cap ?? settingNumber(settings, "coins_global_budget", 30000);
  const capUsed = summary?.cap_used ?? issuedGrants + issuedCheckins + issuedDeposits - reversed;
  const remaining = Math.max(0, cap - capUsed);
  const phoneReady = process.env.PHONE_OTP_SENDING_ENABLED === "true"
    && Boolean(process.env.TWILIO_ACCOUNT_SID?.trim())
    && Boolean(process.env.TWILIO_AUTH_TOKEN?.trim())
    && Boolean(process.env.TWILIO_FROM_NUMBER?.trim())
    && Boolean(process.env.PHONE_OTP_PEPPER?.trim());
  const telegramReady = Boolean(process.env.TELEGRAM_MEMBERSHIP_BOT_TOKEN?.trim())
    && Boolean(process.env.TELEGRAM_COMMUNITY_CHAT_ID?.trim());
  const initial = {
    earning: settingOn(settings, "coins_earning_enabled"),
    deposit: settingOn(settings, "deposit_coins_enabled"),
    legacy: settingOn(settings, "legacy_freeplay_claims_enabled", true),
    checkin: settingOn(settings, "coins_checkin_enabled"),
    rate: settingNumber(settings, "deposit_coins_per_dollar", 5),
    minDollars: settingNumber(settings, "deposit_coins_min_dollars", 1),
    maxPerTx: settingNumber(settings, "deposit_coins_max_per_tx", 500),
    maxPerPlayerMonth: settingNumber(settings, "deposit_coins_max_per_player_month", 500),
    playerMonthCap: settingNumber(settings, "coins_player_month_cap", 5000),
    globalBudget: settingNumber(settings, "coins_global_budget", 30000),
  };

  return (
    <section className="mt-8 rounded-2xl border border-[#7c3aed]/25 bg-[#0d1428] p-4 text-sm text-[#d5def2]">
      <h2 className="text-lg font-black text-white">Coins</h2>
      <p className="mt-1 text-[#9fb0d0]">Players see Coins and VIP level. Redemption is off. Coins are not cash.</p>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        <div>Coins issued: <strong>{(issuedGrants + issuedCheckins + issuedDeposits).toLocaleString()}</strong></div>
        <div>Outstanding in player balances: <strong>{summary ? Number(summary.wallet_coins ?? 0).toLocaleString() : "Install the summary update to see this total"}</strong></div>
        <div>Deposit Coins reversed: <strong>{reversed.toLocaleString()}</strong></div>
        <div>Unrecovered after refunds: <strong>{unrecovered.toLocaleString()}</strong></div>
        <div>Budget used: <strong>{capUsed.toLocaleString()}</strong> of {cap.toLocaleString()}</div>
        <div>Budget remaining: <strong>{remaining.toLocaleString()}</strong></div>
        <div>Possible freeplay if redemption is ever allowed: <strong>{money(capUsed)}</strong></div>
        <div>Actual redemptions: <strong>$0.00</strong></div>
        <div>Eligible players: <strong>{summary ? Number(summary.players ?? 0).toLocaleString() : "—"}</strong></div>
        <div>Welcome grants recorded: <strong>{summary ? Number(summary.welcome_grants ?? grants.length).toLocaleString() : grants.length.toLocaleString()}</strong></div>
        <div>Daily check-ins today / this week / this month: <strong>{summary ? `${summary.checkins_today ?? 0} / ${summary.checkins_week ?? 0} / ${summary.checkins_month ?? 0}` : "—"}</strong></div>
        <div>Deposit Coins issued: <strong>{issuedDeposits.toLocaleString()}</strong></div>
        <div>Redemption: <strong>Unavailable</strong></div>
        <div>Blocked or duplicate attempts: <strong>{summary ? Number(summary.blocked_attempts ?? attempts.length).toLocaleString() : attempts.length.toLocaleString()}</strong></div>
      </dl>
      <p className="mt-3">Coins earning is {initial.earning ? "on" : "off"}. The $1 freeplay check-in is {initial.legacy ? "on" : "off"}. Coin check-in is {initial.checkin ? "on" : "off"}. Deposit Coins are {initial.deposit ? "on" : "off"}.</p>
      <p className="mt-1">Phone texts: {phoneReady ? "configured" : "not configured, so the phone task must stay off"}. Telegram membership check: {telegramReady ? "configured" : "not configured, so the Telegram task must stay off"}.</p>
      <LoyaltyPauseButton />
      <p className="mt-1 text-xs text-[#9fb0d0]">Pause stops new Coins. It does not turn the $1 freeplay check-in back on.</p>
      <div className="mt-4 space-y-2">
        {TASKS.map((task) => {
          const row = tasks.find((item) => item.key === task.key);
          const matching = task.key.endsWith("_checkin")
            ? checkins.filter((item) => item.kind === task.key.replace("_checkin", ""))
            : grants.filter((item) => item.task_key === task.key);
          return (
            <LoyaltyTaskForm
              key={`${task.key}-${row?.coins ?? 0}-${row?.enabled ?? false}`}
              taskKey={task.key}
              label={task.label}
              help={task.help}
              coins={row?.coins ?? 0}
              enabled={Boolean(row?.enabled)}
              completions={matching.length}
              issued={matching.reduce((sum, item) => sum + Number(item.coins || 0), 0)}
            />
          );
        })}
      </div>
      <LoyaltyControlsForm key={JSON.stringify(initial)} initial={initial} />
      <div className="mt-4">
        <h3 className="font-bold text-white">Recent blocked or duplicate attempts</h3>
        {attempts.length === 0 ? <p className="mt-1">None recorded.</p> : (
          <ul className="mt-1 space-y-1">
            {attempts.map((row, index) => (
              <li key={`${row.created_at}-${index}`}>{row.kind}: {row.detail}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
