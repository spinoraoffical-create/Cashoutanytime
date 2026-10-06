"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PlayerSubpage } from "@/components/player/player-subpage";
import { getAccountPrefs, saveAccountPrefs } from "@/lib/actions/account-prefs";

export default function NotificationSettingsPage() {
  const [emailNotices, setEmailNotices] = useState(true);
  const [promoNotices, setPromoNotices] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getAccountPrefs().then((prefs) => {
      setEmailNotices(prefs.emailNotices);
      setPromoNotices(prefs.promoNotices);
    });
  }, []);

  async function save(next: { emailNotices?: boolean; promoNotices?: boolean }) {
    const payload = {
      emailNotices: next.emailNotices ?? emailNotices,
      promoNotices: next.promoNotices ?? promoNotices,
    };
    setEmailNotices(payload.emailNotices);
    setPromoNotices(payload.promoNotices);
    setSaving(true);
    const result = await saveAccountPrefs(payload);
    setSaving(false);
    if (!result.ok) toast.error(result.error ?? "Could not save.");
  }

  return (
    <PlayerSubpage title="Notifications" subtitle="Choose what we send you.">
      <div className="hub-card divide-y divide-white/8 rounded-[24px]">
        <label className="flex items-center justify-between gap-3 p-4">
          <span>
            <span className="block font-bold">Account email</span>
            <span className="text-xs text-zinc-400">Receipts, security, and cash-out updates</span>
          </span>
          <input
            type="checkbox"
            checked={emailNotices}
            disabled={saving}
            onChange={(event) => void save({ emailNotices: event.target.checked })}
            className="h-5 w-5"
          />
        </label>
        <label className="flex items-center justify-between gap-3 p-4">
          <span>
            <span className="block font-bold">Offers</span>
            <span className="text-xs text-zinc-400">Rewards and welcome Freeplay</span>
          </span>
          <input
            type="checkbox"
            checked={promoNotices}
            disabled={saving}
            onChange={(event) => void save({ promoNotices: event.target.checked })}
            className="h-5 w-5"
          />
        </label>
      </div>
    </PlayerSubpage>
  );
}
