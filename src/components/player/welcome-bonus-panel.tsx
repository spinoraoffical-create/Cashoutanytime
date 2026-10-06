"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { resendProfileVerification, savePlayerProfile } from "@/lib/actions/profile";
import type { ProfileEditorState } from "@/lib/actions/profile";

export function WelcomeBonusPanel({ profile }: { profile: ProfileEditorState }) {
  const [phone, setPhone] = useState(profile.phone);
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState(false);
  const emailDone = profile.emailVerified;
  const phoneDone = Boolean(phone.trim() || profile.phone);
  const done = Number(emailDone) + Number(phoneDone);

  async function resend() {
    setResending(true);
    const result = await resendProfileVerification(window.location.origin);
    setResending(false);
    toast[result.ok ? "success" : "error"](result.ok ? "Verification email sent." : result.error ?? "Could not send the email.");
  }

  async function savePhone() {
    setSaving(true);
    const body = new FormData();
    body.set("displayName", profile.displayName);
    body.set("phone", phone);
    const result = await savePlayerProfile(body);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not save your phone.");
      return;
    }
    toast.success("Phone saved.");
  }

  return (
    <div className="space-y-4">
      <section className="hub-card rounded-[24px] p-5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-400">No deposit</p>
        <h2 className="mt-1 text-2xl font-extrabold">Get $5 Freeplay</h2>
        <p className="mt-1 text-sm text-zinc-400">Complete the account checks below. No deposit is required.</p>
        <p className="mt-3 text-sm font-semibold">{2 - done} steps remaining · {done} of 2</p>
      </section>

      <section className="hub-card divide-y divide-white/8 rounded-[24px]">
        <div className="flex items-center justify-between gap-3 p-4">
          <div>
            <p className="font-bold">Verify your email</p>
            <p className="text-xs text-zinc-400">{emailDone ? "Done" : "Next"}</p>
          </div>
          {emailDone ? (
            <span className="text-sm font-semibold text-emerald-400">Done</span>
          ) : (
            <button type="button" onClick={resend} disabled={resending} className="rounded-full bg-primary px-3 py-2 text-xs font-bold text-white">
              {resending ? "Sending…" : "Verify email"}
            </button>
          )}
        </div>
        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold">Verify your phone</p>
              <p className="text-xs text-zinc-400">{phoneDone ? "Saved" : "Not started"}</p>
            </div>
          </div>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+1 202 555 0147"
            className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm outline-none"
          />
          <button type="button" onClick={savePhone} disabled={saving} className="rounded-full bg-white px-4 py-2 text-sm font-bold text-zinc-950">
            {saving ? "Saving…" : "Save phone"}
          </button>
        </div>
      </section>

      <p className="text-sm text-zinc-400">
        ID is not needed for this reward. You’ll verify it before your first cash out.{" "}
        <Link href="/dashboard/kyc" className="font-semibold text-primary">Verify ID</Link>
      </p>
    </div>
  );
}
