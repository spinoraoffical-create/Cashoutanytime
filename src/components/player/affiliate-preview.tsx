"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

function Row({
  label,
  ready,
  href,
}: {
  label: string;
  ready: boolean;
  href: string;
}) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-3 text-sm">
      <span className="inline-flex items-center gap-2 font-bold">
        <ShieldCheck className={`h-4 w-4 ${ready ? "text-emerald-400" : "text-[#b9b3c6]"}`} />
        {label}
      </span>
      <span className={ready ? "font-bold text-emerald-300" : "font-bold"}>{ready ? "Ready" : "Needed"}</span>
    </Link>
  );
}

export function AffiliatePreview({
  email,
  emailVerified,
  phoneVerified,
  identityVerified,
}: {
  email: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  identityVerified: boolean;
}) {
  const next = !identityVerified
    ? "Next step: complete identity verification. Preview access does not bypass verification or any financial safeguard."
    : !phoneVerified
      ? "Next step: add and confirm your phone."
      : !emailVerified
        ? "Next step: confirm your email."
        : "Verification checks are complete. Enrollment and payouts are not active in preview.";

  async function resend() {
    const supabase = createClient();
    if (!supabase || !email) return;
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) {
      toast.error(error.message || "Could not resend the confirmation email.");
      return;
    }
    toast.success("Confirmation email sent.");
  }

  return (
    <div className="space-y-4 pb-10">
      <section className="rounded-2xl border border-[#ff6b89]/40 p-5">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#ff6b89]">Affiliate program</p>
        <h1 className="mt-1 text-3xl font-black">Earn from commissionable net revenue</h1>
        <p className="mt-2 text-sm text-[#b9b3c6]">
          Your direct players&apos; completed cash deposits minus their gross completed cash-outs. Earnings close monthly and stay locked until the program leaves preview.
        </p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#1a1024] p-5">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#ff6b89]">Program preview</p>
        <h2 className="mt-1 text-2xl font-black">Your Affiliate page is enabled for review</h2>
        <p className="mt-2 text-sm text-[#b9b3c6]">
          You can review how the program works before the pilot opens. Affiliate links, enrollment, earnings, and payouts are not active in preview mode.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Row label="Email Verified" ready={emailVerified} href="/dashboard" />
          <Row label="Phone Verified" ready={phoneVerified} href="/dashboard/verification" />
          <Row label="Identity Verified" ready={identityVerified} href="/dashboard/kyc" />
          <div className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-3 text-sm">
            <span className="inline-flex items-center gap-2 font-bold">
              <ShieldCheck className="h-4 w-4 text-emerald-400" /> Account Eligible
            </span>
            <span className="font-bold text-emerald-300">Ready</span>
          </div>
        </div>
        {!emailVerified ? (
          <button type="button" onClick={() => void resend()} className="mt-3 text-sm font-bold text-[#ff6b89]">
            Resend confirmation email
          </button>
        ) : null}
        <p className="mt-3 rounded-xl bg-white/5 px-3 py-3 text-sm text-[#b9b3c6]">{next}</p>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-[#1a1024] p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#ff6b89]">Illustrative example</p>
          <h2 className="mt-1 text-xl font-black">How earnings work</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><dt>Completed deposits</dt><dd>$500</dd></div>
            <div className="flex justify-between"><dt>Gross completed cash-outs</dt><dd>− $300</dd></div>
            <div className="flex justify-between border-t border-white/10 pt-2"><dt>Commissionable net revenue</dt><dd>$200</dd></div>
            <div className="flex justify-between"><dt>Commission rate</dt><dd>Unavailable</dd></div>
          </dl>
          <p className="mt-3 text-xs text-[#b9b3c6]">This is commissionable net revenue, not final business profit. Negative periods carry forward. These figures are an example, not your balance.</p>
        </section>
        <section className="rounded-2xl border border-white/10 bg-[#1a1024] p-5">
          <h2 className="text-xl font-black">What activates later</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[#b9b3c6]">
            <li>A personal link with clear affiliate disclosure.</li>
            <li>Direct-player qualification and aggregate performance.</li>
            <li>Monthly settlement with a 30-day maturity hold.</li>
            <li>Current payout minimums and fees appear when the server policy is available.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
