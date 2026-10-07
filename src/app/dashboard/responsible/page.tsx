"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { getAccountPrefs, saveAccountPrefs, type AccountPrefs } from "@/lib/actions/account-prefs";
import { getSpendingSummary } from "@/lib/actions/responsible";

const QUESTIONS = [
  "Do you spend more than you planned?",
  "Do you chase losses?",
  "Has play caused stress?",
  "Do you hide how much you play?",
  "Do you play to escape problems?",
  "Have you tried to cut back and couldn't?",
];

const BREAKS = [
  { label: "1 hour", hours: 1 },
  { label: "24 hours", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "7 days", hours: 168 },
];

const EXCLUSIONS = [
  { label: "6 months", days: 180 },
  { label: "1 year", days: 365 },
  { label: "5 years", days: 1825 },
];

function syncLocal(prefs: Pick<AccountPrefs, "depositLimit" | "weeklyLoadLimit" | "monthlyLoadLimit" | "timeoutUntil" | "selfExcludeUntil" | "breakReminderMin">) {
  const pause = [prefs.selfExcludeUntil, prefs.timeoutUntil].filter(Boolean).sort().at(-1);
  if (prefs.depositLimit > 0) localStorage.setItem("hub-deposit-limit", String(prefs.depositLimit));
  else localStorage.removeItem("hub-deposit-limit");
  localStorage.setItem("hub-break-reminder", String(prefs.breakReminderMin || 30));
  if (pause && new Date(pause).getTime() > Date.now()) localStorage.setItem("hub-play-timeout", pause);
  else localStorage.removeItem("hub-play-timeout");
}

export default function ResponsiblePage() {
  const [prefs, setPrefs] = useState<AccountPrefs | null>(null);
  const [editing, setEditing] = useState<"daily" | "weekly" | "monthly" | null>(null);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState<"how" | "spend" | "break" | "quiz" | "exclude" | "excludeInfo" | null>(null);
  const [answers, setAnswers] = useState<boolean[]>(Array(6).fill(false));
  const [tier, setTier] = useState("");
  const [spending, setSpending] = useState<Awaited<ReturnType<typeof getSpendingSummary>> | null>(null);
  const [range, setRange] = useState<7 | 30 | 90>(30);

  useEffect(() => {
    void getAccountPrefs().then((next) => {
      setPrefs(next);
      syncLocal(next);
    });
  }, []);

  async function persist(next: Partial<AccountPrefs>, note: string) {
    const result = await saveAccountPrefs(next);
    if (!result.ok) {
      toast.error(result.error ?? "Could not save.");
      return;
    }
    setPrefs((prev) => {
      const merged = { ...(prev as AccountPrefs), ...next };
      syncLocal(merged);
      return merged;
    });
    toast.success(note);
  }

  function saveLimit(kind: "daily" | "weekly" | "monthly") {
    const value = Number(draft);
    if (!Number.isFinite(value) || value < 0) {
      toast.error("Enter a limit in dollars, or 0 for no limit.");
      return;
    }
    const key = kind === "daily" ? "depositLimit" : kind === "weekly" ? "weeklyLoadLimit" : "monthlyLoadLimit";
    const current = Number(prefs?.[key] || 0);
    if (current > 0 && (value === 0 || value > current)) {
      const at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      void persist(
        { [`${key}Pending`]: value, [`${key}PendingAt`]: at },
        "The tighter limit stays for 24 hours. The higher limit applies after that."
      );
      setEditing(null);
      return;
    }
    void persist(
      { [key]: value, [`${key}Pending`]: 0, [`${key}PendingAt`]: "" },
      value > 0 ? "Limit is on." : "Limit removed."
    );
    setEditing(null);
  }

  function labelFor(value: number) {
    return value > 0 ? `$${value.toFixed(2)}` : "No limit set";
  }

  const score = answers.filter(Boolean).length;

  return (
    <div className="space-y-5 pb-10">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm font-semibold text-[#b9b3c6]">
        <ChevronLeft className="h-4 w-4" /> Back
      </Link>
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-400">Player wellbeing</p>
        <h1 className="mt-1 text-4xl font-black">Responsible Gaming</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#b9b3c6]">
          Set load limits to stay in control. Lowering a limit takes effect right away; raising or removing one takes 24 hours.
        </p>
      </div>
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#b9b3c6]">Limits & tools</p>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#1a1024]">
        {(
          [
            ["daily", "Daily load limit", prefs?.depositLimit ?? 0],
            ["weekly", "Weekly load limit", prefs?.weeklyLoadLimit ?? 0],
            ["monthly", "Monthly load limit", prefs?.monthlyLoadLimit ?? 0],
          ] as const
        ).map(([kind, title, value]) => (
          <div key={kind} className="border-b border-white/10 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-bold">{title}</p>
                <p className="text-sm text-[#b9b3c6]">{labelFor(value)}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditing(kind);
                  setDraft(value > 0 ? String(value) : "");
                }}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-sm font-bold"
              >
                Set
              </button>
            </div>
            {editing === kind ? (
              <form
                className="mt-3 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  saveLimit(kind);
                }}
              >
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  inputMode="decimal"
                  placeholder="Dollars, 0 clears it"
                  className="h-11 flex-1 rounded-xl border border-white/10 bg-[#160812] px-3 text-sm outline-none"
                />
                <button type="submit" className="rounded-xl bg-[#ff6b89] px-4 text-sm font-bold text-[#3a1020]">
                  Save
                </button>
              </form>
            ) : null}
          </div>
        ))}

        <div className="border-b border-white/10 px-4 py-3">
          <p className="font-bold">Break reminders</p>
          <p className="text-sm text-[#b9b3c6]">Play-time check-in every {prefs?.breakReminderMin ?? 30} minutes of active play</p>
          <button type="button" onClick={() => setOpen(open === "how" ? null : "how")} className="mt-1 text-sm text-[#b9b3c6]">
            How it works
          </button>
          {open === "how" ? (
            <p className="mt-2 text-sm text-[#b9b3c6]">
              While this site is open, a check-in appears on the timer you pick. It does not close the game. Default is 30 minutes.
            </p>
          ) : null}
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ["Default", 30],
                ["20 min", 20],
                ["15 min", 15],
                ["10 min", 10],
              ] as const
            ).map(([label, minutes]) => {
              const on = (prefs?.breakReminderMin ?? 30) === minutes;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => void persist({ breakReminderMin: minutes }, `Check-in set to ${minutes} minutes.`)}
                  className={`h-11 rounded-xl text-sm font-bold ${on ? "bg-[#ff6b89] text-[#3a1020]" : "border border-white/10"}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <button type="button" onClick={() => { setOpen(open === "spend" ? null : "spend"); if (!spending) void getSpendingSummary().then(setSpending); }} className="flex w-full items-center justify-between border-b border-white/10 px-4 py-3 text-left">
          <span>
            <span className="block font-bold">Your spending</span>
            <span className="text-sm text-[#b9b3c6]">Realized deposits vs redeems — last 7 to 90 days</span>
          </span>
          <span className="text-[#b9b3c6]">▾</span>
        </button>
        {open === "spend" && spending ? (
          <div className="space-y-2 border-b border-white/10 px-4 pb-3 text-sm">
            <div className="flex gap-2">
              {([7, 30, 90] as const).map((days) => (
                <button key={days} type="button" onClick={() => setRange(days)} className={`rounded-full px-3 py-1 text-xs font-bold ${range === days ? "bg-white text-[#140a19]" : "bg-white/10"}`}>
                  {days} days
                </button>
              ))}
            </div>
            <p>Deposits ${spending[range === 7 ? "days7" : range === 30 ? "days30" : "days90"].deposits.toFixed(2)}</p>
            <p>Redeems ${spending[range === 7 ? "days7" : range === 30 ? "days30" : "days90"].redeems.toFixed(2)}</p>
          </div>
        ) : null}

        <button type="button" onClick={() => setOpen(open === "break" ? null : "break")} className="flex w-full items-center justify-between border-b border-white/10 px-4 py-3 text-left">
          <span>
            <span className="block font-bold">Short-term break</span>
            <span className="text-sm text-[#b9b3c6]">
              {prefs?.timeoutUntil && new Date(prefs.timeoutUntil).getTime() > Date.now()
                ? `On until ${new Date(prefs.timeoutUntil).toLocaleString()}`
                : "Quick cool-down — 1 hour to 1 week, lifts automatically"}
            </span>
          </span>
          <span className="text-[#b9b3c6]">▾</span>
        </button>
        {open === "break" ? (
          <div className="grid grid-cols-2 gap-2 border-b border-white/10 px-4 pb-3 sm:grid-cols-4">
            {BREAKS.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => void persist({ timeoutUntil: new Date(Date.now() + item.hours * 60 * 60 * 1000).toISOString() }, `Break set for ${item.label}.`)}
                className="h-11 rounded-xl border border-white/10 text-sm font-bold"
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div>
            <p className="font-bold">Self-assessment</p>
            <p className="text-sm text-[#b9b3c6]">Six quick questions. Answers stay on this device — we use them only to show you a guidance tier.</p>
          </div>
          <button type="button" onClick={() => setOpen(open === "quiz" ? null : "quiz")} className="shrink-0 rounded-full border border-white/15 px-3 py-2 text-sm font-bold">
            Take self-assessment
          </button>
        </div>
        {open === "quiz" ? (
          <div className="space-y-2 border-b border-white/10 px-4 pb-3">
            {QUESTIONS.map((question, index) => (
              <label key={question} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={answers[index]}
                  onChange={(event) => setAnswers((prev) => prev.map((value, i) => (i === index ? event.target.checked : value)))}
                />
                {question}
              </label>
            ))}
            <button
              type="button"
              onClick={() => setTier(score >= 4 ? "Consider a longer break" : score >= 2 ? "Keep a closer limit" : "Lower concern")}
              className="rounded-xl bg-[#ff6b89] px-3 py-2 text-sm font-bold text-[#3a1020]"
            >
              See guidance
            </button>
            {tier ? <p className="text-sm font-bold">{tier}. {score} of 6 checked.</p> : null}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="font-bold">Self-exclusion</p>
            <p className="text-sm text-[#b9b3c6]">Take a longer break — while excluded, you can&apos;t load or play. Cashing out stays open.</p>
            <button type="button" onClick={() => setOpen(open === "excludeInfo" ? null : "excludeInfo")} className="mt-1 text-sm text-[#b9b3c6]">
              What happens when I self-exclude?
            </button>
          </div>
          <button type="button" onClick={() => setOpen(open === "exclude" ? null : "exclude")} className="shrink-0 rounded-lg border border-[#f3264f] px-3 py-2 text-sm font-bold text-[#ff6b89]">
            Self-exclude...
          </button>
        </div>
        {open === "excludeInfo" ? (
          <p className="px-4 pb-3 text-sm text-[#b9b3c6]">
            Adding money and loading a game are blocked until the date you pick. Cash out stays available. This does not end early.
          </p>
        ) : null}
        {open === "exclude" ? (
          <div className="grid gap-2 px-4 pb-4 sm:grid-cols-3">
            {EXCLUSIONS.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  const until = new Date(Date.now() + item.days * 24 * 60 * 60 * 1000).toISOString();
                  if (!window.confirm(`Self-exclude for ${item.label}? Adding money and game loads stay off until then.`)) return;
                  void persist({ selfExcludeUntil: until, timeoutUntil: until }, `Self-exclusion is on for ${item.label}.`);
                }}
                className="h-11 rounded-xl border border-[#f3264f] text-sm font-bold text-[#ff6b89]"
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="text-center text-sm text-[#b9b3c6]">
        <p>Play responsibly. Eligibility varies by location.</p>
        <div className="mt-3 flex justify-center gap-2">
          <a href="tel:18004262537" className="rounded-full border border-white/15 px-3 py-2 text-sm font-bold text-white">
            Call 1-800-GAMBLER
          </a>
          <a href="https://www.ncpgambling.org/help-treatment/" target="_blank" rel="noreferrer" className="rounded-full border border-white/15 px-3 py-2 text-sm font-bold text-white">
            NCPG resources
          </a>
        </div>
      </div>
    </div>
  );
}
