"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PlayerSubpage } from "@/components/player/player-subpage";
import { getAccountPrefs, saveAccountPrefs } from "@/lib/actions/account-prefs";

const LIMIT_KEY = "hub-deposit-limit";
const TIMEOUT_KEY = "hub-play-timeout";

export default function ResponsiblePage() {
  const [limit, setLimit] = useState("");
  const [hours, setHours] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getAccountPrefs().then((prefs) => {
      if (prefs.depositLimit > 0) setLimit(String(prefs.depositLimit));
      if (prefs.timeoutUntil) localStorage.setItem(TIMEOUT_KEY, prefs.timeoutUntil);
    });
  }, []);

  async function save() {
    const depositLimit = Number(limit || 0);
    if (limit && (!Number.isFinite(depositLimit) || depositLimit < 0)) {
      toast.error("Enter a deposit limit in dollars.");
      return;
    }
    const pauseHours = Number(hours || 0);
    const timeoutUntil = pauseHours > 0 ? new Date(Date.now() + pauseHours * 60 * 60 * 1000).toISOString() : "";
    setSaving(true);
    const result = await saveAccountPrefs({ depositLimit, timeoutUntil });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not save.");
      return;
    }
    if (depositLimit > 0) localStorage.setItem(LIMIT_KEY, String(depositLimit));
    else localStorage.removeItem(LIMIT_KEY);
    if (timeoutUntil) localStorage.setItem(TIMEOUT_KEY, timeoutUntil);
    else localStorage.removeItem(TIMEOUT_KEY);
    toast.success(timeoutUntil ? "Play pause is on." : "Limits saved.");
  }

  return (
    <PlayerSubpage title="Responsible play" subtitle="Set a deposit cap or pause play. 18+ only.">
      <div className="hub-card space-y-4 rounded-[24px] p-5">
        <label className="block space-y-1.5">
          <span className="text-sm font-bold">Deposit limit</span>
          <input
            inputMode="decimal"
            value={limit}
            onChange={(event) => setLimit(event.target.value)}
            placeholder="No limit"
            className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm outline-none"
          />
          <span className="text-xs text-zinc-400">Add money stops above this amount until you change it.</span>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-bold">Pause play</span>
          <select
            value={hours}
            onChange={(event) => setHours(event.target.value)}
            className="h-11 w-full rounded-xl border border-white/10 bg-[#1a1730] px-3 text-sm"
          >
            <option value="0">Off</option>
            <option value="24">24 hours</option>
            <option value="72">3 days</option>
            <option value="168">7 days</option>
          </select>
        </label>
        <button type="button" onClick={save} disabled={saving} className="rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-white">
          {saving ? "Saving…" : "Save limits"}
        </button>
      </div>
    </PlayerSubpage>
  );
}
