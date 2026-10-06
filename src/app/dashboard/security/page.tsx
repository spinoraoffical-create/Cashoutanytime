"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PlayerSubpage } from "@/components/player/player-subpage";
import { createClient } from "@/lib/supabase/client";

export default function SecurityPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      toast.error("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Those passwords don’t match.");
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPassword("");
    setConfirm("");
    toast.success("Password updated.");
  }

  return (
    <PlayerSubpage title="Security" subtitle="Password and sign-in for this account.">
      <form onSubmit={save} className="hub-card space-y-3 rounded-[24px] p-5">
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">New password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm outline-none"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Confirm password</span>
          <input
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            autoComplete="new-password"
            className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm outline-none"
          />
        </label>
        <button type="submit" disabled={saving} className="rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-white">
          {saving ? "Saving…" : "Update password"}
        </button>
      </form>
    </PlayerSubpage>
  );
}
