"use client";

import { useState } from "react";
import { SOCIAL_LINKS } from "@/lib/constants";
import {
  claimLoyaltyCheckinAction,
  claimTelegramCoinsAction,
  confirmPhoneCodeAction,
  requestPhoneCodeAction,
  saveWelcomeSurveyAction,
} from "@/lib/actions/loyalty";
import { createCustomerTelegramLink } from "@/lib/actions/telegram";
import { availableWelcomeCoins, CHECKIN_COINS, CHECKIN_DAILY_REQUIRED } from "@/lib/rewards/loyalty-coins";

const LABELS: Record<string, string> = {
  signup: "Complete account signup",
  email_verified: "Verify email",
  phone_otp: "Verify phone by OTP",
  kyc_approved: "KYC approved",
  telegram_member: "Join Telegram community",
  welcome_survey: "Complete welcome survey",
  daily_checkin: "Daily check-in",
  weekly_checkin: "Weekly check-in",
  monthly_checkin: "Monthly check-in",
};

const QUESTIONS = [
  { name: "games", label: "What games do you enjoy?", options: [["slots", "Slots"], ["fish", "Fish Games"], ["both", "Both"]] },
  { name: "source", label: "How did you discover SweepTakeHub?", options: [["telegram", "Telegram"], ["friend", "Friend"], ["search", "Search or Social Media"], ["other", "Other"]] },
  { name: "interest", label: "What interests you most?", options: [["rewards", "Daily Rewards"], ["variety", "Game Variety"], ["support", "Customer Support"]] },
] as const;

export function WelcomeCoins({
  balance,
  vipName,
  installed,
  earning,
  budgetOpen,
  phoneReady,
  telegramReady,
  tasks,
  history,
}: {
  balance: number;
  vipName: string;
  installed: boolean;
  earning: boolean;
  budgetOpen: boolean;
  phoneReady: boolean;
  telegramReady: boolean;
  tasks: { key: string; coins: number; enabled: boolean; done: boolean }[];
  history: { label: string; coins: number; at: string }[];
}) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const welcome = tasks.filter((task) => task.key in LABELS && !task.key.endsWith("_checkin"));
  const earned = welcome.filter((task) => task.done).reduce((sum, task) => sum + task.coins, 0);
  const available = availableWelcomeCoins(welcome, { phoneReady, telegramReady });
  const payable = (task: { key: string; enabled: boolean }) => earning && budgetOpen && task.enabled
    && (task.key !== "phone_otp" || phoneReady)
    && (task.key !== "telegram_member" || telegramReady);

  async function run(action: () => Promise<{ ok: boolean; error?: string; coins?: number }>) {
    setPending(true);
    const result = await action();
    setPending(false);
    if (result.ok && result.coins) setMessage(`${result.coins} Coins recorded.`);
    else if (result.ok) setMessage(result.error || "Saved.");
    else setMessage(result.error || "That reward is not available.");
  }

  return (
    <section className="mt-8 rounded-2xl border border-white/10 bg-[#1a1024] p-4">
      <h2 className="text-lg font-black">Coins and VIP</h2>
      <p className="mt-1 text-sm text-[#b9b3c6]">Coin balance {balance.toLocaleString()}. VIP level {vipName}. Coins are not cash and cannot be redeemed yet.</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-[#ff6b89]" style={{ width: `${available > 0 ? Math.min(100, (earned / available) * 100) : 0}%` }} />
      </div>
      <p className="mt-1 text-xs text-[#b9b3c6]">Welcome tasks available now: {available.toLocaleString()} Coins. Completed: {earned.toLocaleString()} Coins. Eligible to redeem today: 0. Coins cannot be turned into freeplay yet.</p>
      {!installed || !earning ? <p className="mt-2 text-sm">Welcome Coins stay off until the owner turns them on.</p> : null}
      {installed && earning && !budgetOpen ? <p className="mt-2 text-sm">The Coin budget is used up. These tasks will not pay until the owner raises the budget.</p> : null}
      <ul className="mt-3 space-y-2 text-sm">
        {welcome.map((task) => (
          <li key={task.key} className="flex items-center justify-between gap-3">
            <span>{LABELS[task.key] ?? task.key}</span>
            <span className="font-bold">{task.done ? "Done" : payable(task) ? task.coins : "Not available"}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 space-y-2">
        <h3 className="font-bold">Phone verification</h3>
        {phoneReady ? (
          <>
            <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void run(() => requestPhoneCodeAction(String(new FormData(event.currentTarget).get("phone") ?? ""))); }}>
              <input name="phone" inputMode="tel" autoComplete="tel" placeholder="+1 555 123 4567" className="h-11 flex-1 rounded-lg border border-white/10 bg-transparent px-3" />
              <button disabled={pending} className="h-11 rounded-xl bg-white/10 px-4 text-sm font-bold" type="submit">Send code</button>
            </form>
            <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void run(() => confirmPhoneCodeAction(String(new FormData(event.currentTarget).get("code") ?? ""))); }}>
              <input name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" className="h-11 flex-1 rounded-lg border border-white/10 bg-transparent px-3" />
              <button disabled={pending} className="h-11 rounded-xl bg-white/10 px-4 text-sm font-bold" type="submit">Verify phone</button>
            </form>
          </>
        ) : <p className="text-xs text-[#b9b3c6]">Phone verification is not configured, so this task cannot pay.</p>}
      </div>

      <div className="mt-4 space-y-2">
        <h3 className="font-bold">Telegram</h3>
        <div className="flex flex-col gap-2 sm:flex-row">
          <a className="inline-flex h-11 items-center justify-center rounded-xl bg-white/10 px-4 text-sm font-bold" href={SOCIAL_LINKS.telegram} target="_blank" rel="noopener noreferrer">Join Telegram</a>
          <button disabled={pending} className="h-11 rounded-xl bg-white/10 px-4 text-sm font-bold" type="button" onClick={() => void run(async () => {
            const link = await createCustomerTelegramLink();
            if (!link.ok) return link;
            window.location.href = link.deepLink;
            return { ok: true, error: "Open Telegram to link this account." };
          })}>Link account</button>
          {telegramReady ? <button disabled={pending} className="h-11 rounded-xl bg-[#ff6b89] px-4 text-sm font-bold text-[#3a1020]" type="button" onClick={() => void run(() => claimTelegramCoinsAction())}>Confirm membership</button> : <p className="text-xs text-[#b9b3c6]">Telegram membership check is not configured, so this task cannot pay.</p>}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <h3 className="font-bold">Coin check-in</h3>
        <p className="text-xs text-[#b9b3c6]">UTC days. Daily {CHECKIN_COINS.daily}, weekly {CHECKIN_COINS.weekly} after {CHECKIN_DAILY_REQUIRED.weekly} daily Coin check-ins, monthly {CHECKIN_COINS.monthly} after {CHECKIN_DAILY_REQUIRED.monthly}. Coin check-in pays only when the owner turns it on and turns the $1 freeplay check-in off. Pausing Coins does not turn freeplay back on.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          {(["daily", "weekly", "monthly"] as const).map((kind) => (
            <button key={kind} disabled={pending} className="h-11 rounded-xl bg-white/10 px-4 text-sm font-bold" type="button" onClick={() => void run(() => claimLoyaltyCheckinAction(kind))}>
              {kind} check-in
            </button>
          ))}
        </div>
      </div>

      <form
        className="mt-4 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void run(() => saveWelcomeSurveyAction({
            games: String(form.get("games") ?? ""),
            source: String(form.get("source") ?? ""),
            interest: String(form.get("interest") ?? ""),
          }));
        }}
      >
        <h3 className="font-bold">Welcome survey</h3>
        {QUESTIONS.map((question) => (
          <label key={question.name} className="block text-sm">
            <span className="font-semibold">{question.label}</span>
            <select name={question.name} required className="mt-1 h-11 w-full rounded-lg border border-white/10 bg-[#1a1024] px-3">
              <option value="">Choose one</option>
              {question.options.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        ))}
        <button type="submit" disabled={pending} className="h-11 rounded-xl bg-[#ff6b89] px-4 text-sm font-bold text-[#3a1020] disabled:opacity-60">
          {pending ? "Saving..." : "Send survey"}
        </button>
      </form>

      {history.length > 0 ? (
        <ul className="mt-4 space-y-1 text-xs text-[#b9b3c6]">
          {history.map((row) => (
            <li key={`${row.label}-${row.at}`}>{LABELS[row.label] ?? row.label}: {row.coins} Coins</li>
          ))}
        </ul>
      ) : null}
      {message ? <p className="mt-3 text-sm text-[#b9b3c6]">{message}</p> : null}
    </section>
  );
}
